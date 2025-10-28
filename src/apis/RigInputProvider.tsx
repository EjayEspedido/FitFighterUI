import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connectRig } from "../apis/rigMqtt"; // adjust path if needed
import type { PadEvent } from "../apis/rigMqtt";

/**
 * RigInputProvider (patched)
 *
 * - Normalizes incoming messages from the MQTT bridge into a single PadEvent shape.
 * - Dedupes using `seq` when available; otherwise uses a time-window per-pad.
 * - Ensures listeners are called exactly once per physical event (dispatch cache).
 * - Provides a debug panel showing last raw/normalized messages.
 */

/* types */
type Listener = (e: PadEvent & { origin?: string; raw?: any }) => void;
type RigInputCtx = {
  connected: boolean;
  rigId: string | null;
  setRigId: (id: string) => void;
  addListener: (fn: Listener) => () => void;
  last: (PadEvent & { origin?: string; raw?: any }) | null;
  // debug helpers
  debugMessages: Array<{ raw: any; normalized?: any; ts: number }>;
  toggleDebug: () => void;
};

const Ctx = createContext<RigInputCtx>(null as unknown as RigInputCtx);

/* dedupe config */
const DEDUPE_MS = 80; // ignore same-pad press within 80ms when seq not present
const SEQ_CACHE_TTL_MS = 10_000; // keep seen seqs for 10s to handle republished messages

export function RigInputProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [rigId, setRigIdState] = useState<string | null>(
    () => localStorage.getItem("rigId") || "rig-ff-001"
  );
  const setRigId = (id: string) => {
    setRigIdState(id);
    localStorage.setItem("rigId", id);
  };

  const [last, setLast] = useState<
    (PadEvent & { origin?: string; raw?: any }) | null
  >(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  const addListener = (fn: Listener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  };

  /* dedupe state */
  const seenSeqRef = useRef<Map<string | number, number>>(new Map()); // seqKey -> ts (ms)
  const lastPadTsRef = useRef<Map<number, number>>(new Map()); // pad -> lastTs (ms)

  /* dispatch cache to enforce single-dispatch */
  const dispatchCacheRef = useRef<Map<string, number>>(new Map());

  /* debug UI state */
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugMessages, setDebugMessages] = useState<
    Array<{ raw: any; normalized?: any; ts: number }>
  >([]);

  /* cleanup for seq cache */
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const m = seenSeqRef.current;
      for (const [k, ts] of m.entries()) {
        if (now - ts > SEQ_CACHE_TTL_MS) m.delete(k);
      }
    }, 2000);
    return () => clearInterval(t);
  }, []);

  function pushDebug(raw: any, normalized?: any) {
    setDebugMessages((s) => {
      const next = [{ raw, normalized, ts: Date.now() }, ...s].slice(0, 40);
      return next;
    });
  }

  /* Main normalization + dedupe + single-dispatch logic */
  function handleIncoming(raw: any) {
    try {
      if (!raw) return;

      // Normalize fields
      const obj = raw as any;
      let pad: number | undefined;
      let ts: number | undefined;
      let seq: number | string | undefined;
      let edge: string | undefined;
      let origin: string | undefined;

      if (typeof obj === "object") {
        if (typeof obj.pad !== "undefined") pad = Number(obj.pad);
        if (typeof obj.ts !== "undefined") ts = Number(obj.ts);
        if (typeof obj.seq !== "undefined") seq = obj.seq;
        if (typeof obj.edge !== "undefined") edge = obj.edge;
        if (
          typeof obj.type === "string" &&
          obj.type === "press" &&
          typeof obj.pad !== "undefined"
        ) {
          pad = pad ?? Number(obj.pad);
          ts = ts ?? Number(obj.ts ?? Date.now() / 1000);
          origin = obj.origin ?? obj.origin_prev ?? "ws";
        } else if (!obj.type) {
          origin = obj.origin ?? "mqtt";
        } else {
          origin = obj.origin ?? obj.origin_prev ?? "unknown";
        }
      }

      if (!pad || Number.isNaN(pad)) {
        // not a pad event — still push debug (so you can inspect other events)
        pushDebug(raw, undefined);
        return;
      }

      // convert ts to ms for dedupe comparisons
      const tsMs = ts ? Math.floor((ts as number) * 1000) : Date.now();

      // dedupe by seq if present
      if (typeof seq !== "undefined" && seq !== null) {
        const key = `${rigId ?? "rig?:"}:${String(seq)}`;
        const seenMap = seenSeqRef.current;
        if (seenMap.has(key)) {
          // already seen -> drop
          pushDebug(raw, { droppedReason: "seq_seen", seq, pad, origin });
          return;
        }
        seenMap.set(key, Date.now());
      } else {
        // time-window per pad
        const lastTs = lastPadTsRef.current.get(pad) ?? 0;
        if (tsMs - lastTs < DEDUPE_MS) {
          pushDebug(raw, {
            droppedReason: "time_bucket",
            pad,
            origin,
            tsMs,
            lastTs,
          });
          return;
        }
        lastPadTsRef.current.set(pad, tsMs);
        setTimeout(() => {
          const cur = lastPadTsRef.current.get(pad) ?? 0;
          if (Date.now() - cur > 5000) lastPadTsRef.current.delete(pad);
        }, 6_000);
      }

      // normalized event
      const evt: PadEvent & { origin?: string; raw?: any } = {
        ts: ts ? Number(ts) : Date.now() / 1000,
        pad: pad as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        edge: edge as "down" | "up" | undefined,
        seq: seq as number | undefined,
        raw: raw,
        origin: origin,
      };

      // final dispatch-key (use seq when present; otherwise a pad/time bucket key)
      const dispatchKey =
        typeof seq !== "undefined" && seq !== null
          ? `${rigId ?? "rig?:"}:seq:${String(seq)}`
          : `${rigId ?? "rig?:"}:pad:${pad}:t:${Math.floor(
              tsMs / (DEDUPE_MS || 80)
            )}`;

      // dispatch cache: ensure only one call to listeners per dispatchKey
      const dispatchCache = dispatchCacheRef.current;
      const now = Date.now();
      if (dispatchCache.has(dispatchKey)) {
        const prevTs = dispatchCache.get(dispatchKey) || 0;
        if (now - prevTs < 5000) {
          pushDebug(raw, { droppedReason: "dispatch_cache_hit", evt });
          return;
        }
      }
      dispatchCache.set(dispatchKey, now);
      setTimeout(() => {
        try {
          dispatchCache.delete(dispatchKey);
        } catch {}
      }, 10_000);

      // publish normalized to debug panel
      pushDebug(raw, evt);

      // update last and notify listeners exactly once
      setLast(evt);
      for (const fn of listenersRef.current) {
        try {
          fn(evt);
        } catch (e) {
          console.warn("[RigInputProvider] listener threw:", e);
        }
      }
    } catch (e) {
      console.error("[RigInputProvider] handleIncoming error:", e);
    }
  }

  /* Wire up the MQTT/WS connection using your existing connectRig helper.
     connectRig returns a cleanup function: () => void   */
  useEffect(() => {
    if (!rigId) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const c = await connectRig(
          rigId,
          (e: PadEvent | any) => {
            if (disposed) return;
            handleIncoming(e);
          },
          () => {
            if (!disposed) setConnected(true);
          },
          () => {
            if (!disposed) setConnected(false);
          }
        );
        if (!disposed) {
          cleanup = c;
        } else {
          try {
            c?.();
          } catch {}
        }
      } catch (err) {
        console.error("[RigInput] connect error:", err);
        if (!disposed) setConnected(false);
      }
    })();

    return () => {
      disposed = true;
      try {
        cleanup?.();
      } catch {}
    };
  }, [rigId]);

  const value = useMemo(
    () => ({
      connected,
      rigId,
      setRigId,
      addListener,
      last,
      debugMessages,
      toggleDebug: () => setDebugOpen((s) => !s),
    }),
    [connected, rigId, last, debugMessages]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/** Debug panel: simple overlay you can toggle */}
      {debugOpen ? (
        <div
          style={{
            position: "fixed",
            right: 8,
            top: 8,
            width: 420,
            maxHeight: "70vh",
            overflow: "auto",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            fontSize: 12,
            padding: 8,
            borderRadius: 6,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <strong>Rig Input Debug</strong>
            <button
              onClick={() => setDebugOpen(false)}
              style={{ marginLeft: 8 }}
            >
              Close
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 6 }}>
            connected: {String(connected)} • rigId: {rigId}
          </div>
          <div>
            {debugMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  padding: "6px 0",
                }}
              >
                <div style={{ opacity: 0.7 }}>
                  {new Date(m.ts).toLocaleTimeString()}
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                >
                  raw:{" "}
                  {typeof m.raw === "string" ? m.raw : JSON.stringify(m.raw)}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                >
                  norm: {m.normalized ? JSON.stringify(m.normalized) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setDebugOpen(true)}
          style={{
            position: "fixed",
            right: 8,
            top: 8,
            zIndex: 9999,
            background: "#333",
            color: "#fff",
            border: "none",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          Rig Debug
        </button>
      )}
    </Ctx.Provider>
  );
}

export function usePadInput(): RigInputCtx {
  return useContext(Ctx);
}
