// PadVisualizer.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePadInput } from "../apis/RigInputProvider"; // ← add this import

type PadVisualizerProps = {
  /** If provided, component becomes controlled and will just mirror this pad (1..8) */
  activePad?: number | null;
  /** How long each flash lasts (ms) */
  flashMs?: number;
  /** Listen to keyboard keys 1..8 */
  listenKeys?: boolean;
  /** Listen to a window CustomEvent with detail { pad: number } */
  listenCustomEvent?: boolean;
  /** Name of the CustomEvent to listen to */
  customEventName?: string;
  /** Optional remapper for keyboard -> pad number (return null to ignore) */
  mapKeyToPad?: (e: KeyboardEvent) => number | null;
  /** Listen to MQTT via RigInputProvider */
  listenMqtt?: boolean;
};

const padLayout: (number | null)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, null, 8],
];

const BOX = 96;

const boxStyle: CSSProperties = {
  width: BOX,
  height: BOX,
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
  transition: "transform 180ms ease, filter 180ms ease",
};

const activeBoxStyle: CSSProperties = {
  background: "#34d399",
  border: "4px solid #10b981",
  color: "#0b1b12",
};

const spacerStyle: CSSProperties = { width: BOX, height: BOX };
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

const defaultMapKeyToPad = (e: KeyboardEvent): number | null => {
  const n = parseInt(e.key, 10);
  return n >= 1 && n <= 8 ? n : null;
};

const PadVisualizer: React.FC<PadVisualizerProps> = ({
  activePad: controlledActivePad,
  flashMs = 150,
  listenKeys = true,
  listenCustomEvent = true,
  customEventName = "pad-hit",
  mapKeyToPad = defaultMapKeyToPad,
  listenMqtt = true, // ← default ON
}) => {
  const { addListener, connected, rigId } = usePadInput(); // ← use MQTT ctx
  const [uncontrolledPad, setUncontrolledPad] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const isControlled = useMemo(
    () => controlledActivePad !== undefined,
    [controlledActivePad]
  );
  const activePad = isControlled ? controlledActivePad! : uncontrolledPad;

  const flash = (pad: number) => {
    if (pad < 1 || pad > 8) return;
    // clear previous timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setUncontrolledPad(pad);
    timerRef.current = window.setTimeout(() => {
      setUncontrolledPad(null);
      timerRef.current = null;
    }, flashMs) as unknown as number;
  };

  // Keyboard listener
  useEffect(() => {
    if (!listenKeys || isControlled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const pad = mapKeyToPad(e);
      if (pad) flash(pad);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [listenKeys, isControlled, mapKeyToPad, flashMs]);

  // Custom event listener
  useEffect(() => {
    if (!listenCustomEvent || isControlled) return;
    const onPadEvent = (e: Event) => {
      const ce = e as CustomEvent<{ pad?: number }>;
      const pad = ce.detail?.pad;
      if (typeof pad === "number") flash(pad);
    };
    window.addEventListener(customEventName, onPadEvent as EventListener);
    return () =>
      window.removeEventListener(customEventName, onPadEvent as EventListener);
  }, [listenCustomEvent, isControlled, customEventName, flashMs]);

  // MQTT listener via RigInputProvider
  useEffect(() => {
    if (!listenMqtt || isControlled) return;
    // subscribe; addListener returns an unsubscribe
    const unsubscribe = addListener?.((e) => {
      if (typeof e.pad === "number") flash(e.pad);
    });
    return () => {
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [listenMqtt, isControlled, addListener, flashMs]);

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes padFlash {
          0%   { filter: brightness(1.7); transform: scale(1.08); }
          100% { filter: brightness(1.0); transform: scale(1.00); }
        }
        .pad-active { animation: padFlash 180ms ease-out; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {padLayout.map((row, rIdx) => (
          <div key={rIdx} style={rowStyle}>
            {row.map((pad, cIdx) => {
              if (!pad) return <div key={cIdx} style={spacerStyle} />;
              const isActive = pad === activePad;
              return (
                <div
                  key={cIdx}
                  className={isActive ? "pad-active" : ""}
                  style={{ ...boxStyle, ...(isActive ? activeBoxStyle : {}) }}
                >
                  {pad}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Little status hint when uncontrolled */}
      {!isControlled && (
        <p style={{ color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
          {[
            listenMqtt
              ? `MQTT ${connected ? "● connected" : "○ offline"} (${
                  rigId || "–"
                })`
              : null,
            listenKeys ? "Keys 1–8" : null,
            listenCustomEvent ? `CustomEvent "${customEventName}"` : null,
          ]
            .filter(Boolean)
            .join(" • ")}{" "}
          will flash pads
        </p>
      )}
    </div>
  );
};

export default PadVisualizer;
