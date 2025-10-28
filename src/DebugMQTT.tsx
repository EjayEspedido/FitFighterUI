// src/pages/DebugMQTT.tsx
import { useEffect, useMemo, useState } from "react";
import { usePadInput } from "../apis/RigInputProvider";
import type { PadEvent } from "../apis/rigMqtt";

export default function DebugMQTT() {
  const { addListener, rigId, setRigId, connected, last } = usePadInput();

  // local input = editable text field for rig id
  const [input, setInput] = useState<string>(rigId || "rig-ff-001");
  const [log, setLog] = useState<string[]>([]);

  // keep input in sync if rigId changes externally
  useEffect(() => {
    if (rigId && rigId !== input) setInput(rigId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigId]);

  // subscribe to pad events (effect returns a real cleanup, not a Promise)
  useEffect(() => {
    const unsub = addListener((e: PadEvent) => {
      setLog((old) =>
        [`pad:${e.pad}  seq:${e.seq}  ts:${e.ts}`, ...old].slice(0, 50)
      );
    });
    return unsub;
  }, [addListener]);

  const statusChip = useMemo(
    () => (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 999,
          background: connected ? "#18392b" : "#3a1f1f",
          color: connected ? "#34d399" : "#fca5a5",
          fontSize: 12,
        }}
      >
        {connected ? "Connected" : "Disconnected"}
      </span>
    ),
    [connected]
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, color: "#e5e7eb" }}>
      <h1 style={{ margin: 0 }}>MQTT Debug</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 14, opacity: 0.85 }}>Rig ID</label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="rig-ff-001"
          style={{
            background: "#0b0f1a",
            color: "white",
            border: "1px solid #1f2937",
            borderRadius: 8,
            padding: "6px 10px",
            minWidth: 180,
            outline: "none",
          }}
        />
        <button
          onClick={() => setRigId(input)}
          style={{
            background: "#111827",
            color: "white",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          {connected && rigId === input ? "Reconnect" : "Connect"}
        </button>
        <div style={{ marginLeft: 8 }}>{statusChip}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>
            Current
          </div>
          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: 12,
              minHeight: 72,
              lineHeight: 1.5,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              color: "#a7f3d0",
            }}
          >
            {last ? `pad:${last.pad}  seq:${last.seq}  ts:${last.ts}` : "—"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Subscribed to <code>rig/{rigId ?? input}/events</code>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>
            Recent (latest first)
          </div>
          <pre
            style={{
              background: "#0b0b0b",
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: 12,
              height: 240,
              overflow: "auto",
              margin: 0,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              color: "#86efac",
            }}
          >
            {log.join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}
