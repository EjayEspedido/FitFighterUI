// src/pages/play/PlayCombo.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import PadVisualizer from "../../components/PadVisualizer";
import EndScreen from "../../components/EndScreen";
import StartScreen from "../../components/StartScreenCombo";
import { useRaspi } from "../../apis/RaspiComboWSContext";

const DEFAULT_DURATION_SEC = 180;
const SHOW_INTERVAL_MS = 450;
const SHOW_HOLD_MS = 220;
const BETWEEN_COMBOS_PAUSE_MS = 400;

const BASE_HIT_POINTS = 100;
const COMBO_BONUS_PER_HIT = 10;

type Phase = "setup" | "show" | "hit" | "ended";
type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

const DEFAULT_COMBOS: Record<Level, number[][]> = {
  Beginner: [
    [1, 1, 3],
    [1, 2, 1],
    [2, 2, 3],
    [1, 3, 2],
  ],
  Intermediate: [
    [1, 3, 5],
    [2, 2, 3, 2, 3],
    [1, 4, 7, 6, 5],
    [3, 3, 1, 2],
  ],
  Advanced: [
    [1, 2, 1, 2, 3],
    [2, 3, 4, 3, 2],
    [5, 5, 3, 1, 2, 1],
  ],
  Expert: [
    [1, 2, 3, 2, 1, 4, 6, 8],
    [8, 6, 4, 2, 1, 3, 5, 7],
    [1, 1, 2, 2, 3, 3, 2, 1],
  ],
};

const BLUE = { r: 0, g: 0, b: 255 };
const GREEN = { r: 0, g: 255, b: 0 };
const RED = { r: 255, g: 0, b: 0 };

interface PlayComboProps {
  combosByLevel?: Record<Level, number[][]>;
  auraPoints?: number;
  initialLevel?: Level;
  raspiLights?: {
    onOneStrip?: (
      pad: number,
      color: { r: number; g: number; b: number }
    ) => void;
    offOneStrip?: (pad: number) => void;
    onAll?: (color: { r: number; g: number; b: number }) => void;
    offAll?: () => void;
    flashPad?: (
      pad: number,
      color: { r: number; g: number; b: number },
      ms: number
    ) => void;
  };
}

const PlayCombo: React.FC<PlayComboProps> = ({
  combosByLevel = DEFAULT_COMBOS,
  auraPoints = 0,
  initialLevel = "Beginner",
  raspiLights,
}) => {
  const [phase, setPhase] = useState<Phase>("setup");
  const [level, setLevel] = useState<Level>(initialLevel);
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);

  const [gameEndsAt, setGameEndsAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(durationSec);

  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combosCleared, setCombosCleared] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [missFlash, setMissFlash] = useState(false);

  const [currentCombo, setCurrentCombo] = useState<number[]>([]);
  const [showIdx, setShowIdx] = useState(0);
  const [hitIdx, setHitIdx] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const phaseRef = useRef<Phase>("setup");
  const currentComboRef = useRef<number[]>([]);
  const hitIdxRef = useRef(0);
  const showIdxRef = useRef(0);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    currentComboRef.current = currentCombo;
  }, [currentCombo]);
  useEffect(() => {
    hitIdxRef.current = hitIdx;
  }, [hitIdx]);
  useEffect(() => {
    showIdxRef.current = showIdx;
  }, [showIdx]);

  // 🔌 RasPi WS from context (hook is used in Settings, provider shares it)
  const { connected, lastCombo, requestCombo, reportResult } = useRaspi();
  const lastComboRef = useRef<number[] | null>(null);
  useEffect(() => {
    lastComboRef.current = lastCombo;
  }, [lastCombo]);

  const pickRandomComboLocal = useCallback((): number[] => {
    const pool = combosByLevel[level] ?? [];
    if (!pool.length) return [1, 2, 3];
    return [...pool[Math.floor(Math.random() * pool.length)]];
  }, [combosByLevel, level]);

  const getComboFromRaspi = useCallback(async (): Promise<number[]> => {
    const start = lastComboRef.current
      ? JSON.stringify(lastComboRef.current)
      : null;
    if (!connected) return pickRandomComboLocal();

    requestCombo(level);
    const deadline = Date.now() + 1200;
    while (Date.now() < deadline) {
      await sleep(40);
      const cur = lastComboRef.current
        ? JSON.stringify(lastComboRef.current)
        : null;
      if (cur && cur !== start) {
        try {
          const parsed = JSON.parse(cur);
          if (Array.isArray(parsed)) return parsed as number[];
        } catch {}
      }
    }
    return pickRandomComboLocal();
  }, [connected, level, requestCombo, pickRandomComboLocal]);

  // Countdown
  useEffect(() => {
    if (phase === "setup" || phase === "ended" || !gameEndsAt) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((gameEndsAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) setPhase("ended");
    }, 250);
    return () => clearInterval(t);
  }, [phase, gameEndsAt]);

  const fmtMMSS = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0"
    )}`;

  // Start
  const startGame = useCallback(async () => {
    setTimeLeft(durationSec);
    setScore(0);
    setMisses(0);
    setCombosCleared(0);
    setMaxCombo(0);

    const firstCombo = await getComboFromRaspi();
    setCurrentCombo(firstCombo);
    setShowIdx(0);
    setHitIdx(0);
    setActiveIndex(0);

    setGameEndsAt(Date.now() + durationSec * 1000);
    setPhase("show");
  }, [durationSec, getComboFromRaspi]);

  // SHOW
  useEffect(() => {
    if (phase !== "show") return;
    let cancelled = false;

    const runShow = async () => {
      const seq = currentComboRef.current;
      raspiLights?.offAll?.();

      for (let i = 0; i < seq.length; i++) {
        if (cancelled || phaseRef.current !== "show") return;
        const pad = seq[i];
        setShowIdx(i);
        setActiveIndex(i);

        raspiLights?.onOneStrip?.(pad, BLUE);
        await sleep(SHOW_HOLD_MS);
        raspiLights?.offOneStrip?.(pad);
        await sleep(SHOW_INTERVAL_MS);
      }

      if (cancelled || phaseRef.current !== "show") return;
      raspiLights?.onAll?.(BLUE);
      await sleep(180);
      raspiLights?.offAll?.();
      setHitIdx(0);
      setActiveIndex(0);
      setPhase("hit");
    };

    runShow();
    return () => {
      cancelled = true;
    };
  }, [phase, currentCombo, raspiLights]);

  // HIT
  useEffect(() => {
    if (phase !== "hit") return;

    const normalize = (e: KeyboardEvent): number | null => {
      if (/^[1-8]$/.test(e.key)) return parseInt(e.key, 10);
      const m = /^Numpad([1-8])$/.exec(e.code || "");
      return m ? parseInt(m[1], 10) : null;
    };

    const onKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat || phaseRef.current !== "hit") return;
      const pad = normalize(e);
      if (pad == null) return;
      e.preventDefault();
      e.stopPropagation();

      const seq = currentComboRef.current;
      const idx = hitIdxRef.current;
      const expected = seq[idx];

      if (pad === expected) {
        raspiLights?.flashPad?.(pad, GREEN, 250);
        reportResult({ correct: true, pad, idx });

        setScore((s) => s + BASE_HIT_POINTS + COMBO_BONUS_PER_HIT * idx);
        const nextIdx = idx + 1;
        setHitIdx(nextIdx);
        setActiveIndex(nextIdx);

        if (nextIdx >= seq.length) {
          setCombosCleared((c) => {
            const nc = c + 1;
            setMaxCombo((m) => Math.max(m, nc));
            return nc;
          });
          raspiLights?.onAll?.(GREEN);
          await sleep(BETWEEN_COMBOS_PAUSE_MS);
          raspiLights?.offAll?.();

          if (phaseRef.current !== "hit") return;
          const next = await getComboFromRaspi();
          setCurrentCombo(next);
          setShowIdx(0);
          setHitIdx(0);
          setActiveIndex(0);
          setPhase("show");
        }
      } else {
        setMisses((m) => m + 1);
        setMissFlash(true);
        raspiLights?.flashPad?.(pad, RED, 350);
        setTimeout(() => setMissFlash(false), 220);
        reportResult({ correct: false, pad, idx });

        if (level === "Advanced" || level === "Expert") {
          setHitIdx(0);
          setActiveIndex(0);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [phase, level, getComboFromRaspi, raspiLights, reportResult]);

  // Exit / End
  const navigate = useNavigate();
  const goToMenu = useCallback(() => navigate("/modes"), [navigate]);

  const seqForViz = useMemo(
    () => (currentCombo.length ? currentCombo : [1]),
    [currentCombo]
  );

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
      {/* HUD */}
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Level</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{level}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Aura Points</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{auraPoints}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Time Left</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {fmtMMSS(timeLeft)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 980,
        }}
      >
        <Stat label="Score" value={score} />
        <Stat label="Misses" value={misses} />
        <Stat label="Combos Cleared" value={combosCleared} />
      </div>

      {/* Main card */}
      <div
        style={{
          width: "100%",
          maxWidth: 980,
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
        {phase === "setup" && (
          <StartScreen
            level={level}
            auraPoints={auraPoints}
            durationSec={durationSec}
            onDurationChange={setDurationSec}
            onLevelChange={setLevel}
            onStart={() => startGame()}
            onExit={goToMenu}
          />
        )}

        {(phase === "show" || phase === "hit") && (
          <>
            <PadVisualizer
              sequence={seqForViz}
              activeIndex={phase === "show" ? showIdx : hitIdx}
              onAdvance={() => {}}
              missFlash={missFlash}
              mode={phase === "show" ? "show" : "hit"}
            />
            <p style={{ opacity: 0.8, marginTop: 6 }}>
              {phase === "show"
                ? "Watch the pads (Show Phase)"
                : "Repeat the combo (Hit Phase)"}
            </p>
          </>
        )}
      </div>

      {/* Exit below box */}
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button onClick={goToMenu} style={exitBtnInline}>
          Exit
        </button>
      </div>

      {/* End overlay */}
      {phase === "ended" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#000",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EndScreen
            score={score}
            misses={misses}
            maxCombo={maxCombo}
            avgHR={null}
            maxHR={null}
            onRestart={goToMenu}
          />
        </div>
      )}
    </div>
  );
};

export default PlayCombo;

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

const exitBtnInline: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 16px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
