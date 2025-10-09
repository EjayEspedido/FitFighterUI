import React, { useEffect, useState } from "react";

interface StartScreenProps {
  duration?: number; // default 20s
  onStart: () => void; // callback when game should start
  onExit: () => void; // back to menu
  level?: string; // placeholder for current level
  heartRate?: number | null; // optional HR reading
}

const StartScreen: React.FC<StartScreenProps> = ({
  duration = 20,
  onStart,
  onExit,
  level = "Intermediate",
  heartRate = null,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onStart();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onStart]);

  // Allow Enter/Space to trigger Continue
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

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
        alignItems: "center",
        gap: 16,
      }}
    >
      <h2 style={{ margin: 0, color: "#34d399" }}>Get Ready</h2>
      <div style={{ fontSize: 64, fontWeight: 900 }}>{secondsLeft}s</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Level</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{level}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Heart Rate</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {heartRate ?? "—"} bpm
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button onClick={onStart} style={btnPrimary}>
          Continue
        </button>
        <button onClick={onExit} style={btnGhost}>
          Exit
        </button>
      </div>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        Navigation is disabled. Press <b>Enter</b> to continue.
      </p>
    </div>
  );
};

export default StartScreen;

// --- Buttons ---
const btnPrimary: React.CSSProperties = {
  padding: "10px 16px",
  background: "#10b981",
  color: "#00110a",
  border: "none",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "10px 16px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};
