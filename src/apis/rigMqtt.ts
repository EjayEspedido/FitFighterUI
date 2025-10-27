import mqtt from "mqtt";
import type { IClientOptions, MqttClient } from "mqtt";

export type PadEvent = {
  ts: number;
  pad: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  edge: "down";
  seq: number;
};

/** Connects over WSS using creds from /api/mqtt-token. Returns a cleanup fn. */
export async function connectRig(
  rigId: string,
  onEvent: (e: PadEvent) => void,
  onConnect?: () => void,
  onClose?: () => void
): Promise<() => void> {
  // 1) Fetch creds from your backend (avoid undefined envs in browser)
  const r = await fetch(`/api/mqtt-token?rigId=${encodeURIComponent(rigId)}`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`/api/mqtt-token failed: ${r.status}`);
  const { username, password } = (await r.json()) as {
    username: string;
    password: string;
  };
  if (!username || !password)
    throw new Error("API returned empty MQTT username/password");

  const url = import.meta.env.VITE_MQTT_WSS_URL as string;
  if (!url) throw new Error("VITE_MQTT_WSS_URL missing");

  // Loud sanity logs (remove after it works)
  console.log("[MQTT] url:", url);
  console.log("[MQTT] username:", username);
  console.log("[MQTT] pass set?:", Boolean(password));
  console.log("[MQTT] subscribing topic:", `rig/${rigId}/events`);

  const opts: IClientOptions = {
    clientId: `web-${rigId}-${Math.random().toString(16).slice(2)}`,
    username,
    password,
    keepalive: 30,
    clean: true,
    // You can uncomment the next two if a proxy is meddling, but default is fine:
    // protocolVersion: 4,
    // protocolId: "MQTT",
  };

  const client: MqttClient = mqtt.connect(url, opts);

  client.on("connect", () => {
    console.log("[MQTT] connected");
    client.subscribe(`rig/${rigId}/events`, { qos: 0 }, (err) => {
      if (err) console.error("[MQTT] subscribe error:", err);
      else onConnect?.();
    });
  });

  client.on("error", (err) => {
    console.error("[MQTT] error:", err);
  });

  client.on("close", () => {
    console.warn("[MQTT] closed");
    onClose?.();
  });

  client.on("message", (_topic, msg) => {
    try {
      const e = JSON.parse(msg.toString()) as PadEvent;
      if (e?.edge === "down") onEvent(e);
    } catch (err) {
      console.error("[MQTT] parse error:", err);
    }
  });

  return () => {
    try {
      client.end(true);
    } catch {}
  };
}
