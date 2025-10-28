// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mqtt from "mqtt";

dotenv.config();

const app = express();
app.use(express.json());

// DEV ONLY: allow Vite dev server origin (adjust for prod)
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

const WSS_URL = process.env.VITE_MQTT_WSS_URL || process.env.MQTT_URL || null;
const MQTT_HOST = process.env.MQTT_HOST || null;
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "0", 10) || null;
const MQTT_USER =
  process.env.WEB_MQTT_USERNAME || process.env.MQTT_USER || null;
const MQTT_PASS =
  process.env.WEB_MQTT_PASSWORD || process.env.MQTT_PASSWORD || null;

let mqttClient = null;
let mqttConnected = false;

function connectMqtt() {
  if (mqttClient && mqttConnected) return;

  try {
    if (WSS_URL) {
      console.log("[api] connecting mqtt via WSS:", WSS_URL);
      mqttClient = mqtt.connect(WSS_URL, {
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: false,
        clientId: `http-api-${Math.random().toString(16).slice(2)}`,
        connectTimeout: 10_000,
      });
    } else if (MQTT_HOST && MQTT_PORT) {
      const url = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;
      console.log("[api] connecting mqtt via TLS TCP:", url);
      mqttClient = mqtt.connect(url, {
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: false,
        clientId: `http-api-${Math.random().toString(16).slice(2)}`,
      });
    } else {
      console.warn(
        "[api] no MQTT connection configured (WSS_URL or MQTT_HOST+MQTT_PORT required)"
      );
      return;
    }

    mqttClient.on("connect", (connack) => {
      mqttConnected = true;
      console.log("[api] mqtt connected", connack?.returnCode ?? "");
    });
    mqttClient.on("reconnect", () => console.log("[api] mqtt reconnecting..."));
    mqttClient.on("close", () => {
      mqttConnected = false;
      console.log("[api] mqtt closed");
    });
    mqttClient.on("error", (err) => {
      mqttConnected = false;
      console.error("[api] mqtt error", err && err.message ? err.message : err);
    });
  } catch (err) {
    console.error("[api] mqtt connect failed", err);
    mqttClient = null;
    mqttConnected = false;
  }
}

// health
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mqtt: mqttConnected })
);

// existing token endpoint used by frontend to get credentials
app.get("/api/mqtt-token", (_req, res) => {
  const username = process.env.WEB_MQTT_USERNAME;
  const password = process.env.WEB_MQTT_PASSWORD;

  if (!username || !password) {
    console.error("[api] Missing WEB_MQTT_USERNAME/WEB_MQTT_PASSWORD envs");
    return res.status(500).json({ error: "Missing WEB_MQTT_* envs" });
  }
  return res.json({ username, password });
});

// NEW: accept POST /api/rig-command and forward to MQTT
app.post("/api/rig-command", (req, res) => {
  const body = req.body || {};
  const rigId = body.rigId || body.rig || body.id || "rig-ff-001";
  const cmd = body.cmd || body.command;
  const payload = body.payload ?? {};

  if (!cmd) {
    return res.status(400).json({ error: "cmd required in body" });
  }

  // Ensure broker connection
  if (!mqttClient) connectMqtt();

  if (!mqttClient || !mqttConnected) {
    // still allow publishing to local broker if needed — but prefer MQTT
    console.warn("[api] MQTT not connected; cannot publish command right now");
    return res.status(503).json({ error: "MQTT not connected" });
  }

  const topic = `rig/${rigId}/command`;
  const message = JSON.stringify({ cmd, payload });

  mqttClient.publish(topic, message, { qos: 0 }, (err) => {
    if (err) {
      console.error("[api] publish error", err);
      return res
        .status(500)
        .json({ error: "publish failed", details: err.message || String(err) });
    }
    console.log("[api] published", topic, message);
    return res.json({ ok: true });
  });
});

// server listen
const PORT = parseInt(process.env.API_PORT || "3001", 10) || 3001;
app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  // attempt mqtt connection on start
  connectMqtt();
});
