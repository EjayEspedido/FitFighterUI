#!/usr/bin/env python3
"""
mqtt_pi_game.py

Raspberry Pi MQTT client that loads broker settings from .env
"""

import json
import time
import threading
import uuid
import os
from datetime import datetime
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from gpiozero import Button


# Load environment variables from .env
load_dotenv()

####### CONFIG ########
pads = [Button(pin) for pin in (6,17,27,22,24,25,26,16)]
BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
USERNAME = os.getenv("MQTT_USER", "")
PASSWORD = os.getenv("MQTT_PASS", "")
DEVICE_ID = os.getenv("DEVICE_ID", "pi01")
USE_TLS = os.getenv("USE_TLS", "False").lower() in ("true", "1", "yes")
##############################################################

TOPIC_CONTROL = f"device/{DEVICE_ID}/control/#"
TOPIC_BTN = f"device/{DEVICE_ID}/btn"
TOPIC_STATUS = f"device/{DEVICE_ID}/status"
LWT_TOPIC = f"device/{DEVICE_ID}/lwt"

def on_pad_press(index):
    payload = {
        "pad": index + 1,
        "action": "press",
        "timestamp": now_iso(),
    }
    client.publish(TOPIC_BTN, json.dumps(payload), qos=0)
    print("[pad] published", payload)

for i, pad in enumerate(pads):
    pad.when_pressed = lambda i=i: on_pad_press(i)

def now_iso():
    return datetime.now().astimezone().isoformat()

client = mqtt.Client(client_id=DEVICE_ID, clean_session=False)

def on_connect(client, userdata, flags, rc):
    print(f"[mqtt] connected rc={rc}")
    client.subscribe(TOPIC_CONTROL, qos=1)
    client.subscribe(f"session/+/heartrate", qos=1)
    client.publish(
        TOPIC_STATUS,
        json.dumps({"state": "online", "deviceId": DEVICE_ID, "ts": now_iso()}),
        qos=1,
        retain=True
    )

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"[recv] {msg.topic} -> {payload}")
    except Exception as e:
        print("[on_message] JSON decode failed:", e)
        return

    if payload.get("action") == "start":
        session_id = payload.get("sessionId", f"{uuid.uuid4().hex[:8]}")
        reply = payload.get("replyTopic")
        if reply:
            ack = {"accepted": True, "sessionId": session_id, "timestamp": now_iso()}
            client.publish(reply, json.dumps(ack), qos=1)
            print(f"[ack] Sent ack to {reply}")

        # Simulated game thread
        t = threading.Thread(target=run_game, args=(session_id, payload), daemon=True)
        t.start()

    elif payload.get("heartrate") is not None:
        print(f"[hr] session {payload.get('sessionId')} -> {payload.get('heartrate')} bpm")

def run_game(session_id, payload):
    print(f"[game] starting {payload.get('game')} session {session_id}")
    duration = int(payload.get("duration", 5))
    score = 0
    start_time = time.time()

    while time.time() - start_time < duration:
        time.sleep(1)
        score += 100
        print(f"[game] running... score={score}")

    result = {
        "event": "game_over",
        "sessionId": session_id,
        "game": payload.get("game"),
        "score": score,
        "durationGame": int(time.time() - start_time),
        "timestamp": now_iso()
    }
    client.publish(f"session/{session_id}/result", json.dumps(result), qos=1)
    print(f"[game] finished {session_id}")

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
    client.loop_forever()

if __name__ == "__main__":
    main()
