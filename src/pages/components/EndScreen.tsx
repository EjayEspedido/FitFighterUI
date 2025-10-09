import React from "react";

interface EndScreenProps {
  score: number;
  misses: number;
  maxCombo: number;
  avgHR: number | null;
  maxHR: number | null;
  onRestart: () => void;
}

const EndScreen: React.FC<EndScreenProps> = ({
  score,
  misses,
  maxCombo,
  avgHR,
  maxHR,
  onRestart,
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 36, fontWeight: 900, color: "#34d399" }}>
        Good Job! 🎉
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          background: "#0b1220",
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 20,
          minWidth: 360,
        }}
      >
        <div>
          <div style={{ opacity: 0.7 }}>Score</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{score}</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Misses</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{misses}</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Longest Combo</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{maxCombo}</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Avg Heart Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {avgHR ?? "—"} bpm
          </div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Max Heart Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {maxHR ?? "—"} bpm
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Performance Stats</div>
          <div
            style={{
              background: "#0f172a",
              border: "1px dashed #334155",
              borderRadius: 12,
              padding: 12,
              lineHeight: 1.4,
              opacity: 0.9,
            }}
          >
            Placeholder text: Great pacing! Your reaction time was consistent
            across sets. Consider tightening accuracy on transitions after long
            combos. (Hook up live analytics later.)
          </div>
        </div>
      </div>

      <button
        onClick={onRestart}
        style={{
          padding: "12px 18px",
          background: "#10b981",
          color: "#00110a",
          border: "none",
          borderRadius: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Back to Start
      </button>
    </div>
  );
};

export default EndScreen;
