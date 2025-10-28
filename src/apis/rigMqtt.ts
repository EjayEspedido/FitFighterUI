import mqtt from "mqtt";
import type { IClientOptions, MqttClient } from "mqtt";

/**
 * rigMqtt.ts
 *
 * - connectRig(rigId, onEvent, onConnect?, onClose?) -> Promise<cleanupFn>
 * - Normalizes incoming MQTT payloads and includes provenance:
 *    - origin: "gpio" | "mqtt" | "ws_bridge" | "listener" | etc.
 *    - origin_prev: previous origin if server rewrote origin
 * - For session_end messages we emit a CustomEvent "rig_session_end" on window
 * - For pad/press events we call onEvent(normalizedEvent)
 */

export type PadEvent = {
  ts: number;
  pad: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  edge?: "down" | "up";
  seq?: number;
  raw?: any;
  origin?: string;
  origin_prev?: string;
};

export async function connectRig(
  rigId: string,
  onEvent: (e: PadEvent & { raw?: any }) => void,
  onConnect?: () => void,
  onClose?: () => void
): Promise<() => void> {
  // get short-lived credentials from your backend (same as before)
  const r = await fetch(`/api/mqtt-token?rigId=${encodeURIComponent(rigId)}`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`/api/mqtt-token failed: ${r.status}`);
  const { username, password } = (await r.json()) as {
    username: string;
    password: string;
  };

  const url = import.meta.env.VITE_MQTT_WSS_URL as string;
  if (!url) throw new Error("VITE_MQTT_WSS_URL missing");

  const opts: IClientOptions = {
    clientId: `web-${rigId}-${Math.random().toString(16).slice(2)}`,
    username,
    password,
    keepalive: 30,
    clean: true,
  };

  const client: MqttClient = mqtt.connect(url, opts);

  let isConnected = false;

  function safeParsePayload(buf: Buffer | string) {
    try {
      const s = typeof buf === "string" ? buf : buf.toString();
      return JSON.parse(s);
    } catch (err) {
      try {
        return JSON.parse(String(buf));
      } catch {
        return null;
      }
    }
  }

  client.on("connect", () => {
    client.subscribe(`rig/${rigId}/events`, { qos: 0 }, (err) => {
      if (err) {
        console.error("[MQTT] subscribe error:", err);
      } else {
        isConnected = true;
        onConnect?.();
      }
    });
  });

  client.on("close", () => {
    if (isConnected) {
      isConnected = false;
      onClose?.();
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT] ERROR:", err);
  });

  // old code used client.stream.on("error") — keep that behavior if present
  if ((client as any).stream && (client as any).stream.on) {
    (client as any).stream.on("error", (err: any) =>
      console.error("[STREAM ERROR]", err)
    );
  }

  client.on("message", (_topic: string, msg: Buffer) => {
    const obj = safeParsePayload(msg);
    if (!obj) {
      // Not JSON - skip
      return;
    }

    // If it's an explicit session_end from rig or monitor, dispatch DOM event for app-level handling
    if (obj && typeof obj === "object" && obj.type === "session_end") {
      try {
        window.dispatchEvent(
          new CustomEvent("rig_session_end", { detail: obj })
        );
      } catch (e) {
        console.warn("[MQTT] failed to dispatch rig_session_end:", e);
      }
      // don't forward as a pad event
      return;
    }

    // Many messages will be plain pad publishes from the Pi (pad, ts, edge, seq, origin)
    // or forwarded WS presses (type: "press", pad, ts, origin, origin_prev).
    // Normalize into PadEvent shape and include provenance.
    try {
      // Two main shapes:
      // 1) { pad, ts, edge, seq, origin }  <-- pi
      // 2) { type: "press", pad, ts, origin, origin_prev } <-- forwarded via ws
      const candidate: any = obj;
      let pad: number | undefined = undefined;
      let ts: number | undefined = undefined;
      let edge: string | undefined = undefined;
      let seq: number | undefined = undefined;
      let origin: string | undefined = undefined;
      let origin_prev: string | undefined = undefined;

      if (candidate == null) return;

      // If publisher uses "type":"press"
      if (candidate.type === "press" && candidate.pad != null) {
        pad = Number(candidate.pad);
        ts = candidate.ts != null ? Number(candidate.ts) : undefined;
        edge = candidate.edge;
        seq =
          typeof candidate.seq !== "undefined"
            ? Number(candidate.seq)
            : undefined;
        origin = candidate.origin ?? candidate.origin_prev ?? "ws";
        origin_prev = candidate.origin_prev ?? null;
      } else if (typeof candidate.pad !== "undefined") {
        pad = Number(candidate.pad);
        ts = candidate.ts != null ? Number(candidate.ts) : undefined;
        edge = candidate.edge;
        seq =
          typeof candidate.seq !== "undefined"
            ? Number(candidate.seq)
            : undefined;
        origin = candidate.origin ?? candidate.origin_prev ?? "mqtt";
        origin_prev = candidate.origin_prev ?? null;
      } else {
        // not a pad event (ignore here)
        return;
      }

      if (!pad || Number.isNaN(pad)) return;
      const normalized: PadEvent & { raw?: any } = {
        pad: pad as PadEvent["pad"],
        ts: ts != null ? Number(ts) : Date.now() / 1000,
        edge: edge as PadEvent["edge"],
        seq: typeof seq === "number" ? seq : undefined,
        raw: candidate,
        origin: origin,
        origin_prev: origin_prev ?? undefined,
      };

      // IMPORTANT: expose provenance explicitly so UI can decide to dedupe by seq or ignore ws_bridge-origin
      onEvent(normalized);
    } catch (err) {
      console.error("[MQTT] on message parse/normalize error:", err);
      return;
    }
  });

  // return cleanup function
  return () => {
    try {
      if (client) {
        client.end(true); // force disconnect and stop reconnect loop
      }
    } catch (e) {
      console.warn("[MQTT] cleanup error:", e);
    }
  };
}
