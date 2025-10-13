// PadVisualizer.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";

interface PadVisualizerProps {
  sequence: number[];
  activeIndex: number;
  onAdvance: () => void;
  missFlash?: boolean;
  mode?: "show" | "hit"; // 👈 NEW
}

const padLayout: (number | null)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, null, 8],
];

const boxStyle: CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 16,
  border: "4px solid #4b5563",
  background: "#111827",
  color: "#ffffff",
  fontSize: 28,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
  transition:
    "transform 180ms ease, filter 180ms ease, background 180ms ease, border-color 180ms ease",
};

const activeStyleShow: CSSProperties = {
  // Blue for SHOW phase
  background: "#60a5fa",
  border: "4px solid #3b82f6",
  color: "#0b1220",
};

const activeStyleHit: CSSProperties = {
  // Green for HIT phase
  background: "#34d399",
  border: "4px solid #10b981",
  color: "#0b1b12",
};

const spacerStyle: CSSProperties = { width: 96, height: 96 };
const rowStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  justifyContent: "center",
};
const rootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 24,
};

const PadVisualizer: React.FC<PadVisualizerProps> = ({
  sequence,
  activeIndex,
  onAdvance,
  missFlash,
  mode = "hit", // default to HIT styling if not provided
}) => {
  const activePad = sequence[activeIndex];
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") onAdvance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAdvance]);

  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 220);
    return () => clearTimeout(t);
  }, [activeIndex]);

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes padPulse {
          0%   { box-shadow: 0 0 14px rgba(16,185,129,0.35), 0 0 0 rgba(16,185,129,0); transform: scale(1.00); }
          50%  { box-shadow: 0 0 28px rgba(16,185,129,0.85), 0 0 60px rgba(16,185,129,0.30); transform: scale(1.04); }
          100% { box-shadow: 0 0 14px rgba(16,185,129,0.35), 0 0 0 rgba(16,185,129,0); transform: scale(1.00); }
        }
        @keyframes padPulseBlue {
          0%   { box-shadow: 0 0 14px rgba(59,130,246,0.35), 0 0 0 rgba(59,130,246,0); transform: scale(1.00); }
          50%  { box-shadow: 0 0 28px rgba(59,130,246,0.85), 0 0 60px rgba(59,130,246,0.30); transform: scale(1.04); }
          100% { box-shadow: 0 0 14px rgba(59,130,246,0.35), 0 0 0 rgba(59,130,246,0); transform: scale(1.00); }
        }
        @keyframes padFlash {
          0%   { filter: brightness(1.7); transform: scale(1.08); }
          100% { filter: brightness(1.0); transform: scale(1.00); }
        }
        @keyframes padMiss {
          0%   { box-shadow: 0 0 20px rgba(239,68,68,0.85); transform: translateX(0) scale(1.02); }
          25%  { transform: translateX(-5px) scale(1.02); }
          50%  { transform: translateX(5px) scale(1.02); }
          75%  { transform: translateX(-3px) scale(1.02); }
          100% { box-shadow: 0 0 0 rgba(239,68,68,0); transform: translateX(0) scale(1.00); }
        }
        .pad-active-hit  { animation: padPulse 1.2s ease-in-out infinite; }
        .pad-active-show { animation: padPulseBlue 1.2s ease-in-out infinite; }
        .pad-flash  { animation: padFlash 180ms ease-out; }
        .pad-miss   { animation: padMiss 260ms ease-out; background: #ef4444 !important; border-color: #b91c1c !important; color: #fff !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {padLayout.map((row, rIdx) => (
          <div key={rIdx} style={rowStyle}>
            {row.map((pad, cIdx) => {
              if (!pad) return <div key={cIdx} style={spacerStyle} />;
              const isActive = pad === activePad;
              const classes = [
                isActive
                  ? mode === "show"
                    ? "pad-active-show"
                    : "pad-active-hit"
                  : "",
                isActive && flash ? "pad-flash" : "",
                isActive && missFlash ? "pad-miss" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={cIdx}
                  className={classes}
                  style={{
                    ...boxStyle,
                    ...(isActive
                      ? mode === "show"
                        ? activeStyleShow
                        : activeStyleHit
                      : {}),
                  }}
                >
                  {pad}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PadVisualizer;
