#!/usr/bin/env python3
"""
mqtt_pi_game.py

MQTT client for Raspberry Pi that receives start/stop commands and launches
gameMode1.py, gameMode2.py, gameMode3.py as subprocesses.

Drop-in replacement for the previous mqtt_pi_game.py. Adjust paths below if you
placed your game scripts elsewhere.
"""
import json
import time
import threading
import uuid
import os
import shlex
import signal
import subprocess
from datetime import datetime
from pathlib import Path

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from gpiozero import Button

# load env (.env)
load_dotenv()

# ---------- CONFIG ----------
DEVICE_ID = os.getenv("DEVICE_ID", "pi01")
BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
USERNAME = os.getenv("MQTT_USER", "")
PASSWORD = os.getenv("MQTT_PASS", "")
USE_TLS = os.getenv("USE_TLS", "False").lower() in ("true", "1", "yes")

# Paths to game scripts (update if needed)
BASE_DIR = os.getenv("GAME_BASE", "/home/fitfighter")
GAME_SCRIPT_MAP = {
    "gameMode1": os.path.join(BASE_DIR, "gameMode1.py"),
    "gameMode2": os.path.join(BASE_DIR, "gameMode2.py"),
    "gameMode3": os.path.join(BASE_DIR, "gameMode3.py"),
}

# GPIO pads (same mapping as your game scripts)
PAD_PINS = (6, 17, 27, 22, 24, 25, 26, 16)

TOPIC_CONTROL = f"device/{DEVICE_ID}/control/#"
TOPIC_BTN = f"device/{DEVICE_ID}/btn"
TOPIC_STATUS = f"device/{DEVICE_ID}/status"
LWT_TOPIC = f"device/{DEVICE_ID}/lwt"

# store running sessions { session_id: {proc, started_at, game, cmd} }
running_sessions = {}
running_sessions_lock = threading.Lock()

# ---------- helpers ----------
def now_iso():
    return datetime.now().astimezone().isoformat()

def publish_json(topic, payload, qos=1, retain=False):
    try:
        client.publish(topic, json.dumps(payload), qos=qos, retain=retain)
    except Exception as e:
        print("[mqtt] publish failed", e)

def level_to_user(level_str):
    # maps Beginner..Expert to 1..4 (used by gameMode1 and gameMode2)
    if not level_str: return 2
    s = str(level_str).strip().lower()
    return {"beginner":1,"intermediate":2,"advanced":3,"expert":4}.get(s, 2)

def build_cmd_for_payload(payload):
    """
    Return (cmd_list, human_reason) or (None, error_message)
    Expected payload keys:
      - game: "gameMode1" | "gameMode2" | "gameMode3"
      - duration: seconds (optional)
      - params: dict with additional options (level, endless, startBpm, song, csv, audio, user etc.)
    """
    game = payload.get("game")
    params = payload.get("params") or {}
    duration = payload.get("duration")  # seconds (some StartScreen sends this)
    started_at = payload.get("sessionId") or payload.get("startedAt") or f"{int(time.time())}"
    # resolve script path
    script = GAME_SCRIPT_MAP.get(game)
    if not script or not os.path.exists(script):
        return None, f"script for game '{game}' not found ({script})"

    # default base python command
    python = os.getenv("PYTHON_BIN", "python3")

    # build per-game args
    if game == "gameMode1":
        # gameMode1.py: usage: <user> [timer_seconds] [endless]
        level = params.get("level") or params.get("user") or params.get("levelName")
        user_num = params.get("user") or (level_to_user(level) if level else 1)
        timer = int(duration) if duration else (int(params.get("minutes", 1)) * 60 if params.get("minutes") else 60)
        endless = params.get("endless", params.get("isEndless", False))
        endless_flag = "true" if str(endless).lower() in ("1","true","t","y","yes") else "false"
        cmd = [python, script, str(int(user_num)), str(int(timer)), endless_flag]
        return cmd, f"Combo user={user_num} timer={timer}s endless={endless_flag}"

    if game == "gameMode2":
        # gameMode2.py: usage: <user_level> [timer_seconds]
        level = params.get("level") or params.get("levelName")
        user_level = params.get("user_level") or level_to_user(level)
        timer = int(duration) if duration else (int(params.get("minutes", 1)) * 60 if params.get("minutes") else 60)
        cmd = [python, script, str(int(user_level)), str(int(timer))]
        return cmd, f"FoF level={user_level} timer={timer}s"

    if game == "gameMode3":
        # gameMode3.py: usage: <user> <audio_path> <csv_path> [alsa_dev]
        # Expect params: audio (full path), csv (full path), user (optional int)
        audio = params.get("audio") or params.get("audio_path") or params.get("song_path") or params.get("song")
        csvp = params.get("csv") or params.get("csv_path") or params.get("beatmap")
        user_num = params.get("user") or level_to_user(params.get("level"))
        if not audio or not csvp:
            return None, "gameMode3 requires 'audio' and 'csv' paths in params"
        # validate existence
        if not os.path.exists(audio):
            return None, f"audio file not found: {audio}"
        if not os.path.exists(csvp):
            return None, f"csv file not found: {csvp}"
        # optional ALSA device
        alsa_dev = params.get("alsa_dev")
        cmd = [python, script, str(int(user_num) if user_num else "1"), audio, csvp]
        if alsa_dev:
            cmd.append(alsa_dev)
        return cmd, f"Rhythm user={user_num} audio={audio} csv={csvp}"

    return None, f"unknown game '{game}'"

# ----- PAD management (create / destroy so children can claim GPIO) -----
pads = []
pads_lock = threading.Lock()

def create_pads():
    """Create Button objects and attach handlers. Safe to call after cleaning up."""
    global pads
    from gpiozero import Button as GpioButton
    with pads_lock:
        # ensure we don't leak old Button objects
        if pads:
            return
        pads = [GpioButton(pin, pull_up=True, bounce_time=0.02) for pin in PAD_PINS]
        for i, pad in enumerate(pads):
            pad.when_pressed = (lambda i=i: on_pad_press(i))
    print("[pads] created")

def destroy_pads():
    """Close Button objects to release GPIO so a child process can claim pins."""
    global pads
    with pads_lock:
        if not pads:
            return
        for p in pads:
            try:
                p.close()
            except Exception as e:
                print("[pads] close error", e)
        pads = []
    # also try to close the pin factory (best-effort)
    try:
        from gpiozero import Device
        pf = Device.pin_factory
        if pf and hasattr(pf, "close"):
            try:
                pf.close()
                print("[pads] pin_factory closed")
            except Exception as e:
                print("[pads] pin_factory close failed", e)
    except Exception:
        pass
    print("[pads] destroyed")

def on_pad_press(index):
    payload = {
        "pad": index + 1,
        "action": "press",
        "timestamp": now_iso(),
    }
    publish_json(TOPIC_BTN, payload, qos=0)
    print("[pad] published", payload)

# create pads initially
create_pads()


# ---------- MQTT callbacks ----------
client = mqtt.Client(client_id=DEVICE_ID, clean_session=False)

def on_connect(client_local, userdata, flags, rc):
    print(f"[mqtt] connected rc={rc}")
    client_local.subscribe(TOPIC_CONTROL, qos=1)
    client_local.subscribe(f"session/+/heartrate", qos=1)
    # publish status retained
    publish_json(TOPIC_STATUS, {"state":"online","deviceId":DEVICE_ID,"ts":now_iso()}, qos=1, retain=True)

def on_message(client_local, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except Exception as e:
        print("[on_message] JSON decode failed:", e)
        return
    print(f"[recv] {msg.topic} -> {payload}")

    action = payload.get("action")
    if action == "start":
        session_id = payload.get("sessionId") or f"{uuid.uuid4().hex[:8]}"
        reply = payload.get("replyTopic")
        if reply:
            ack = {"accepted": True, "sessionId": session_id, "timestamp": now_iso()}
            publish_json(reply, ack, qos=1)
            print(f"[ack] Sent ack to {reply}")

        # start a thread to launch the requested game
        t = threading.Thread(target=launch_game_thread, args=(session_id, payload), daemon=True)
        t.start()

    elif action == "stop":
        session_id = payload.get("sessionId")
        if not session_id:
            print("[stop] missing sessionId")
            return
        stopped = stop_session(session_id)
        # reply if requested
        if payload.get("replyTopic"):
            publish_json(payload["replyTopic"], {"stopped": stopped, "sessionId": session_id, "ts": now_iso()}, qos=1)

    elif payload.get("heartrate") is not None:
        # forward or print; leftover behavior
        print(f"[hr] session {payload.get('sessionId')} -> {payload.get('heartrate')} bpm")

def stop_session(session_id):
    """Attempt to terminate a running session process group."""
    with running_sessions_lock:
        info = running_sessions.get(session_id)
        if not info:
            print(f"[stop] session {session_id} not running")
            return False
        proc = info.get("proc")
        try:
            # kill process group
            pgid = os.getpgid(proc.pid)
            os.killpg(pgid, signal.SIGTERM)
            print(f"[stop] signalled SIGTERM to pgid {pgid} for session {session_id}")
        except Exception as e:
            print("[stop] kill failed", e)
        return True

def launch_game_thread(session_id, payload):
    cmd, reason = build_cmd_for_payload(payload)
    if cmd is None:
        ...
    print(f"[game] starting {payload.get('game')} session {session_id} -> {reason}")

    # Release GPIO so child can open the pins
    destroy_pads()

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=BASE_DIR, preexec_fn=os.setsid)
    except Exception as e:
        print("[game] failed to spawn", e)
        # recreate pads so parent continues working
        create_pads()
        ...
        return

    # register session
    with running_sessions_lock:
        running_sessions[session_id] = {"proc": proc, "started_at": time.time(), "game": payload.get("game"), "cmd": cmd}

    # stream stdout loop (unchanged)...
    try:
        while True:
            line = proc.stdout.readline()
            if line:
                line = line.rstrip()
                print(f"[{session_id}] {line}")
            elif proc.poll() is not None:
                break
            else:
                time.sleep(0.05)
    except Exception as e:
        print("[game] stdout read loop error", e)

    # process finished
    rc = proc.poll()
    runtime = time.time() - running_sessions.get(session_id, {}).get("started_at", time.time())
    print(f"[game] finished session {session_id} rc={rc} runtime_s={runtime:.1f}")

    # cleanup session tracking
    with running_sessions_lock:
        running_sessions.pop(session_id, None)

    # recreate pads so the mqtt launcher can detect pad presses again
    # small delay to allow kernel to free resources if needed
    time.sleep(0.1)
    try:
        create_pads()
    except Exception as e:
        print("[pads] recreate failed", e)

    # publish result (existing behavior)...

    except Exception as e:
        print("[game] failed to spawn", e)
        if payload.get("replyTopic"):
            publish_json(payload["replyTopic"], {"accepted": False, "reason": str(e), "sessionId": session_id, "ts": now_iso()}, qos=1)
        return

    # register
    with running_sessions_lock:
        running_sessions[session_id] = {"proc": proc, "started_at": time.time(), "game": payload.get("game"), "cmd": cmd}

    # stream stdout (non-blocking loop)
    try:
        while True:
            line = proc.stdout.readline()
            if line:
                line = line.rstrip()
                print(f"[{session_id}] {line}")
            elif proc.poll() is not None:
                # process ended
                break
            else:
                time.sleep(0.05)
    except Exception as e:
        print("[game] stdout read loop error", e)

    # process finished
    rc = proc.poll()
    runtime = time.time() - running_sessions.get(session_id, {}).get("started_at", time.time())
    print(f"[game] finished session {session_id} rc={rc} runtime_s={runtime:.1f}")

    # remove from running sessions
    with running_sessions_lock:
        running_sessions.pop(session_id, None)

    # publish result to session/{sessionId}/result
    result = {
        "event": "game_over",
        "sessionId": session_id,
        "game": payload.get("game"),
        "returnCode": rc,
        "durationGame": int(runtime),
        "timestamp": now_iso()
    }
    publish_json(f"session/{session_id}/result", result, qos=1)
    print(f"[game] result published for {session_id}")

# ---------- main ----------
def main():
    client.username_pw_set(USERNAME, PASSWORD)
    if USE_TLS:
        client.tls_set()

    client.will_set(
        LWT_TOPIC,
        json.dumps({"state": "offline", "deviceId": DEVICE_ID, "ts": now_iso()}),
        qos=1,
        retain=True
    )

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(BROKER, PORT, keepalive=30)
    try:
        client.loop_forever()
    finally:
        # attempt to stop running game procs on exit
        with running_sessions_lock:
            for sid, info in list(running_sessions.items()):
                try:
                    pgid = os.getpgid(info["proc"].pid)
                    os.killpg(pgid, signal.SIGTERM)
                except Exception:
                    pass

if __name__ == "__main__":
    main()
