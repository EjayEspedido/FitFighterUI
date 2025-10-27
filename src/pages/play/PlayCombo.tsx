// src/pages/play/PlayCombo.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import StartScreenCombo, {
  type Level,
} from "../../components/StartScreenCombo";
import { useHeartRate } from "../../apis/HeartRateProvider";
import { usePadInput } from "../../apis/RigInputProvider";
import { sendStartParams } from "../../apis/gameControl";
import PadVisualizer from "../../components/PadVisualizer";

// ---- Adjustable constants ----
const TICK_MS = 250; // gameplay timer tick
const PREP_SECONDS = 5; // pre-roll countdown
const BASE_HIT_POINTS = 100;
const COMBO_BONUS_PER_HIT = 10;

type Phase = "start" | "prep" | "playing" | "end";

export default function PlayCombo() {
  const nav = useNavigate();
  const { bpm: currentHR } = useHeartRate(); // ← HRM (Magene / Web Bluetooth)
  const { rigId, last: lastPad } = usePadInput();
  const [phase, setPhase] = useState<Phase>("start");

  // user selections
  const [selectedLevel, setSelectedLevel] = useState<Level>("Beginner");
  const [workoutTotalSec, setWorkoutTotalSec] = useState<number>(0);
  const [workoutLeftSec, setWorkoutLeftSec] = useState<number>(0);
  const [isEndless, setIsEndless] = useState<boolean>(false);

  // scoring
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);

  // prep countdown
  const [prepLeft, setPrepLeft] = useState<number>(PREP_SECONDS);

  // leave-confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingLeaveAction = useRef<null | (() => void)>(null);

  // =========================================================
  // Handle pad hits (basic scorer for now—replace with combos later)
  // =========================================================
  const onHit = useCallback(
    (pad: number) => {
      setHits((h) => h + 1);
      setStreak((s) => {
        const ns = s + 1;
        setMaxStreak((m) => Math.max(m, ns));
        return ns;
      });
      setScore((sc) => sc + BASE_HIT_POINTS + COMBO_BONUS_PER_HIT * streak);
    },
    [streak]
  );

  // Apply scoring on new pad events while playing
  const lastHitTsRef = useRef<number>(0);
  useEffect(() => {
    if (!lastPad) return;
    if (!lastPad.ts || lastPad.ts === lastHitTsRef.current) return;
    lastHitTsRef.current = lastPad.ts;
    if (phase === "playing") onHit(lastPad.pad);
  }, [lastPad, phase, onHit]);

  // =========================================================
  // Timer for gameplay
  // =========================================================
  useEffect(() => {
    if (phase !== "playing") return;
    if (isEndless) return;

    const id = setInterval(() => {
      setWorkoutLeftSec((sec) => {
        const next = Math.max(0, sec - TICK_MS / 1000);
        if (next <= 0) {
          clearInterval(id);
          setPhase("end");
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase, isEndless]);

  // =========================================================
  // PREP countdown
  // =========================================================
  useEffect(() => {
    if (phase !== "prep") return;
    setPrepLeft(PREP_SECONDS);
    const id = setInterval(() => {
      setPrepLeft((s) => {
        const n = s - 1;
        if (n <= 0) {
          clearInterval(id);
          setPhase("playing");
        }
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // =========================================================
  // Leave helpers (Back / End) with confirm
  // =========================================================
  const reallyLeaveToModes = useCallback(() => {
    setConfirmOpen(false);
    pendingLeaveAction.current = null;
    nav("/modes");
  }, [nav]);

  const requestLeave = useCallback(
    (action: () => void) => {
      // Only confirm if we are mid-session
      if (phase === "prep" || phase === "playing") {
        pendingLeaveAction.current = action;
        setConfirmOpen(true);
      } else {
        action();
      }
    },
    [phase]
  );

  const onExit = useCallback(() => {
    requestLeave(() => reallyLeaveToModes());
  }, [requestLeave, reallyLeaveToModes]);

  const endSession = useCallback(() => {
    requestLeave(() => setPhase("end"));
  }, [requestLeave]);

  // Keyboard: 5/Escape to back (with confirm), 0 to end now (with confirm)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "5" || e.key === "Escape") {
        onExit();
      } else if (e.key === "0") {
        endSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, endSession]);

  // =========================================================
  // Start handler from StartScreen
  // =========================================================
  const handleStart = useCallback(
    async ({
      level,
      minutes,
      isEndless: endless,
    }: {
      level: Level;
      minutes: number;
      isEndless: boolean;
    }) => {
      setSelectedLevel(level);
      setIsEndless(endless);

      const total = Math.max(1, minutes) * 60;
      setWorkoutTotalSec(endless ? 0 : total);
      setWorkoutLeftSec(endless ? 0 : total);

      // 🚀 Send params to Raspberry Pi (Combo = gameMode 1)
      if (rigId) {
        await sendStartParams(rigId, {
          userLevel: level,
          gameMode: 1,
          total_time: total,
          isEndless: endless,
        });
      }

      // reset scoring on each start
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setHits(0);
      setMisses(0);

      setPhase(PREP_SECONDS > 0 ? "prep" : "playing");
    },
    [rigId]
  );

  // =========================================================
  // UI
  // =========================================================
  const header = (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "baseline",
        flexWrap: "wrap",
      }}
    >
      <h2 style={{ margin: 0, fontWeight: 900 }}>Combo Mode</h2>
      <span>
        Level: <b>{selectedLevel}</b>
      </span>
      <span>
        HR: <b>{currentHR ?? "—"}</b> bpm
      </span>
      <span>
        Score: <b>{score}</b>
      </span>
      <span>
        Streak: <b>{streak}</b> (Max {maxStreak})
      </span>
      {!isEndless && (
        <span>
          Time left: <b>{Math.ceil(workoutLeftSec)}</b>s
        </span>
      )}
    </div>
  );

  // ---- Render phases ----
  if (phase === "start") {
    return (
      <div className="page" style={{ padding: 16 }}>
        <StartScreenCombo
          heartRate={currentHR ?? null}
          defaultLevel={selectedLevel}
          defaultMinutes={10}
          onStart={handleStart}
          onExit={onExit}
        />
      </div>
    );
  }

  if (phase === "prep") {
    return (
      <div className="page" style={{ padding: 16, display: "grid", gap: 16 }}>
        {header}
        <div
          style={{
            marginTop: 40,
            fontSize: 64,
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          Get Ready… <span style={{ color: "#22d3ee" }}>{prepLeft}</span>
        </div>

        {/* Visualizer shown already so user can see pads wake up */}
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #1f2937",
            borderRadius: 16,
            background: "#0b1020",
          }}
        >
          <PadVisualizer /* if needed: lastHit={lastPad?.pad} */ />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onExit}>Back</button>
          <button onClick={endSession}>End Now</button>
        </div>

        <ConfirmLeave
          open={confirmOpen}
          onCancel={() => {
            setConfirmOpen(false);
            pendingLeaveAction.current = null;
          }}
          onConfirm={() => {
            const act = pendingLeaveAction.current;
            setConfirmOpen(false);
            pendingLeaveAction.current = null;
            act?.();
          }}
        />
      </div>
    );
  }

  if (phase === "playing") {
    return (
      <div className="page" style={{ padding: 16, display: "grid", gap: 16 }}>
        {header}

        {/* 👇 Snap-in: PadVisualizer section */}
        <div
          style={{
            padding: 16,
            border: "1px solid #1f2937",
            borderRadius: 16,
            background: "#0b1020",
          }}
        >
          <PadVisualizer /* if needed: lastHit={lastPad?.pad} */ />
        </div>

        {/* Temporary controls for testing */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMisses((m) => m + 1)}>Simulate Miss</button>
          <button onClick={() => onHit(Math.ceil(Math.random() * 8))}>
            Simulate Hit
          </button>
          <button onClick={endSession}>End Now</button>
          <button onClick={onExit}>Back</button>
        </div>

        <ConfirmLeave
          open={confirmOpen}
          onCancel={() => {
            setConfirmOpen(false);
            pendingLeaveAction.current = null;
          }}
          onConfirm={() => {
            const act = pendingLeaveAction.current;
            setConfirmOpen(false);
            pendingLeaveAction.current = null;
            act?.();
          }}
        />
      </div>
    );
  }

  // phase === "end"
  return (
    <div className="page" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Combo — Session Summary</h1>
      <div
        style={{
          display: "grid",
          gap: 8,
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 16,
          background: "#0b1020",
          maxWidth: 560,
        }}
      >
        <div>
          Level: <b>{selectedLevel}</b>
        </div>
        <div>
          Score: <b>{score}</b>
        </div>
        <div>
          Hits: <b>{hits}</b> • Misses: <b>{misses}</b>
        </div>
        <div>
          Max Streak: <b>{maxStreak}</b>
        </div>
        {!isEndless && (
          <div>
            Duration: <b>{Math.round(workoutTotalSec / 60)}</b> min
          </div>
        )}
        <div>
          HR (last): <b>{currentHR ?? "—"}</b> bpm
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setPhase("start")}>Play Again</button>
        <button onClick={onExit}>Back to Modes</button>
      </div>

      <ConfirmLeave
        open={confirmOpen}
        onCancel={() => {
          setConfirmOpen(false);
          pendingLeaveAction.current = null;
        }}
        onConfirm={() => {
          const act = pendingLeaveAction.current;
          setConfirmOpen(false);
          pendingLeaveAction.current = null;
          act?.();
        }}
      />
    </div>
  );
}

// ======== Minimal confirm modal (inline component) ========
function ConfirmLeave({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "90vw",
          background: "#0b1020",
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Leave session?</h3>
        <p style={{ opacity: 0.9 }}>
          Your current session will stop. Are you sure you want to leave?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              fontWeight: 800,
              padding: "8px 12px",
              borderRadius: 10,
              border: "2px solid #22d3ee",
              background: "#06202a",
              color: "white",
            }}
          >
            Yes, leave
          </button>
        </div>
      </div>
    </div>
  );
}
