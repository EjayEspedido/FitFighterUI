#!/usr/bin/env python3
"""
Combo Mode (GameMode 1)

USAGE
  python3 game1.py <user> [timer_seconds] [endless]

  <user>            1..4
  [timer_seconds]   default 60 (ignored if endless=True)
  [endless]         true/false/1/0/y/n (case-insensitive)

Examples:
  python3 game1.py 1               # user=1, timer=60
  python3 game1.py 1 90 true       # user=1, endless (timer is ignored)
  python3 game1.py 3 60 false      # user=3, 60s
"""

import time, random, sys, os, re, subprocess
from queue import Queue, Empty
from gpiozero import Button
from rpi_ws281x import PixelStrip, Color, ws
import atexit, signal

# ------------------------------
# CLI parsing (tolerant booleans)
# ------------------------------
def _as_bool(s):
    return str(s).strip().lower() in ("1","true","t","yes","y")

user = int(sys.argv[1]) if len(sys.argv) > 1 else 1
setG1_timer = int(sys.argv[2]) if len(sys.argv) > 2 else 60
isEndless   = _as_bool(sys.argv[3]) if len(sys.argv) > 3 else False
if isEndless:
    setG1_timer = 999999

# Per-user difficulty knobs (same as your original)
setG1_lives     = 3
setG1_interval  = 0.5
setG1_showTime  = 0.3
if user == 3:
    setG1_interval = 0.4
    setG1_showTime = 0.3
elif user == 4:
    setG1_interval = 0.3
    setG1_showTime = 0.25

# ------------------------------
# Static data (unchanged)
# ------------------------------
punch_types = {
    1:"jabLeft", 2:"straightJab", 3:"jabRight", 4:"leftHook",
    5:"uppercut", 6:"rightHook", 7:"leftBodyShot", 8:"rightBodyShot"
}

punchCombos = [
    [2,2], [2,3], [2,3,1], [2,2,3], [2,2,1], [2,2,1,3], [2,3,1,2],
    [1,2,5], [2,5,2,3], [2,2,4], [5,2,4], [5,3,1], [2,2,1,2],
    [2,2,3,2], [2,2,2,3], [7,7,1,2], [2,2,8,1], [2,3,2,3], [7,8,1,3],
    [2,2,8], [5,7], [5,4], [1,2,7], [1,3,7,7], [2,3,5,2], [1,5,1],
    [5,1,2,1], [2,5,2], [2,5,1], [5,1,7], [2,2,2], [2,2,2,8],
    [2,2,8,1], [2,6,7], [2,2,4], [2,2,3,1], [2,6,1,1], [1,2], [2,3,1,3],
]

pad_gpio = { 1:6, 2:17, 3:27, 4:22, 5:24, 6:25, 7:26, 8:16 }

# ------------------------------
# WS281x init (same config)
# ------------------------------
testMode = False
LED_PIN   = 21            # GPIO21 = PWM0/Ch0
NUM_LEDS  = 632
LEDS_PER_PAD = NUM_LEDS // 8
BRIGHTNESS   = 40
FREQ_HZ      = 800000
DMA          = 10
INVERT       = False
CHANNEL      = 0
STRIP_TYPE   = ws.WS2811_STRIP_GRB

# derive led_address to match 79-per-pad layout
led_address = {i:(i-1)*LEDS_PER_PAD for i in range(1,9)}

if testMode:
    NUM_LEDS = 24
    LEDS_PER_PAD = NUM_LEDS // 8
    led_address = {1:0,2:3,3:6,4:9,5:12,6:15,7:18,8:21}

strip = PixelStrip(NUM_LEDS, LED_PIN, FREQ_HZ, DMA, INVERT, BRIGHTNESS, CHANNEL, STRIP_TYPE)
strip.begin()

# ------------------------------
# LED helpers (global versions)
# ------------------------------
def off_allStrips():
    for i in range(NUM_LEDS):
        strip.setPixelColor(i, Color(0,0,0))
    strip.show()

def on_allStrips(color=Color(0,0,255)):
    for i in range(NUM_LEDS):
        strip.setPixelColor(i, color)
    strip.show()

def on_oneStrip(pid, color):
    start = led_address[pid]; end = min(start+LEDS_PER_PAD, NUM_LEDS)
    for i in range(start, end):
        strip.setPixelColor(i, color)
    strip.show()

def off_oneStrip(pid):
    on_oneStrip(pid, Color(0,0,0))

flash_expiry = {}
flash_retainedColors = {}

def start_flash(pid, color=Color(255,0,0), duration=1.0, retainedColor=None):
    start = led_address[pid]; end = min(start+LEDS_PER_PAD, NUM_LEDS)
    for i in range(start, end):
        strip.setPixelColor(i, color)
    strip.show()
    flash_expiry[pid] = time.monotonic() + duration
    if retainedColor is not None:
        flash_retainedColors[pid] = retainedColor
    else:
        flash_retainedColors.pop(pid, None)

def tick_flash_cleanup():
    now = time.monotonic()
    expired = [pid for pid,t in flash_expiry.items() if now >= t]
    if not expired: return
    for pid in expired:
        start = led_address[pid]; end = min(start+LEDS_PER_PAD, NUM_LEDS)
        retained = flash_retainedColors.pop(pid, 0)
        for i in range(start, end):
            strip.setPixelColor(i, retained)
        del flash_expiry[pid]
    strip.show()

def flash_cancel(pid):        flash_expiry.pop(pid, None); flash_retainedColors.pop(pid, None)
def flash_cancelAll():        flash_expiry.clear(); flash_retainedColors.clear()

# ------------------------------
# Input / buttons
# ------------------------------
buttons = {}
event_q = Queue()
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
    except Empty:
        pass

def lock_inputs():
    global inputs_locked
    inputs_locked = True
    drain_events()

def unlock_inputs():
    global inputs_locked, lock_release_time
    inputs_locked = False
    lock_release_time = time.monotonic()

def accepts_event(ts): return (not inputs_locked) and (ts > lock_release_time)

# ------------------------------
# Misc
# ------------------------------
def noRepeatRandom(current=1, lowest=1, highest=8):
    r = random.randint(lowest, highest)
    while r == current: r = random.randint(lowest, highest)
    return r

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
    try: flash_cancelAll(); off_allStrips()
    except: pass
    try:
        if 'strip' in globals() and hasattr(strip, "_cleanup"): strip._cleanup()
    except: pass
    try: time.sleep(0.05)
    except: pass

atexit.register(clean_shutdown)
def _sig_handler(signum, frame): sys.exit(0)
signal.signal(signal.SIGINT, _sig_handler)
signal.signal(signal.SIGTERM, _sig_handler)

# ======================================================
# GameMode 1 (two behaviors depending on user parameter)
# ======================================================

def run_user1():
    """Buffered renderer; one show() per tick (fixes flicker race)."""
    # local-only flash state & helpers (buffer-only; no strip.show())
    G1_flash_expiry = {}
    G1_flash_retained = {}
    def g1_on_oneStrip(pid, color):
        s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
        for i in range(s,e): strip.setPixelColor(i, color)
    def g1_start_flash(pid, color=Color(255,0,0), duration=1.0, retainedColor=None):
        g1_on_oneStrip(pid, color)
        G1_flash_expiry[pid] = time.monotonic() + duration
        if retainedColor is None: G1_flash_retained.pop(pid, None)
        else: G1_flash_retained[pid] = retainedColor
    def g1_tick_flash_cleanup():
        now = time.monotonic()
        expired = [pid for pid,t in G1_flash_expiry.items() if now >= t]
        for pid in expired:
            restore = G1_flash_retained.pop(pid, Color(0,0,0))
            g1_on_oneStrip(pid, restore)
            del G1_flash_expiry[pid]

    G1_currentPad = random.randint(1,8)
    print(G1_currentPad)
    G1_reactionTimeList = []
    g1_on_oneStrip(G1_currentPad, Color(0,0,255))
    strip.show()
    G1_referenceTime = time.monotonic()
    G1_score = 0
    G1_timer = time.monotonic()
    G1_maxTime = setG1_timer
    G1_highestCombo = 0
    G1_comboCount = 0
    G1_lives = setG1_lives

    while (time.monotonic() - G1_timer) <= G1_maxTime and (G1_lives > 0):
        try:
            ev,pad_id,ts = event_q.get(timeout=0.05)
            if not accepts_event(ts):
                g1_tick_flash_cleanup(); strip.show(); time.sleep(0.003); continue
        except Empty:
            g1_tick_flash_cleanup(); strip.show(); time.sleep(0.003); continue

        if ev != "press":
            g1_tick_flash_cleanup(); strip.show(); continue

        if pad_id == G1_currentPad:
            print("Right pad", end=''); print(punch_types[pad_id])
            G1_score += 1; G1_comboCount += 1
            rt = time.monotonic() - G1_referenceTime
            G1_reactionTimeList.append(rt)

            prev = G1_currentPad
            g1_start_flash(prev, Color(0,255,0), duration=1.0, retainedColor=Color(0,0,0))
            G1_currentPad = noRepeatRandom(prev, 1, 8)
            print(G1_currentPad)
            g1_on_oneStrip(G1_currentPad, Color(251,255,0))
            G1_referenceTime = time.monotonic()
        else:
            print("Wrong pad", end='')
            g1_start_flash(pad_id, Color(255,0,0), duration=1.0, retainedColor=None)
            G1_lives -= 1
            print(punch_types[pad_id], G1_lives)
            if G1_comboCount > G1_highestCombo: G1_highestCombo = G1_comboCount
            G1_comboCount = 0

        g1_tick_flash_cleanup(); strip.show()

    if G1_comboCount > G1_highestCombo: G1_highestCombo = G1_comboCount
    print(f"G1 Score = {G1_score}")
    if G1_reactionTimeList:
        print(f"G1 Reaction Time = {sum(G1_reactionTimeList)/len(G1_reactionTimeList)}")
    else:
        print("No valid reactions recorded.")
    elapsed = max(0.001, time.monotonic() - G1_timer)
    print(f"G1 Punch Speed = {(G1_score/elapsed)}")
    print(f"G1 Highest Combo Streak = {G1_highestCombo}")
    print(f"G1 Longest Combo = 1")

def run_user_ge2():
    """Your â€˜combo preview then repeatâ€™ logic for user>=2 (unchanged)."""
    G1_randomCombo = (random.choice(punchCombos)).copy()
    print(G1_randomCombo)
    G1_interval = setG1_interval
    G1_showTime = setG1_showTime
    G1_phase = "show"
    G1_refTime = time.monotonic()
    G1_timer = time.monotonic()
    count = 0
    G1_score = 0
    lock_inputs()
    G1_comboDisplayDone = False
    G1_punchSpeeds = []
    G1_totalTime = 0
    G1_lives = setG1_lives
    G1_maxTime = setG1_timer
    G1_highestCombo = 0
    G1_comboCount = 0

    while ((time.monotonic() - G1_timer) <= G1_maxTime) and (G1_lives > 0):
        if G1_phase == "show":
            if (time.monotonic() - G1_refTime) >= G1_interval:
                if count < len(G1_randomCombo):
                    flash_cancel(G1_randomCombo[count])
                    on_oneStrip(G1_randomCombo[count], Color(0,0,255))
                    time.sleep(G1_showTime)
                    off_oneStrip(G1_randomCombo[count])
                    count += 1
                    G1_refTime = time.monotonic()
                elif G1_comboDisplayDone:
                    off_allStrips()
                    G1_phase = "hit"
                    G1_firstHit = False
                    G1_firstHitTime = 0
                    unlock_inputs()
                    count = 0
                    G1_refTime = time.monotonic()
                    G1_comboDisplayDone = False
                    if user <= 2:
                        flash_cancel(G1_randomCombo[count])
                        on_oneStrip(G1_randomCombo[count], Color(251,255,0))
                elif count == len(G1_randomCombo):
                    on_allStrips(Color(251,255,0))
                    time.sleep(G1_interval)
                    G1_comboDisplayDone = True
                    G1_refTime = time.monotonic()

        elif G1_phase == "hit":
            try:
                ev,pad_id,ts = event_q.get(timeout=0.05)
                if not accepts_event(ts):
                    tick_flash_cleanup(); continue
            except Empty:
                tick_flash_cleanup(); time.sleep(0.005); continue

            if ev != "press":
                tick_flash_cleanup(); continue

            if (count < len(G1_randomCombo)) and (pad_id == G1_randomCombo[count]):
                temp_currentPad = G1_randomCombo[count]
                next_same = ((count+1 < len(G1_randomCombo)) and
                             (G1_randomCombo[count+1] == temp_currentPad) and
                             (user <= 2))
                start_flash(temp_currentPad, Color(0,255,0), duration=0.5,
                            retainedColor=(Color(251,255,0) if next_same else None))
                count += 1; G1_score += 1
                G1_comboCount += 1
                if not G1_firstHit:
                    G1_firstHitTime = time.monotonic() - G1_refTime
                    G1_firstHit = True
                if (count < len(G1_randomCombo)) and (user <= 2) and (not next_same):
                    next_pid = G1_randomCombo[count]
                    flash_cancel(next_pid)
                    on_oneStrip(next_pid, Color(251,255,0))
                tick_flash_cleanup()
                if count == len(G1_randomCombo):
                    G1_totalTime = time.monotonic() - G1_refTime
                    G1_punchSpeeds.append({
                        "firstHit": G1_firstHitTime,
                        "time": G1_totalTime,
                        "punchNumber": count,
                        "combo": G1_randomCombo[:],
                    })
                    on_allStrips(Color(0,255,0)); time.sleep(G1_interval); off_allStrips()
                    G1_phase = "show"; lock_inputs(); count = 0
                    G1_randomCombo = (random.choice(punchCombos)).copy()
                    print(G1_randomCombo)
                    G1_refTime = time.monotonic()
                continue

            elif (count < len(G1_randomCombo)) and (pad_id != G1_randomCombo[count]):
                print("Wrong")
                start_flash(pad_id, Color(255,0,0), duration=1.0)
                G1_lives -= 1
                if user == 4: count = 0
                if G1_comboCount > G1_highestCombo: G1_highestCombo = G1_comboCount
                G1_comboCount = 0
                tick_flash_cleanup(); continue

        tick_flash_cleanup(); time.sleep(0.005)

    # results
    G1_speedHold = []
    G1_reactionTime = 0
    G1_longestCombo = 0
    for i in G1_punchSpeeds:
        t = i.get("time", 0); pn = i.get("punchNumber", 0)
        if t > 0 and pn > 0: G1_speedHold.append(pn / t)
        G1_reactionTime += i.get("firstHit", 0)
        if len(i.get("combo", [])) > G1_longestCombo:
            G1_longestCombo = len(i["combo"])

    print(f"G1 Score = {G1_score}")
    if G1_punchSpeeds:
        avg_first = sum(d["firstHit"] for d in G1_punchSpeeds)/len(G1_punchSpeeds)
        valid = [d for d in G1_punchSpeeds if d.get("time",0)>0]
        avg_speed = (sum((d["punchNumber"]/d["time"]) for d in valid) /
                     max(1, len(valid))) if valid else 0.0
        print(f"G1 Reaction Time = {avg_first}")
        print(f"G1 Punch Speed = {avg_speed}")
    else:
        print("No valid punches recorded.")
    print(f"G1 Highest Combo Streak = {G1_highestCombo}")
    print(f"G1 Longest Combo = {G1_longestCombo}")

if __name__ == "__main__":
    print("Starting Combo Mode (GameMode 1) ... user =", user)
    try:
        if user == 1: run_user1()
        else:         run_user_ge2()
    except KeyboardInterrupt:
        print("\nStopping Combo Mode.")
    finally:
        clean_shutdown()
