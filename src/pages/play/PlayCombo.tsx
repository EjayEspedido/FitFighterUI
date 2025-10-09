// src/pages/PlayCombo.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom"; // ✅ navigate to menu
import PadVisualizer from "../components/PadVisualizer";
import EndScreen from "../components/EndScreen";
import StartScreen from "../components/StartScreenCombo";
import HRMPanel from "../components/HRMPanel";

// ------- Config -------
const PREP_SECONDS = 20;
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

  const currentSet = sets[setIdx] ?? [];
  const activePad = currentSet[stepIdx];

  // -------- Heart Rate integration --------
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const hrSamplesRef = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("prep");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Stable onBpm to avoid reconnects in HRMPanel
  const handleBpm = useCallback((val: number) => {
    setCurrentHR(val);
    if (phaseRef.current === "playing") {
      hrSamplesRef.current.push(val);
    }
  }, []);

  // Live avg/max HR
  const { avgHR, maxHR } = useMemo(() => {
    const arr = hrSamplesRef.current;
    if (!arr.length)
      return { avgHR: null as number | null, maxHR: null as number | null };
    const max = arr.reduce((a, b) => (b > a ? b : a), arr[0]);
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return { avgHR: avg, maxHR: max };
  }, [currentHR, phase === "ended"]);

  // -------- Set progression (stage + commit) --------
  const nextSetIdxRef = useRef<number | null>(null); // stage next set here

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

  // Single path to advance within a set, with debounce/lock
  const transitioningRef = useRef(false);
  const lastAdvanceAtRef = useRef(0);
  const goNext = useCallback(() => {
    const now = performance.now();
    if (transitioningRef.current) return;
    if (now - lastAdvanceAtRef.current < 40) return; // debounce
    lastAdvanceAtRef.current = now;

    setStepIdx((i) => {
      const next = i + 1;
      if (next >= currentSet.length) {
        if (setIdx + 1 >= sets.length) {
          setPhase("ended");
        } else {
          // Stage next set; do NOT increment setIdx now
          nextSetIdxRef.current = setIdx + 1;
          transitioningRef.current = true;
          setPhase("rest");
          setTimeout(() => {
            transitioningRef.current = false;
          }, 0);
        }
        return i; // freeze until phase changes
      }
      return next;
    });
  }, [currentSet.length, setIdx, sets.length]);

  // -------- Keyboard handling (mount once) --------
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
        return; // StartScreen continues itself
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

  // -------- Navigation: EndScreen -> Start menu --------
  const navigate = useNavigate();
  const MENU_PATH = "/"; // 👈 change to your actual start menu route
  const onRestart = () => {
    navigate(MENU_PATH);
  };

  // -------- End screen --------
  if (phase === "ended") {
    return (
      <EndScreen
        score={score}
        misses={misses}
        maxCombo={maxCombo}
        avgHR={avgHR}
        maxHR={maxHR}
        onRestart={onRestart} // ✅ navigates to start menu
      />
    );
  }

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
          <div style={{ fontWeight: 800, fontSize: 18 }}>Intermediate</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Current Heart Rate</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {currentHR ?? "—"} bpm
          </div>
        </div>
        <div style={{ textAlign: "right", opacity: 0.85 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Session</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            Set {setIdx + 1}/{sets.length}
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
            duration={PREP_SECONDS}
            onStart={() => setPhase("playing")}
            onExit={() => setPhase("ended")}
            level="Intermediate"
            heartRate={currentHR}
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
            <PadVisualizer
              sequence={currentSet}
              activeIndex={stepIdx}
              onAdvance={() => {
                /* scoring stays on 1–8 keys only */
              }}
              missFlash={missFlash}
            />
            <p style={{ opacity: 0.7, marginTop: 6 }}>
              Hit pads with <b>1–8</b> (number row or numpad). Menu navigation
              is locked.
            </p>
          </>
        )}

        {/* HR panel */}
        <div style={{ marginTop: 4, width: "100%", maxWidth: 920 }}>
          <HRMPanel onBpm={handleBpm} />
        </div>
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
