#!/usr/bin/env python3
"""
Friend-or-Foe (GameMode 2)

USAGE
  python3 game2.py <user_level> [timer_seconds]

  <user_level>     1..4  (1=beginner, 2=intermediate, 3=advanced, 4=expert)
  [timer_seconds]  optional, default: 60

Examples:
  python3 game2.py 2          # level=2 (intermediate), 60s
  python3 game2.py 4 90       # level=4 (expert), 90s
"""

import time, random, sys
from queue import Queue, Empty
from gpiozero import Button
from rpi_ws281x import PixelStrip, Color, ws
import atexit, signal


# ------------------------------
# CLI: <user_level:int> [timer_seconds:int]
# ------------------------------
try:
    user_level = int(sys.argv[1]) if len(sys.argv) > 1 else 2
except ValueError:
    user_level = 2
user_level = max(1, min(4, user_level))   # clamp 1..4

try:
    TIMER_SECONDS = int(sys.argv[2]) if len(sys.argv) > 2 else 60
except ValueError:
    TIMER_SECONDS = 60
TIMER_SECONDS = max(1, TIMER_SECONDS)

# Map levels to difficulty keys
LEVEL_TO_DIFF = {1: "beginner", 2: "intermediate", 3: "advanced", 4: "expert"}
DIFF = LEVEL_TO_DIFF[user_level]

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

def on_oneStrip(pid, color):
    s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
    for i in range(s,e): strip.setPixelColor(i, color)
    strip.show()

def off_oneStrip(pid): on_oneStrip(pid, Color(0,0,0))

flash_expiry = {}
flash_retainedColors = {}
def start_flash(pid, color=Color(255,0,0), duration=1.0, retainedColor=None):
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

# buttons / event queue
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
# Difficulty presets (unchanged)
# ------------------------------
BASE = dict(
    duration=TIMER_SECONDS,  # <-- replaced with CLI timer
    spawn_interval=0.95,
    ttl=5,
    max_active=2,
    jitter_frac=0.15,
    friend_prob=0.45,
    bonusPad_prob=0.15,
    fake_flip_prob=0.0,
    flip_at_range=(0.50, 0.55),
    spawn_simultaneous_count=1,
)
PRESETS = {
    "beginner":     { **BASE, "max_active":1, "spawn_interval":1.35, "ttl":4,   "jitter_frac":0.10,
                      "friend_prob":0.50, "bonusPad_prob":0.00, "fake_flip_prob":0.0,
                      "spawn_simultaneous_count":1 },
    "intermediate": { **BASE, "max_active":3, "spawn_interval":1.00, "ttl":1.80,"jitter_frac":0.15,
                      "friend_prob":0.40, "bonusPad_prob":0.15, "fake_flip_prob":0.0,
                      "spawn_simultaneous_count":1 },
    "advanced":     { **BASE, "max_active":5, "spawn_interval":0.80, "ttl":1.30,"jitter_frac":0.20,
                      "friend_prob":0.35, "bonusPad_prob":0.20, "fake_flip_prob":0.30,
                      "flip_at_range":(0.45,0.55), "spawn_simultaneous_count":2 },
    "expert":       { **BASE, "max_active":8, "spawn_interval":0.65, "ttl":1.00,"jitter_frac":0.30,
                      "friend_prob":0.30, "bonusPad_prob":0.25, "fake_flip_prob":0.40,
                      "flip_at_range":(0.45,0.55), "spawn_simultaneous_count":3 },
}
C = PRESETS[DIFF]

COLOR_FOE      = Color(255,0,0)
COLOR_FRIEND   = Color(0,255,0)
COLOR_BONUSPAD = Color(144,0,255)
COLOR_HIT      = Color(255,255,0)
COLOR_BAD      = Color(255,0,0)
BONUSPAD_MAX_BONUS = 3

def jitter(val, frac):
    j = val * frac
    return max(0.05, random.uniform(val-j, val+j))

def render_flow(pid, color, t_ratio):
    s = led_address[pid]; e = min(s+LEDS_PER_PAD, NUM_LEDS)
    total = e - s
    lit = int(total * max(0.0, min(1.0, t_ratio)))
    for idx in range(total):
        i = s + idx
        strip.setPixelColor(i, color if idx < lit else Color(0,0,0))

def pick_role():
    r = random.random()
    if r < C["bonusPad_prob"]: return ("bonusPad", COLOR_BONUSPAD)
    r -= C["bonusPad_prob"]
    if r < C["friend_prob"]:
        if C["fake_flip_prob"] > 0.0 and random.random() < C["fake_flip_prob"]:
            return ("flip_friend", COLOR_FRIEND)
        return ("friend", COLOR_FRIEND)
    return ("foe", COLOR_FOE)

def spawn_one(active, now):
    available = [p for p in pad_gpio.keys() if p not in active]
    if not available: return False
    pid = random.choice(available)
    role,color = pick_role()
    ttl = jitter(C["ttl"], C["jitter_frac"])
    if testMode: ttl += 5
    spawned_at = now; expires = now + ttl
    flip_at = None; flipped = False; rt_start = spawned_at
    if role == "flip_friend":
        lo,hi = C["flip_at_range"]; flip_at = now + ttl * random.uniform(lo,hi)
        rt_start = flip_at
    active[pid] = dict(role=role, color=color, spawned_at=spawned_at, expires=expires,
                       ttl=ttl, rt_start=rt_start, kind=role, flip_at=flip_at, flipped=flipped)
    return True

def main():
    print(f"Starting Friend-or-Foe (GameMode 2) ... level={user_level} ({DIFF}), timer={TIMER_SECONDS}s")
    unlock_inputs(); drain_events(); off_allStrips()
    score=hits=friend_spared=foe_missed=friend_hit=bonusPad_hits=0
    lives = 3
    foe_rts = []
    active = {}

    start_time = time.monotonic()
    next_spawn = start_time

    while (time.monotonic() - start_time) <= C["duration"] and (lives > 0):
        now = time.monotonic()

        for pid,t in list(active.items()):
            if t["role"] == "flip_friend" and not t["flipped"] and now >= t["flip_at"]:
                t["role"] = "foe"; t["color"] = COLOR_FOE; t["flipped"] = True; t["rt_start"] = now

        for pid,t in list(active.items()):
            if now >= t["expires"]:
                role = t["role"]
                if role == "foe":
                    foe_missed += 1; lives -= 1
                elif role == "friend":
                    score += 1; friend_spared += 1
                elif role == "flip_friend":
                    score += 1; friend_spared += 1
                elif role == "bonusPad":
                    pass
                off_oneStrip(pid); del active[pid]

        interval_now = jitter(C["spawn_interval"], C["jitter_frac"])
        if now >= next_spawn and len(active) < C["max_active"]:
            spawns = min(C["spawn_simultaneous_count"], C["max_active"]-len(active))
            for _ in range(spawns):
                if not spawn_one(active, now): break
            next_spawn = now + interval_now

        try:
            ev,pad_id,ts = event_q.get(timeout=0.01)
            if not accepts_event(ts):
                tick_flash_cleanup()
                for pid,t in active.items():
                    if pid not in flash_expiry:
                        t_ratio = max(0.0, min(1.0, (t["expires"]-now)/t["ttl"]))
                        render_flow(pid, t["color"], t_ratio)
                strip.show()
                continue
        except Empty:
            tick_flash_cleanup()
            for pid,t in active.items():
                if pid not in flash_expiry:
                    t_ratio = max(0.0, min(1.0, (t["expires"]-now)/t["ttl"]))
                    render_flow(pid, t["color"], t_ratio)
            strip.show(); time.sleep(0.004); continue

        if ev != "press":
            tick_flash_cleanup()
            for pid,t in active.items():
                if pid not in flash_expiry:
                    t_ratio = max(0.0, min(1.0, (t["expires"]-now)/t["ttl"]))
                    render_flow(pid, t["color"], t_ratio)
            strip.show()
            continue

        if pad_id in active:
            t = active[pad_id]; role = t["role"]
            if role == "foe":
                rt = max(0.0, now - t["rt_start"]); foe_rts.append(rt)
                score += 1; hits += 1
                start_flash(pad_id, Color(255,255,0), duration=0.20, retainedColor=0)
                del active[pad_id]
            elif role == "friend":
                lives -= 1; friend_hit += 1
                start_flash(pad_id, COLOR_BAD, duration=0.35, retainedColor=0)
                del active[pad_id]
            elif role == "flip_friend":
                if not t["flipped"]:
                    lives -= 1; friend_hit += 1
                    start_flash(pad_id, COLOR_BAD, duration=0.35, retainedColor=0)
                else:
                    rt = max(0.0, now - t["rt_start"]); foe_rts.append(rt)
                    score += 1; hits += 1
                    start_flash(pad_id, Color(255,255,0), duration=0.20, retainedColor=0)
                del active[pad_id]
            elif role == "bonusPad":
                t_ratio = max(0.0, min(1.0, (t["expires"]-now)/t["ttl"]))
                late = 1.0 - t_ratio
                points = 1 + int(BONUSPAD_MAX_BONUS * late)
                score += points; bonusPad_hits += 1; hits += 1
                start_flash(pad_id, Color(255,255,0), duration=0.20, retainedColor=0)
                del active[pad_id]
        else:
            start_flash(pad_id, Color(255,0,0), duration=0.20, retainedColor=None)

        tick_flash_cleanup()
        for pid,t in active.items():
            if pid not in flash_expiry:
                t_ratio = max(0.0, min(1.0, (t["expires"]-now)/t["ttl"]))
                render_flow(pid, t["color"], t_ratio)
        strip.show(); time.sleep(0.002)

    for pid in list(active.keys()):
        off_oneStrip(pid)
    active.clear(); off_allStrips()

    elapsed = max(0.0001, time.monotonic() - start_time)
    print("G2 Score = ", score)
    print("G2 Lives Left = ", lives)
    print("G2 Hits = ", hits)
    print("G2 Friend Spared = ", friend_spared)
    print("G2 Friend Hit = ", friend_hit)
    print("G2 Foe Missed = ", foe_missed)
    if foe_rts: 
        temp_rt = sum(foe_rts)/len(foe_rts)
    else:
        temp_rt = '10.0000'
        
    print("G2 RT Avg = ", temp_rt)
    print("G2 Punch Speed = ", hits/elapsed)

    from firestore_fitfighter import add_friendfoe_session
    
    session_id = add_friendfoe_session(
		userID="001",
		displayName="Hehe",
		age="21",
		level=user_level,
		score=score,
		maxHR="170",
		avgHR="150",
		durationGame=elapsed,
		maxCombo="100",
		foesHit=hits,
		friendsSpared=friend_spared,
		foesMissed=foe_missed,
		friendsHit=friend_hit,
		punchSpeed=(hits/elapsed),
		reactionTime=temp_rt,
		sessionDate="Nov 3, 2025"
		)
    print("Saved session:", session_id)

if __name__ == "__main__":
	try:
		main()
	except KeyboardInterrupt:
		print("\nStopping Friend-or-Foe.")
	finally:
		clean_shutdown()
        
		
