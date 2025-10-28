// index.js - HTTP -> MQTT bridge with verbose MQTT debug enabled
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mqtt from "mqtt";

const app = express();
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// === Config ===
const HTTP_PORT = process.env.API_PORT || 6969;
let MQTT_URL = process.env.VITE_MQTT_WSS_URL || "";
if (!MQTT_URL) {
  MQTT_URL =
    "wss://7660022c2cd8464195cfc9fddc39908c.s1.eu.hivemq.cloud:8884/mqtt";
}
const MQTT_USER = process.env.WEB_MQTT_USERNAME;
const MQTT_PASS = process.env.WEB_MQTT_PASSWORD;
const MQTT_PREFIX = process.env.MQTT_PREFIX || "rig";

// === Startup log ===
console.log("Bridge starting with config:");
console.log("  HTTP_PORT =", HTTP_PORT);
console.log("  MQTT_URL  =", MQTT_URL);
console.log("  MQTT_USER =", MQTT_USER);
console.log("  MQTT_PASS =", MQTT_PASS ? "(hidden)" : "(none)");

const clientId = `bridge-${Math.random()
  .toString(16)
  .slice(2, 10)}-${Date.now()}`;

const mqttOpts = {
  clientId,
  username: MQTT_USER,
  password: MQTT_PASS,
  clean: true, // start clean session
  connectTimeout: 20_000,
  reconnectPeriod: 3_000,
  keepalive: 30,
  // try MQTT v3.1.1 explicitly (works reliably with HiveMQ)
  protocolVersion: 4,
};

console.log("[API] [MQTT] clientId:", clientId);
const client = mqtt.connect(MQTT_URL, mqttOpts);

// === DEBUG: always on for now ===
console.log("[DEBUG] MQTT debug mode: ON");
try {
  client.on("packetsend", (packet) => {
    try {
      console.log("[MQTT DEBUG] ➡️ Sent packet:", packet && packet.cmd);
    } catch (e) {
      console.log("[MQTT DEBUG] ➡️ Sent packet (err reading)", e && e.message);
    }
  });

  client.on("packetreceive", (packet) => {
    try {
      console.log("[MQTT DEBUG] ⬅️ Received packet:", packet && packet.cmd);
    } catch (e) {
      console.log(
        "[MQTT DEBUG] ⬅️ Received packet (err reading)",
        e && e.message
      );
    }
  });

  client.on("connect", (connack) => {
    console.log("[MQTT] connected to", MQTT_URL, "connack:", connack);
  });

  client.on("reconnect", () => console.log("[MQTT] reconnecting..."));
  client.on("close", () => console.log("[MQTT] connection closed"));
  client.on("offline", () => console.log("[MQTT] offline"));
  client.on("end", () => console.log("[MQTT] end"));
  client.on("disconnect", (packet) =>
    console.log("[MQTT] disconnect", packet && packet.reasonCode)
  );
  client.on("error", (err) => console.log("[MQTT] error", err && err.message));

  // stream error is useful for socket-level issues
  if (client.stream && client.stream.on) {
    client.stream.on("error", (err) =>
      console.log("[STREAM ERROR]", err && err.message)
    );
  } else {
    console.log("[DEBUG] client.stream not available at startup");
  }
} catch (err) {
  console.warn("[DEBUG] failed to attach debug handlers:", err && err.message);
}

// === Helper: publish with logging & safe callback ===
function safePublish(topic, message, opts = { qos: 0 }) {
  const payload =
    typeof message === "string" ? message : JSON.stringify(message);
  try {
    client.publish(topic, payload, opts, (err) => {
      if (err) {
        console.error(
          "[MQTT] publish error for",
          topic,
          ":",
          err && err.message
        );
      } else {
        console.log("[MQTT] published to", topic);
      }
    });
  } catch (e) {
    console.error("[MQTT] publish threw for", topic, e && e.message);
  }
}

// === HTTP endpoints ===
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mqtt_connected: !!client.connected });
});

app.get("/api/mqtt-token", (_req, res) => {
  if (!MQTT_USER || !MQTT_PASS) {
    return res.status(500).json({ error: "Missing WEB_MQTT_* env variables" });
  }
  return res.json({ url: MQTT_URL, username: MQTT_USER, password: MQTT_PASS });
});

app.post("/api/rig-command", (req, res) => {
  const { rigId, cmd, payload } = req.body || {};
  if (!rigId || !cmd) {
    return res.status(400).json({ ok: false, error: "missing rigId or cmd" });
  }
  const topic = `${MQTT_PREFIX}/${rigId}/command`;
  const message = { cmd, payload, ts: Date.now() };
  console.log("[HTTP] POST /api/rig-command ->", topic, message);

  // publish and respond after callback
  client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] publish callback error:", err && err.message);
      return res.status(500).json({ ok: false, error: err && err.message });
    }
    console.log("[HTTP] forwarded to MQTT", topic);
    return res.json({ ok: true, forwarded: true });
  });
});

app.post("/api/rig/:rigId/session_end", (req, res) => {
  const rigId = req.params.rigId;
  if (!rigId)
    return res.status(400).json({ ok: false, error: "missing rigId" });
  const topic = `${MQTT_PREFIX}/${rigId}/session_end`;
  const message = { ...req.body, ts: Date.now() };
  console.log(
    "[HTTP] POST /api/rig/%s/session_end -> %s %o",
    rigId,
    topic,
    message
  );

  client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] publish callback error:", err && err.message);
      return res.status(500).json({ ok: false, error: err && err.message });
    }
    console.log("[HTTP] forwarded session_end to MQTT", topic);
    return res.json({ ok: true, forwarded: true });
  });
});

// optional generic logger for all incoming HTTP requests (keeps noisy)
app.use((req, _res, next) => {
  console.log("[HTTP] ", req.method, req.originalUrl);
  next();
});

// === Start server ===
app.listen(HTTP_PORT, () => {
  console.log(`[api] HTTP bridge listening on http://localhost:${HTTP_PORT}`);
  // Also print client id if available
  try {
    console.log("[MQTT] clientId:", client.options && client.options.clientId);
  } catch (e) {
    // ignore
  }
});
