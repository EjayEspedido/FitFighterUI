import React, { useCallback, useEffect, useMemo, useState } from "react";

type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

interface StartScreenComboProps {
  level: Level | string;
  auraPoints: number;
  durationSec: number; // gameplay duration in seconds
  onDurationChange: (sec: number) => void; // called whenever user edits duration
  onStart: () => void; // begin game (Show Phase)
  onExit: () => void; // back to menu
  onLevelChange?: (lvl: Level) => void; // optional: show a level selector if provided
  heartRate?: number | null; // optional HR display
  minDurationSec?: number; // default 60
  maxDurationSec?: number; // default 3600
  stepSec?: number; // default 30 (for +/- buttons)
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const pad2 = (n: number) => String(n).padStart(2, "0");

const parseMMSS = (text: string): number | null => {
  const cleaned = text.trim();
  const m = /^(\d{1,2})[:：](\d{1,2})$/.exec(cleaned);
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  if (Number.isNaN(mm) || Number.isNaN(ss) || ss > 59) return null;
  return mm * 60 + ss;
};

const formatMMSS = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad2(m)}:${pad2(s)}`;
};

const StartScreenCombo: React.FC<StartScreenComboProps> = ({
  level,
  auraPoints,
  durationSec,
  onDurationChange,
  onStart,
  onExit,
  onLevelChange,
  heartRate = null,
  minDurationSec = 60,
  maxDurationSec = 3600,
  stepSec = 30,
}) => {
  // Local text state for mm:ss field (keeps user input friendly)
  const [mmss, setMmss] = useState(formatMMSS(durationSec));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // keep input synced if parent changes duration
    setMmss(formatMMSS(durationSec));
  }, [durationSec]);

  // Keyboard: Enter = start, Esc = exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleStart();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]); // handleStart is stable below

  const handleCommitText = useCallback(
    (text: string) => {
      const parsed = parseMMSS(text);
      if (parsed == null) {
        setError("Use mm:ss (e.g., 03:00)");
        return;
      }
      const clamped = clamp(parsed, minDurationSec, maxDurationSec);
      if (clamped !== parsed) {
        setError(
          `Duration must be between ${formatMMSS(
            minDurationSec
          )} and ${formatMMSS(maxDurationSec)}`
        );
      } else {
        setError(null);
      }
      onDurationChange(clamped);
      setMmss(formatMMSS(clamped));
    },
    [minDurationSec, maxDurationSec, onDurationChange]
  );

  const nudge = useCallback(
    (delta: number) => {
      const next = clamp(durationSec + delta, minDurationSec, maxDurationSec);
      onDurationChange(next);
      setMmss(formatMMSS(next));
      setError(null);
    },
    [durationSec, minDurationSec, maxDurationSec, onDurationChange]
  );

  const handleStart = useCallback(() => {
    // validate current text before starting
    const parsed = parseMMSS(mmss);
    if (parsed == null) {
      setError("Use mm:ss (e.g., 03:00)");
      return;
    }
    const clamped = clamp(parsed, minDurationSec, maxDurationSec);
    onDurationChange(clamped);
    setError(null);
    onStart();
  }, [mmss, minDurationSec, maxDurationSec, onDurationChange, onStart]);

  const canStart = useMemo(
    () => error == null && durationSec >= minDurationSec,
    [error, durationSec, minDurationSec]
  );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 920,
        border: "1px solid #1f2937",
        borderRadius: 16,
        padding: 24,
        background:
          "linear-gradient(180deg, rgba(17,24,39,0.8) 0%, rgba(2,6,23,0.9) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 16,
      }}
    >
      <h2 style={{ margin: 0, color: "#34d399" }}>Combo Mode — Setup</h2>

      {/* Top badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <Info label="Level">
          {onLevelChange ? (
            <select
              value={String(level)}
              onChange={(e) => onLevelChange(e.target.value as Level)}
              style={selectStyle}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>Expert</option>
            </select>
          ) : (
            <strong style={{ fontSize: 18 }}>{String(level)}</strong>
          )}
        </Info>

        <Info label="Aura Points">
          <strong style={{ fontSize: 18 }}>{auraPoints}</strong>
        </Info>

        <Info label="Heart Rate">
          <strong style={{ fontSize: 18 }}>{heartRate ?? "—"} bpm</strong>
        </Info>
      </div>

      {/* Duration editor */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          background: "#0b1220",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <button
          onClick={() => nudge(-stepSec)}
          style={btnGhost}
          aria-label={`- ${stepSec}s`}
        >
          –{stepSec}s
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            Duration (mm:ss)
          </div>
          <input
            inputMode="numeric"
            aria-label="Duration (mm:ss)"
            value={mmss}
            onChange={(e) => setMmss(e.target.value)}
            onBlur={(e) => handleCommitText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
                e.preventDefault();
              }
            }}
            placeholder="03:00"
            style={inputStyle}
          />
          {error && (
            <div style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>
              {error}
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
            Range: {formatMMSS(minDurationSec)}–{formatMMSS(maxDurationSec)}
          </div>
        </div>

        <button
          onClick={() => nudge(+stepSec)}
          style={btnGhost}
          aria-label={`+ ${stepSec}s`}
        >
          +{stepSec}s
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={handleStart} style={btnPrimary} disabled={!canStart}>
          Start
        </button>
        <button onClick={onExit} style={btnOutline}>
          Exit
        </button>
      </div>

      <p style={{ opacity: 0.7, marginTop: 8, textAlign: "center" }}>
        Tip: press <b>Enter</b> to start, <b>Esc</b> to exit.
      </p>
    </div>
  );
};

export default StartScreenCombo;

/* ---------- Small UI pieces ---------- */

const Info: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div
    style={{
      background: "#0b1220",
      border: "1px solid #1f2937",
      borderRadius: 12,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minHeight: 66,
      justifyContent: "center",
    }}
  >
    <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
    <div>{children}</div>
  </div>
);

const btnPrimary: React.CSSProperties = {
  padding: "10px 16px",
  background: "#10b981",
  color: "#00110a",
  border: "none",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
  minWidth: 120,
};

const btnOutline: React.CSSProperties = {
  padding: "10px 16px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 120,
};

const btnGhost: React.CSSProperties = {
  padding: "10px 14px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "8px 10px",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: 140,
  textAlign: "center" as const,
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 900,
  fontSize: 24,
  letterSpacing: 1,
  fontVariantNumeric: "tabular-nums",
};
