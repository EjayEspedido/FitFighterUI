import mqtt from "mqtt";
import type { IClientOptions, MqttClient } from "mqtt";

export type PadEvent = {
  ts: number;
  pad: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  edge?: "down" | "up";
  seq?: number;
  raw?: any; // <-- tolerate extra payload fields from Pi
};

export async function connectRig(
  rigId: string,
  onEvent: (e: PadEvent) => void,
  onConnect?: () => void,
  onClose?: () => void
): Promise<() => void> {
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

  client.on("connect", () => {
    client.subscribe(`rig/${rigId}/events`, { qos: 0 }, (err) => {
      if (err) console.error("[MQTT] subscribe error:", err);
      else onConnect?.();
    });
  });

  client.on("close", () => onClose?.());
  client.on("error", (err) => console.error("[MQTT] error:", err));

  client.on("message", (_topic, msg) => {
    try {
      const e = JSON.parse(msg.toString()) as PadEvent;
      if (e?.edge ? e.edge === "down" : true) onEvent(e);
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

// Optional: publish helper for rig commands
let _clientRef: MqttClient | null = null;
export function __setClientForPublish(c: MqttClient | null) {
  _clientRef = c;
}
export async function publishRigCommand(
  rigId: string,
  topic: string,
  payload: object
) {
  if (!_clientRef) throw new Error("MQTT client not ready");
  _clientRef.publish(topic, JSON.stringify(payload));
}
