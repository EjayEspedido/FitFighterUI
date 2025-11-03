// src/libs/socket-init.ts
import socket, { connectSocket } from "./socket";

/**
 * Initializes socket connection, window helpers, and event forwarding.
 * Import this file once in App.tsx (top-level).
 */

type MqttMessageHandler = (topic: string, payload: any) => void;

const mqttClientShim = {
  _subs: new Set<string>(),
  _handlers: new Set<MqttMessageHandler>(),

  subscribe(topic: string) {
    this._subs.add(topic);
    if (socket && socket.connected) socket.emit("subscribe", topic);
  },

  unsubscribe(topic: string) {
    this._subs.delete(topic);
    if (socket && socket.connected) socket.emit("unsubscribe", topic);
  },

  on(event: string, handler: any) {
    if (event === "message") {
      this._handlers.add(handler as MqttMessageHandler);
    } else if (event === "connect") {
      if (socket && socket.connected) handler();
      else connectSocket().on("connect", handler);
    } else {
      connectSocket().on(event, handler);
    }
  },

  off(event: string, handler: any) {
    if (event === "message")
      this._handlers.delete(handler as MqttMessageHandler);
    else connectSocket().off(event, handler);
  },

  publish(topic: string, payload: any) {
    return (window as any).mqttPublish(topic, payload);
  },
};

// --- fix starts here ---
function ensureWindowHelpers() {
  if (typeof window === "undefined") return;
  if (!(window as any).mqttClient) (window as any).mqttClient = mqttClientShim;

  if (!(window as any).mqttPublish) {
    (window as any).mqttPublish = async (topic: string, payload: any) => {
      // prefer .env bridge base, fallback to localhost:3001 for dev
      const envBase = (import.meta.env.VITE_API_BASE as string) || "";
      const defaultBase = "http://localhost:3001";
      const base =
        envBase ||
        (window.location.hostname === "localhost"
          ? defaultBase
          : window.location.origin);
      const url = base.endsWith("/")
        ? `${base}api/publish`
        : `${base}/api/publish`;

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, payload }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          console.warn("[socket-init] publish non-ok", resp.status, txt);
          throw new Error(`mqttPublish failed ${resp.status} ${txt}`);
        }
        try {
          return await resp.json();
        } catch {
          return true;
        }
      } catch (err) {
        console.error("[socket-init] mqttPublish error", err);
        throw err;
      }
    };
  }
}
// --- fix ends here ---

function initSocketBridge() {
  ensureWindowHelpers();
  const s = connectSocket();

  s.on("connect", () => {
    console.debug("[socket-init] connected to bridge", s.id);
    for (const t of mqttClientShim._subs) s.emit("subscribe", t);
  });

  s.on("disconnect", (reason: any) => {
    console.debug("[socket-init] disconnected", reason);
  });

  s.on("connect_error", (err: any) => {
    console.warn("[socket-init] connect_error", err);
  });

  // handle pad input or button events
  s.on("device:btn", (data: any) => {
    try {
      window.postMessage({ type: "pad:input", payload: data }, window.origin);
    } catch {
      window.postMessage({ type: "pad:input", payload: data });
    }
  });

  // game end event
  s.on("game:end", (data: { topic?: string; payload?: any }) => {
    const topic = data?.topic ?? "device/pi01/game/end";
    const payload = data?.payload ?? data;
    mqttClientShim._handlers.forEach((h) => {
      try {
        h(
          topic,
          typeof payload === "string" ? payload : JSON.stringify(payload)
        );
      } catch (e) {
        console.warn("[socket-init] handler error", e);
      }
    });
    try {
      window.postMessage({ type: "pi:end", payload }, window.origin);
    } catch {
      window.postMessage({ type: "pi:end", payload });
    }
  });

  // device status
  s.on("device:status", (data: any) => {
    try {
      window.postMessage(
        { type: "device:status", payload: data },
        window.origin
      );
    } catch {
      window.postMessage({ type: "device:status", payload: data });
    }
  });

  (window as any).socketBridge = {
    socket: s,
    disconnect: () => s.disconnect(),
  };
  (window as any).mqttClient = mqttClientShim;
}

initSocketBridge();
export { initSocketBridge, mqttClientShim };
export default mqttClientShim;
