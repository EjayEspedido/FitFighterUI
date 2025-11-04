#!/usr/bin/env python3
"""
Rhythm (GameMode 3)

USAGE
  python3 game3.py <user> <audio_path> <csv_path> [alsa_dev]

Notes:
- Logic, windows, and rendering match your integrated version.
- CSV header must be: beat_index,time_s,pad
"""

import time, csv, os, sys
from queue import Queue, Empty
from gpiozero import Button
from rpi_ws281x import PixelStrip, Color, ws
import atexit, signal, vlc

# ------------------------------
# CLI
# ------------------------------
user      = int(sys.argv[1]) if len(sys.argv) > 1 else 1
audio_path = sys.argv[2] if len(sys.argv) > 2 else "song.wav"
csv_path   = sys.argv[3] if len(sys.argv) > 3 else None
alsa_dev   = sys.argv[4] if len(sys.argv) > 4 else None

# ------------------------------
# Common init (same as original)
# ------------------------------
pad_gpio = { 1:6, 2:17, 3:27, 4:22, 5:24, 6:25, 7:26, 8:16 }

testMode = False
LED_PIN   = 21
NUM_LEDS  = 632
LEDS_PER_PAD = NUM_LEDS // 8
BRIGHTNESS   = 40
FREQ_HZ      = 800000
DMA          = 10
INVERT       = False
CHANNEL      = 0
STRIP_TYPE   = ws.WS2811_STRIP_GRB

led_address = {i:(i-1)*LEDS_PER_PAD for i in range(1,9)}
if testMode:
    NUM_LEDS = 24; LEDS_PER_PAD = NUM_LEDS // 8
    led_address = {1:0,2:3,3:6,4:9,5:12,6:15,7:18,8:21}

strip = PixelStrip(NUM_LEDS, LED_PIN, FREQ_HZ, DMA, INVERT, BRIGHTNESS, CHANNEL, STRIP_TYPE)
strip.begin()

def off_allStrips():
    for i in range(NUM_LEDS): strip.setPixelColor(i, Color(0,0,0))
    strip.show()

flash_expiry = {}; flash_retainedColors = {}
def start_flash(pid, color=Color(255,0,0), duration=0.10, retainedColor=0):
    s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
    for i in range(s,e): strip.setPixelColor(i, color)
    strip.show()
    flash_expiry[pid] = time.monotonic() + duration
    if retainedColor is not None: flash_retainedColors[pid] = retainedColor
    else: flash_retainedColors.pop(pid, None)
def tick_flash_cleanup():
    now = time.monotonic()
    expired = [pid for pid,t in flash_expiry.items() if now >= t]
    if not expired: return
    for pid in expired:
        s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
        retained = flash_retainedColors.pop(pid, 0)
        for i in range(s,e): strip.setPixelColor(i, retained)
        del flash_expiry[pid]
    strip.show()

buttons = {}; event_q = Queue()
DEBOUNCE_S = 0.03
def on_press(pad_id):   event_q.put(("press", pad_id, time.monotonic()))
def on_release(pad_id): event_q.put(("release",pad_id, time.monotonic()))
for pid,gpio in pad_gpio.items():
    b = Button(gpio, pull_up=True, bounce_time=DEBOUNCE_S)
    b.when_pressed = (lambda p=pid: on_press(p))
    buttons[pid] = b

inputs_locked = False
lock_release_time = 0.0
def drain_events():
    try:
        while True: event_q.get_nowait()
    except Empty: pass
def lock_inputs():
    global inputs_locked
    inputs_locked = True; drain_events()
def unlock_inputs():
    global inputs_locked, lock_release_time
    inputs_locked = False; lock_release_time = time.monotonic()
def accepts_event(ts): return (not inputs_locked) and (ts > lock_release_time)

shutdown_done = False
def clean_shutdown():
    global shutdown_done
    if shutdown_done: return
    shutdown_done = True
    try: lock_inputs(); drain_events()
    except: pass
    try:
        for b in list(buttons.values()):
            try: b.when_pressed=None; b.when_released=None
            except: pass
        for b in list(buttons.values()):
            try: b.close()
            except: pass
    except: pass
    try: off_allStrips()
    except: pass

atexit.register(clean_shutdown)
def _sig_handler(signum, frame): sys.exit(0)
signal.signal(signal.SIGINT, _sig_handler)
signal.signal(signal.SIGTERM, _sig_handler)

# ------------------------------
# Rhythm constants (same)
# ------------------------------
COLOR_PINK    = Color(255, 0, 162)
COLOR_CYAN    = Color(0, 255, 255)
COLOR_GOLD    = Color(255, 255, 0)     # Perfect
COLOR_GREEN   = Color(40, 220, 40)     # Great
COLOR_VIOLET  = Color(40, 80, 40)      # Good
COLOR_RED     = Color(255, 0, 0)       # Late/Miss
COLOR_ORANGE_B= Color(255, 30, 0)      # 50+ combo palette
COLOR_BLUE_B  = Color(40, 160, 255)

BEAT_EXPIRE_S = 0.250
BEAT_OFFSET   = 1.00
LED_EARLY     = -0.012
FLASH_DUR     = 0.10
STARTUP_SETTLE_S = 0.20
FRAME_DT      = 0.003

J_WIN_PERFECT = 0.040
J_WIN_GREAT   = 0.090
J_WIN_GOOD    = 0.150
J_LATE_CUTOFF = 0.220
COMBO_SWAP_AT = 50

song_CSV_offset = {
    "Daikirai_Beatmap.csv": 1.73,
    "Shape_of_You_Beatmap.csv": 1.12,
    "PPPP.csv": 1.19,
}
_csv_key = os.path.basename(csv_path) if csv_path else None
CSV_TIME_OFFSET = song_CSV_offset.get(_csv_key, 0.0)

# ------------------------------
# Helpers
# ------------------------------
def render_pad(pid, now_s, active, combo):
    s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
    seg_len = e - s
    if seg_len <= 0: return
    for idx in range(s,e): strip.setPixelColor(idx, Color(0,0,0))
    base_colors = (COLOR_ORANGE_B, COLOR_BLUE_B, COLOR_ORANGE_B) if combo >= COMBO_SWAP_AT else (COLOR_PINK, COLOR_CYAN, COLOR_PINK)
    for note in reversed(active[pid]):
        if note.get("judged"): continue
        t0 = note["t_appear"]; th = note["t_hit"]
        if th <= t0 or now_s <= t0: r = 0.0
        else: r = (now_s - t0) / (th - t0)
        r = 0.0 if r < 0 else (1.0 if r > 1.0 else r)
        lit = int(seg_len * r); color = base_colors[note["layer"]]
        for k in range(lit):
            strip.setPixelColor(s + k, color)

def judge_for_delta(dt):
    adt = abs(dt)
    if adt <= J_WIN_PERFECT: return ("Perfect", 3, COLOR_GOLD)
    if adt <= J_WIN_GREAT:   return ("Great",   2, COLOR_GREEN)
    if adt <= J_WIN_GOOD:    return ("Good",    1, COLOR_VIOLET)
    if 0.0 <= dt <= J_LATE_CUTOFF: return ("Late", 0, COLOR_RED)
    return (None, 0, None)

# ------------------------------
# Main
# ------------------------------
def main():
    print("Starting Rhythm (GameMode 3) ...")
    # Load CSV
    if not csv_path or not os.path.exists(csv_path):
        print(f"[Mode 3] CSV not found: {csv_path}")
        events = []
    else:
        events = []
        with open(csv_path, "r", newline="") as f:
            r = csv.reader(f)
            header = next(r, None)
            if not header or [h.strip().lower() for h in header] != ["beat_index","time_s","pad"]:
                raise ValueError("[Mode 3] CSV must have header: beat_index,time_s,pad")
            for row in r:
                if len(row) < 3: continue
                beat_idx = int(row[0]); t_hit = float(row[1]) + CSV_TIME_OFFSET; pad_id = int(row[2])
                if t_hit < 0: t_hit = 0.0
                t_appear = max(0.0, t_hit - BEAT_OFFSET)
                events.append(dict(beat=beat_idx, pad=pad_id, t_hit=t_hit, t_appear=t_appear))
        events.sort(key=lambda e: e["t_appear"])
        print(f"[Mode 3] Loaded {len(events)} beats from {os.path.basename(csv_path)}")

    # Setup audio (VLC)
    if not os.path.exists(audio_path):
        print(f"[Mode 3] Audio not found: {audio_path}")
        return

    if os.geteuid() == 0:
        dev = alsa_dev or "plughw:0,0"
        inst = vlc.Instance("--aout=alsa", f"--alsa-audio-device={dev}",
                            "--no-audio-time-stretch", "--file-caching=150")
        dev_used = dev
    else:
        inst = vlc.Instance("--no-audio-time-stretch", "--file-caching=150")
        dev_used = "system-default"

    player = inst.media_player_new()
    player.set_media(inst.media_new(audio_path))
    player.audio_set_volume(80)
    player.play()

    # Lock timebase
    t_sync = None
    t_lock_start = time.perf_counter()
    while True:
        state = player.get_state()
        if state in (vlc.State.Error, vlc.State.Ended, vlc.State.Stopped):
            break
        t_ms = player.get_time()
        if t_ms is not None and t_ms >= 0:
            if (time.perf_counter() - t_lock_start) >= STARTUP_SETTLE_S:
                t_sync = time.perf_counter() - (t_ms / 1000.0)
                break
        time.sleep(0.005)

    if t_sync is None:
        print("[Mode 3] Could not lock VLC timebase; aborting.")
        off_allStrips()
        return

    # Input / runtime state
    buttons = {}; event_q = Queue()
    for pid,gpio in pad_gpio.items():
        b = Button(gpio, pull_up=True, bounce_time=DEBOUNCE_S)
        b.when_pressed = (lambda p=pid: event_q.put(("press", p, time.monotonic())))
        buttons[pid] = b

    active = {pid: [] for pid in pad_gpio.keys()}
    ev_i = 0
    score = combo = max_combo = cnt_perfect = cnt_great = cnt_good = cnt_late = cnt_miss = 0
    rts = []
    song_len_s = None

    def layer_for_pad(pid): return len(active[pid]) % 3

    print(f"[Mode 3] Playing: {audio_path} via {dev_used}")
    start_perf = time.perf_counter()
    try:
        while player.get_state() not in (vlc.State.Ended, vlc.State.Error, vlc.State.Stopped):
            song_now = time.perf_counter() - t_sync
            if song_len_s is None:
                L = player.get_length()
                if L and L > 0: song_len_s = L / 1000.0

            while ev_i < len(events) and (events[ev_i]["t_appear"] + LED_EARLY) <= song_now:
                ev = events[ev_i]; pid = ev["pad"]
                if 1 <= pid <= 8:
                    active[pid].append({
                        "beat": ev["beat"], "t_hit": ev["t_hit"],
                        "t_appear": ev["t_appear"], "layer": layer_for_pad(pid),
                        "hit": None, "judged": False
                    })
                ev_i += 1

            try:
                ev,pad_id,ts = event_q.get(timeout=0.0)
                if ev == "press" and 1 <= pad_id <= 8 and active[pad_id]:
                    note = None
                    for n in active[pad_id]:
                        if not n["judged"]: note = n; break
                    if note is not None:
                        dt = song_now - note["t_hit"]
                        name, pts, jcolor = judge_for_delta(dt)
                        if name is not None:
                            note["hit"] = song_now; note["judged"] = True
                            active[pad_id] = [n for n in active[pad_id] if not n["judged"]]
                            if   name == "Perfect": cnt_perfect += 1
                            elif name == "Great":   cnt_great += 1
                            elif name == "Good":    cnt_good += 1
                            elif name == "Late":    cnt_late += 1
                            score += pts
                            if pts > 0:
                                combo += 1; max_combo = max(max_combo, combo); rts.append(abs(dt))
                            else:
                                combo = 0
                            start_flash(pad_id, jcolor, duration=FLASH_DUR, retainedColor=0)
                        else:
                            combo = 0
                            start_flash(pad_id, COLOR_RED, duration=0.08, retainedColor=None)
                elif ev == "press":
                    start_flash(pad_id, COLOR_RED, duration=0.08, retainedColor=None)
            except Empty:
                pass

            # expire unjudged -> Miss
            for pid in list(active.keys()):
                for n in active[pid]:
                    if n["judged"]: continue
                    if (song_now - n["t_hit"]) > BEAT_EXPIRE_S:
                        n["judged"] = True; cnt_miss += 1; combo = 0
                        start_flash(pid, COLOR_RED, duration=FLASH_DUR, retainedColor=0)
            for pid in list(active.keys()):
                active[pid] = [n for n in active[pid] if not n["judged"]]

            for pid in pad_gpio.keys():
                if pid not in flash_expiry:
                    render_pad(pid, song_now, active, combo)

            strip.show()
            tick_flash_cleanup()
            time.sleep(FRAME_DT)

        song_now = time.perf_counter() - t_sync
        for pid in active:
            for n in active[pid]:
                if not n["judged"]: cnt_miss += 1

    except KeyboardInterrupt:
        print("\n[Mode 3] Interrupted.")
    finally:
        player.stop()
        off_allStrips()

        elapsed = (song_len_s if song_len_s else (time.perf_counter() - start_perf))
        hits = cnt_perfect + cnt_great + cnt_good + cnt_late
        punch_speed = (hits/elapsed) if elapsed > 0 else 0.0
        avg_rt = (sum(rts)/len(rts)) if rts else 0.0
        max_score = (len(events)*3) if events else 1
        accuracy_pct = (score/max_score)*100.0

        print("---- Rhythm Results ----")
        print(f"Score         : {score}")
        print(f"Perfect/Great : {cnt_perfect} / {cnt_great}")
        print(f"Good/Late/Miss: {cnt_good} / {cnt_late} / {cnt_miss}")
        print(f"Max Combo     : {max_combo}")
        print(f"Avg RT (s)    : {avg_rt:.3f}")
        print(f"Punch Speed   : {punch_speed:.2f} hits/s")
        print(f"Accuracy      : {accuracy_pct:.2f}%")
        print("[Mode 3] Done.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping Rhythm Mode.")
    finally:
        atexit.unregister(clean_shutdown)
        clean_shutdown()
