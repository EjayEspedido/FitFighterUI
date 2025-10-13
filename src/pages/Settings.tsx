// src/pages/Settings.tsx
import React, { useMemo, useState } from "react";
import HRMPanel from "../components/HRMPanel"; // no .tsx in import
import { useRaspi } from "../apis/RaspiComboWSContext";

type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export default function Settings() {
  const { connected, lastCombo, requestCombo } = useRaspi();
  const [testLevel, setTestLevel] = useState<Level>("Beginner");

  const wsUrl = useMemo(
    () =>
      (import.meta as any)?.env?.VITE_RASPI_WS_URL ??
      "ws://raspberrypi.local:8765",
    []
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 24 }}>
      <h1 style={{ margin: 0 }}>Settings</h1>

      {/* 🔌 Raspberry Pi Link */}
      <section
        style={{
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 16,
          background: "#0b1220",
          color: "#e5e7eb",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Raspberry Pi Link</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            title={connected ? "Connected" : "Disconnected"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: connected ? "#10b981" : "#ef4444",
              boxShadow: connected
                ? "0 0 10px rgba(16,185,129,0.7)"
                : "0 0 10px rgba(239,68,68,0.6)",
            }}
          />
          <div>
            Status: <b>{connected ? "Connected" : "Disconnected"}</b>
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
          WS URL: <code>{String(wsUrl)}</code>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 14 }}>
            Test Level:&nbsp;
            <select
              value={testLevel}
              onChange={(e) => setTestLevel(e.target.value as Level)}
              style={selectStyle}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>Expert</option>
            </select>
          </label>
          <button
            onClick={() => requestCombo(testLevel)}
            style={btnPrimary}
            disabled={!connected}
            title={
              connected ? "Request a test combo from the Pi" : "Not connected"
            }
          >
            Request Test Combo
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Last Combo
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              border: "1px solid #1f2937",
              borderRadius: 10,
              background: "#0f172a",
              fontSize: 13,
              overflowX: "auto",
            }}
          >
            {lastCombo ? JSON.stringify(lastCombo) : "—"}
          </pre>
        </div>
      </section>

      {/* 💓 Bluetooth Heart Rate */}
      <section
        style={{
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 16,
          background: "#0b1220",
          color: "#e5e7eb",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Bluetooth Heart Rate</h2>
        <HRMPanel />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Tip: Web Bluetooth works on HTTPS or on <code>http://localhost</code>.
          Click Connect, then select your HRM device.
        </div>
      </section>
    </div>
  );
}

/* --- tiny styles --- */
const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#00110a",
  border: "none",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "6px 8px",
  fontWeight: 700,
};
