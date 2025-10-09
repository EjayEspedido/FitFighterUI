import React from "react";
import { useHeartRate } from "../apis/HeartRateProvider";

export default function TopBarHR() {
  const { bpm, deviceName, connected, connecting, error, connect, disconnect } =
    useHeartRate();

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "#0b1220",
        color: "#e5e7eb",
        padding: "8px 12px",
        borderBottom: "1px solid #1f2937",
      }}
    >
      <span style={{ opacity: 0.7, fontSize: 12 }}>HRM</span>
      <strong style={{ fontVariantNumeric: "tabular-nums" }}>
        {bpm ?? "—"} bpm
      </strong>
      <span style={{ opacity: 0.7, fontSize: 12 }}>
        {connected ? deviceName ?? "Connected" : "Disconnected"}
      </span>
      {error && (
        <span style={{ color: "rgb(248,113,113)", fontSize: 12 }}>
          • {error}
        </span>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={connect}
          disabled={connecting || connected}
          style={btn}
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
        <button onClick={disconnect} disabled={!connected} style={btnOutline}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 10px",
  background: "#10b981",
  color: "#00110a",
  border: "none",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};
