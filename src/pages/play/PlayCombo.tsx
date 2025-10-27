// src/pages/play/PlayCombo.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import EndScreen from "../../components/EndScreen";
import StartScreen, { type Level } from "../../components/StartScreenCombo";
import { useHeartRate } from "../../apis/HeartRateProvider";

// ------- Config -------
const REST_SECONDS = 5;

// Replace with the JSON you pass for the current session
const DEFAULT_SESSION_SETS: number[][] = [
  [1, 1, 3],
  [1, 3, 2],
];

// Scoring
const BASE_HIT_POINTS = 100;
const COMBO_BONUS_PER_HIT = 10;

// ------- Types -------
type Phase = "prep" | "playing" | "rest" | "ended";

interface PlayComboProps {
  sets?: number[][];
}

const PlayCombo: React.FC<PlayComboProps> = ({
  sets = DEFAULT_SESSION_SETS,
}) => {
  // -------- Core state --------
  const [phase, setPhase] = useState<Phase>("prep");
  const [restLeft, setRestLeft] = useState(REST_SECONDS);

  const [setIdx, setSetIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [missFlash, setMissFlash] = useState(false);

  // NEW: user selections
  const [selectedLevel, setSelectedLevel] = useState<Level>("Intermediate");
  const [workoutTotalSec, setWorkoutTotalSec] = useState<number | null>(null);
  const [workoutLeftSec, setWorkoutLeftSec] = useState<number | null>(null);

  const currentSet = sets[setIdx] ?? [];
  const activePad = currentSet[stepIdx];

  // -------- Global Heart Rate --------
  const { bpm: currentHR } = useHeartRate();
  const hrSamplesRef = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("prep");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // HR samples while playing
  useEffect(() => {
    if (phase === "playing" && currentHR != null) {
      hrSamplesRef.current.push(currentHR);
    }
  }, [phase, currentHR]);

  // Live avg/max HR
  const { avgHR, maxHR } = useMemo(() => {
    const arr = hrSamplesRef.current;
    if (!arr.length)
      return { avgHR: null as number | null, maxHR: null as number | null };
    const max = arr.reduce((a, b) => (b > a ? b : a), arr[0]);
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return { avgHR: avg, maxHR: max };
  }, [currentHR, phase === "ended"]);

  // -------- Workout countdown (global) --------
  useEffect(() => {
    if (phase !== "playing" || workoutLeftSec == null) return;
    if (workoutLeftSec <= 0) {
      setPhase("ended");
      return;
    }
    const t = setTimeout(() => setWorkoutLeftSec((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, workoutLeftSec]);

  // -------- Set progression (stage + commit) --------
  const nextSetIdxRef = useRef<number | null>(null);

  // Rest timer: commits staged set index exactly once
  useEffect(() => {
    if (phase !== "rest") return;
    if (restLeft <= 0) {
      if (nextSetIdxRef.current != null) {
        setSetIdx(nextSetIdxRef.current);
        nextSetIdxRef.current = null;
      }
      setStepIdx(0);
      setRestLeft(REST_SECONDS);
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, restLeft]);

  // Single path to advance within a set
  const transitioningRef = useRef(false);
  const lastAdvanceAtRef = useRef(0);
  const goNext = useCallback(() => {
    const now = performance.now();
    if (transitioningRef.current) return;
    if (now - lastAdvanceAtRef.current < 40) return;
    lastAdvanceAtRef.current = now;

    setStepIdx((i) => {
      const next = i + 1;
      if (next >= currentSet.length) {
        // If workout timer is still running, either rest or end
        if (setIdx + 1 >= sets.length) {
          setPhase("ended");
        } else {
          nextSetIdxRef.current = setIdx + 1;
          transitioningRef.current = true;
          setPhase("rest");
          setTimeout(() => {
            transitioningRef.current = false;
          }, 0);
        }
        return i;
      }
      return next;
    });
  }, [currentSet.length, setIdx, sets.length]);

  // -------- Keyboard handling --------
  const activePadRef = useRef<number | undefined>(undefined);
  const comboRef = useRef(0);
  useEffect(() => {
    activePadRef.current = activePad;
  }, [activePad]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    const normalizeKeyToPad = (e: KeyboardEvent): number | null => {
      if (/^[1-8]$/.test(e.key)) return parseInt(e.key, 10);
      const m = /^Numpad([1-8])$/.exec(e.code || "");
      return m ? parseInt(m[1], 10) : null;
    };
    const isNavKey = (e: KeyboardEvent) =>
      e.key === "4" ||
      e.key === "6" ||
      e.key === "7" ||
      e.key === "8" ||
      /^Numpad[4678]$/.test(e.code || "");

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const ph = phaseRef.current;
      if (ph === "prep" || ph === "rest") {
        if (
          isNavKey(e) ||
          /^[1-8]$/.test(e.key) ||
          /^Numpad[1-8]$/.test(e.code || "")
        ) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        return;
      }

      if (ph === "playing") {
        const pad = normalizeKeyToPad(e);
        if (pad == null) {
          if (isNavKey(e)) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();

        const active = activePadRef.current!;
        if (pad === active) {
          const add = BASE_HIT_POINTS + COMBO_BONUS_PER_HIT * comboRef.current;
          setScore((s) => s + add);
          setCombo((c) => {
            const nc = c + 1;
            setMaxCombo((m) => (nc > m ? nc : m));
            comboRef.current = nc;
            return nc;
          });
          setMissFlash(false);
          goNext();
        } else {
          setMisses((m) => m + 1);
          setCombo(0);
          comboRef.current = 0;
          setMissFlash(true);
          setTimeout(() => setMissFlash(false), 220);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [goNext]);

  // Reset step whenever we enter/re-enter playing
  useEffect(() => {
    if (phase === "playing") setStepIdx(0);
  }, [phase]);

  // -------- Navigation --------
  const navigate = useNavigate();
  const MENU_PATH = "/modes";

  const goToMenu = useCallback(() => {
    navigate(MENU_PATH);
  }, [navigate]);

  // -------- End screen --------
  if (phase === "ended") {
    return (
      <EndScreen
        score={score}
        misses={misses}
        maxCombo={maxCombo}
        avgHR={avgHR}
        maxHR={maxHR}
        onRestart={goToMenu}
      />
    );
    // (Optionally pass selectedLevel/workout time to EndScreen if you show them there)
  }

  // Helper to format remaining workout time
  const fmtTime = (sec: number | null) => {
    if (sec == null) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // -------- UI --------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030712",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 24,
        gap: 18,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ opacity: 0.85 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Level</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedLevel}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Current Heart Rate</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {currentHR ?? "—"} bpm
          </div>
        </div>
        <div style={{ textAlign: "right", opacity: 0.85 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Workout Left{" "}
            {workoutTotalSec ? `(${Math.floor(workoutTotalSec / 60)}m)` : ""}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {fmtTime(workoutLeftSec)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 920,
        }}
      >
        <Stat label="Score" value={score} />
        <Stat label="Misses" value={misses} />
        <Stat label="Combo" value={combo} />
        <Stat label="Avg HR" value={avgHR ?? "—"} />
        <Stat label="Max HR" value={maxHR ?? "—"} />
      </div>

      {/* Main area */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 20,
          background:
            "linear-gradient(180deg, rgba(17,24,39,0.8) 0%, rgba(2,6,23,0.9) 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {phase === "prep" && (
          <StartScreen
            heartRate={currentHR}
            onStart={({ level, minutes }) => {
              setSelectedLevel(level);
              const total = minutes * 60;
              setWorkoutTotalSec(total);
              setWorkoutLeftSec(total);
              setPhase("playing");
            }}
            onExit={goToMenu}
            defaultLevel={selectedLevel}
            defaultMinutes={
              workoutTotalSec
                ? Math.max(1, Math.round(workoutTotalSec / 60))
                : 10
            }
          />
        )}

        {phase === "rest" && (
          <>
            <h2 style={{ margin: 0, color: "#60a5fa" }}>Rest</h2>
            <div style={{ fontSize: 56, fontWeight: 900 }}>{restLeft}s</div>
            <p style={{ opacity: 0.7 }}>Next set starts automatically.</p>
          </>
        )}

        {phase === "playing" && (
          <>
            {/* Simple placeholder instead of PadVisualizer */}
            <div
              style={{
                width: "100%",
                minHeight: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #1f2937",
                borderRadius: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  opacity: missFlash ? 0.65 : 1,
                  transition: "opacity 150ms linear",
                }}
              >
                Game ongoing
              </h2>
            </div>
            <p style={{ opacity: 0.7, marginTop: 6 }}>
              Hit pads with <b>1–8</b> (number row or numpad). Menu navigation
              is locked.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayCombo;

// ------- Small UI helpers -------
const Stat: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      background: "#0b1220",
      border: "1px solid #1f2937",
      borderRadius: 12,
      padding: 12,
      lineHeight: 1.1,
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
    <div style={{ fontWeight: 900, fontSize: 24 }}>{value}</div>
  </div>
);
