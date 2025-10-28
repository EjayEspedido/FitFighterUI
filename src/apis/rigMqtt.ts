// src/apis/rigMqtt.ts
import mqtt from "mqtt";

/**
 * Type expected by RigInputProvider
 */
export type PadEvent = {
  ts?: number;
  pad: number;
  edge?: "down" | "up";
  seq?: number;
  origin?: string;
  [k: string]: any;
};

const WSS_URL = import.meta.env.VITE_MQTT_WSS_URL;
console.log("[rigMqtt] VITE_MQTT_WSS_URL:", WSS_URL);

/** TEMP: debug stub — replace with real fetch to /api/mqtt-token when ready */
async function fetchMqttToken(rigId: string) {
  console.warn("[rigMqtt TEST STUB] returning hardcoded creds for", rigId);
  return { username: "web-rig-ff-001", password: "Web-rig-ff-001" };
}

// Shared client ref so other helpers can publish / check connectivity
let clientRef: mqtt.MqttClient | null = null;

/**
 * Wait for the shared client to become connected.
 * Resolves true if connected within timeoutMs, otherwise false.
 */
export function waitForClient(timeoutMs = 2500): Promise<boolean> {
  const intervalMs = 100;
  let waited = 0;
  return new Promise((resolve) => {
    if (clientRef && clientRef.connected) return resolve(true);
    const id = setInterval(() => {
      if (clientRef && clientRef.connected) {
        clearInterval(id);
        return resolve(true);
      }
      waited += intervalMs;
      if (waited >= timeoutMs) {
        clearInterval(id);
        return resolve(false);
      }
    }, intervalMs);
  });
}

/**
 * Publish a rig command. Throws if client not available/connected.
 * - rigId param kept for symmetry; topic is also accepted full.
 */
export function publishRigCommand(
  rigId: string,
  topic: string,
  message: any,
  opts?: mqtt.IClientPublishOptions
) {
  if (!clientRef) {
    throw new Error("MQTT client not initialized");
  }
  if (!clientRef.connected) {
    throw new Error("MQTT client not connected");
  }

  const payload =
    typeof message === "string" ? message : JSON.stringify(message);
  clientRef.publish(topic, payload, opts || { qos: 0 }, (err) => {
    if (err) {
      console.error("[rigMqtt] publish error:", err);
    } else {
      console.debug("[rigMqtt] publish ok", topic, payload);
    }
  });
}

/**
 * connectRig
 * - rigId: string
 * - onMessage: (e: PadEvent) => void
 * - onConnect: () => void
 * - onClose: () => void
 *
 * Returns a cleanup function: () => void
 */
export async function connectRig(
  rigId: string,
  onMessage?: (e: PadEvent) => void,
  onConnect?: () => void,
  onClose?: () => void
): Promise<() => void> {
  if (!WSS_URL) {
    console.error("[rigMqtt] no VITE_MQTT_WSS_URL configured — abort connect");
    return () => {};
  }

  let token;
  try {
    token = await fetchMqttToken(rigId);
    console.log("[rigMqtt] token received:", token);
  } catch (err) {
    console.error("[rigMqtt] token fetch failed:", err);
    return () => {};
  }

  const clientId = `web-${rigId}-${Math.floor(Math.random() * 10000)}`;
  const opts: mqtt.IClientOptions = {
    protocol: "wss",
    username: token.username,
    password: token.password,
    clientId,
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 30_000,
    // For local dev you can toggle this; keep true in prod.
    rejectUnauthorized: true,
  };

  console.log("[rigMqtt] mqtt.connect ->", WSS_URL, opts);

  const client = mqtt.connect(WSS_URL, opts);
  clientRef = client; // set shared ref

  const handlers = {
    connect: (connack?: any) => {
      console.log("[rigMqtt] CONNECT OK", connack);
      try {
        onConnect && onConnect();
      } catch (e) {
        console.error("[rigMqtt] onConnect handler threw:", e);
      }
      // subscribe to events topic
      const topic = `rig/${rigId}/events`;
      client.subscribe(topic, { qos: 0 }, (err, granted) => {
        if (err) {
          console.error("[rigMqtt] subscribe error:", err);
        } else {
          console.log("[rigMqtt] subscribed to", topic, "granted:", granted);
        }
      });
    },
    reconnect: () => {
      console.log("[rigMqtt] reconnecting...");
    },
    close: () => {
      console.log("[rigMqtt] connection closed");
      try {
        onClose && onClose();
      } catch (e) {
        console.error("[rigMqtt] onClose handler threw:", e);
      }
    },
    offline: () => {
      console.log("[rigMqtt] offline");
    },
    error: (err: any) => {
      console.error(
        "[rigMqtt] ERROR:",
        err && err.message ? err.message : err,
        err
      );
    },
    message: (topic: string, payload: Buffer) => {
      const s = payload.toString();
      // best-effort parse
      try {
        const parsed = JSON.parse(s) as PadEvent;
        console.log("[rigMqtt] MESSAGE", topic, parsed);
        try {
          onMessage && onMessage(parsed);
        } catch (e) {
          console.error("[rigMqtt] onMessage handler threw:", e);
        }
      } catch (err) {
        console.warn("[rigMqtt] could not JSON.parse message payload, raw:", s);
      }
    },
  };

  client.on("connect", handlers.connect);
  client.on("reconnect", handlers.reconnect);
  client.on("close", handlers.close);
  client.on("offline", handlers.offline);
  client.on("error", handlers.error);
  client.on("message", handlers.message);

  // Return cleanup function matching what RigInputProvider expects
  const cleanup = () => {
    try {
      console.log("[rigMqtt] cleanup: unsubscribing and ending client");
      // attempt graceful unsubscribe
      const topic = `rig/${rigId}/events`;
      client.unsubscribe(topic, (err) => {
        if (err) console.warn("[rigMqtt] unsubscribe error:", err);
        client.end(true, () => {
          console.log("[rigMqtt] client end complete");
          if (clientRef === client) clientRef = null;
        });
      });
    } catch (e) {
      console.warn("[rigMqtt] cleanup error:", e);
      try {
        client.end(true);
      } catch {}
      if (clientRef === client) clientRef = null;
    }
  };

  return cleanup;
}

/** Optional helper: disconnect if you hold a client ref elsewhere */
export function makeImmediateCleanup(client?: mqtt.MqttClient) {
  return () => {
    try {
      client?.end(true);
    } catch (e) {
      /* ignore */
    }
  };
}

// Export everything needed by gameControl / other modules
export default {
  connectRig,
  waitForClient,
  publishRigCommand,
  makeImmediateCleanup,
};
