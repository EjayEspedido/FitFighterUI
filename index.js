// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mqtt from "mqtt";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

dotenv.config();

/**
 * Config (from .env)
 */
const HTTP_PORT = parseInt(process.env.API_PORT || "3001", 10);
const WSS_URL =
  process.env.VITE_MQTT_WSS_URL || process.env.MQTT_WSS_URL || null;
const MQTT_BROKER = process.env.MQTT_BROKER || process.env.MQTT_HOST || null;
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "0", 10) || null;
const MQTT_USER =
  process.env.MQTT_USER || process.env.WEB_MQTT_USERNAME || null;
const MQTT_PASS =
  process.env.MQTT_PASS || process.env.WEB_MQTT_PASSWORD || null;
const MQTT_REJECT_UNAUTHORIZED =
  (process.env.MQTT_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false";

/**
 * App + HTTP + Socket.IO
 */
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.VITE_API_BASE_REACT || "http://localhost:5173",
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.VITE_API_BASE_REACT || "http://localhost:5173",
    credentials: true,
  },
});

/**
 * Simple logger
 */
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

/**
 * MQTT client state
 */
let mqttClient = null;
let mqttConnected = false;
const rigState = new Map(); // in-memory rig state cache

function buildClientId(prefix = "api") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

function safeJsonParse(buf) {
  try {
    if (typeof buf === "string") return JSON.parse(buf);
    return JSON.parse(buf.toString());
  } catch (e) {
    // return string fallback
    try {
      return buf.toString();
    } catch (_) {
      return null;
    }
  }
}

/**
 * Subscribe to topics we care about
 */
function subscribeTopics() {
  if (!mqttClient) return;
  const topics = [
    { topic: "rig/+/status", qos: 1 },
    { topic: "rig/+/event", qos: 1 },
    { topic: "rig/+/command/response", qos: 1 },
    { topic: "device/+/control/#", qos: 1 },
    { topic: "device/+/btn", qos: 0 }, // frequent events, low qos
    { topic: "session/+/result", qos: 1 },
  ];
  topics.forEach(({ topic, qos }) => {
    mqttClient.subscribe(topic, { qos }, (err, granted) => {
      if (err) log("[mqtt] subscribe failed", topic, err);
      else log("[mqtt] subscribed", topic, "granted:", granted);
    });
  });
}

/**
 * Handle incoming MQTT messages
 */
function handleIncomingMessage(topic, messageBuf) {
  const msg = safeJsonParse(messageBuf);
  log("[mqtt rx]", topic, typeof msg === "string" ? msg : JSON.stringify(msg));
  try {
    let m;
    if ((m = topic.match(/^rig\/([^/]+)\/status$/))) {
      const rigId = m[1];
      rigState.set(rigId, {
        lastStatus: msg,
        updatedAt: new Date().toISOString(),
      });
      io.emit("rig:status", { rigId, status: msg });
      return;
    }
    if ((m = topic.match(/^rig\/([^/]+)\/event$/))) {
      const rigId = m[1];
      io.emit("rig:event", { rigId, event: msg });
      return;
    }
    if ((m = topic.match(/^rig\/([^/]+)\/command\/response$/))) {
      const rigId = m[1];
      io.emit("rig:cmdresp", { rigId, response: msg });
      return;
    }
    if ((m = topic.match(/^device\/([^/]+)\/control\/(.*)$/))) {
      const deviceId = m[1];
      const sub = m[2];
      io.emit("device:control", { deviceId, sub, payload: msg });
      return;
    }
    if ((m = topic.match(/^device\/([^/]+)\/btn$/))) {
      const deviceId = m[1];
      // pad events from Pi -> forward to browsers
      // msg expected: { pad: <1..8>, action: "press", seq, timestamp, ... }
      io.emit("pad", { deviceId, ...msg });
      return;
    }
    if ((m = topic.match(/^session\/([^/]+)\/result$/))) {
      const sessionId = m[1];
      io.emit("session:result", { sessionId, result: msg });
      return;
    }
    // fallback
    io.emit("mqtt:unhandled", { topic, payload: msg });
  } catch (e) {
    log("[handleIncomingMessage] error", e);
  }
}

/**
 * Connect to MQTT (supports WSS or mqtts)
 */
function connectMqtt() {
  if (mqttClient && mqttConnected) return;

  const clientId = buildClientId("api");
  const opts = {
    username: MQTT_USER || undefined,
    password: MQTT_PASS || undefined,
    clientId,
    connectTimeout: 10_000,
    keepalive: 30,
    reconnectPeriod: 2000,
    rejectUnauthorized: MQTT_REJECT_UNAUTHORIZED,
  };

  let connectUrl;
  if (WSS_URL) {
    connectUrl = WSS_URL;
    log("[mqtt] connecting via WSS", connectUrl);
    mqttClient = mqtt.connect(connectUrl, opts);
  } else if (MQTT_BROKER && MQTT_PORT) {
    connectUrl = `mqtts://${MQTT_BROKER}:${MQTT_PORT}`;
    log("[mqtt] connecting via mqtts", connectUrl);
    mqttClient = mqtt.connect(connectUrl, opts);
  } else {
    log(
      "[mqtt] no connection configured: set VITE_MQTT_WSS_URL or MQTT_BROKER+MQTT_PORT"
    );
    return;
  }

  mqttClient.on("connect", (connack) => {
    mqttConnected = true;
    log("[mqtt] connected", connack ? connack : "");
    subscribeTopics();
    mqttClient.on("message", handleIncomingMessage);
    // publish server presence
    mqttClient.publish(
      "server/api/status",
      JSON.stringify({ status: "online", ts: new Date().toISOString() }),
      { qos: 1, retain: false },
      (err) => {
        if (err) log("[mqtt] presence publish failed", err);
      }
    );
  });

  mqttClient.on("reconnect", () => log("[mqtt] reconnecting..."));
  mqttClient.on("close", () => {
    mqttConnected = false;
    log("[mqtt] closed");
  });
  mqttClient.on("offline", () => {
    mqttConnected = false;
    log("[mqtt] offline");
  });
  mqttClient.on("error", (err) => {
    mqttConnected = false;
    log("[mqtt] error", err && err.message ? err.message : err);
  });
}

/**
 * Publish helpers
 */
function publishRigCommand(rigId, cmd, payload = {}, options = { qos: 1 }) {
  if (!mqttClient || !mqttConnected)
    return Promise.reject(new Error("MQTT not connected"));
  const topic = `rig/${rigId}/command`;
  const message = JSON.stringify({
    cmd,
    payload,
    ts: new Date().toISOString(),
  });
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, message, options, (err) => {
      if (err) {
        log("[publishRigCommand] error", err);
        return reject(err);
      }
      log("[publishRigCommand] published", topic, message);
      resolve();
    });
  });
}

function publish(topic, payload = {}, options = { qos: 0 }) {
  if (!mqttClient || !mqttConnected)
    return Promise.reject(new Error("MQTT not connected"));
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, JSON.stringify(payload), options, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Socket.IO handlers
 */
io.on("connection", (socket) => {
  log("[socket] client connected", socket.id);
  socket.emit("hello", { msg: "connected to FitFighter API" });

  socket.on("ping", (d) => socket.emit("pong", d));

  socket.on("rig:command", async (data) => {
    // allow clients to request server to publish rig commands if they have UI use-case
    try {
      const { rigId, cmd, payload } = data || {};
      if (!rigId || !cmd)
        return socket.emit("rig:command:err", {
          error: "rigId and cmd required",
        });
      await publishRigCommand(rigId, cmd, payload ?? {});
      socket.emit("rig:command:ok", { rigId, cmd });
    } catch (err) {
      socket.emit("rig:command:err", { error: err && err.message });
    }
  });

  socket.on("disconnect", (reason) => {
    log("[socket] disconnect", socket.id, reason);
  });
});

/**
 * HTTP routes
 */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mqtt: mqttConnected })
);

app.get("/api/mqtt-token", (_req, res) => {
  const username = process.env.WEB_MQTT_USERNAME || process.env.MQTT_USER;
  const password = process.env.WEB_MQTT_PASSWORD || process.env.MQTT_PASS;
  if (!username || !password)
    return res.status(500).json({ error: "Missing MQTT creds on server" });
  return res.json({ username, password });
});

app.post("/api/rig-command", async (req, res) => {
  const { rigId, cmd, payload } = req.body || {};
  if (!rigId || !cmd)
    return res.status(400).json({ error: "rigId and cmd required" });
  try {
    await publishRigCommand(rigId, cmd, payload ?? {});
    return res.json({ ok: true });
  } catch (err) {
    log("[api] rig-command error", err && err.message ? err.message : err);
    return res
      .status(500)
      .json({ error: "publish failed", details: err && err.message });
  }
});

app.post("/api/publish", async (req, res) => {
  const { topic, payload, qos = 0 } = req.body || {};
  if (!topic) return res.status(400).json({ error: "topic required" });
  if (!mqttClient || !mqttConnected)
    return res.status(503).json({ error: "mqtt not connected" });
  try {
    await publish(topic, payload ?? {}, { qos });
    return res.json({ ok: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "publish failed", details: err && err.message });
  }
});

app.get("/api/rig/:rigId/state", (req, res) => {
  const rigId = req.params.rigId;
  if (!rigState.has(rigId)) return res.status(404).json({ error: "not found" });
  return res.json(rigState.get(rigId));
});

/**
 * Start server + mqtt connect
 */
server.listen(HTTP_PORT, () => {
  log(`[api] listening http://localhost:${HTTP_PORT}`);
  connectMqtt();
});

/**
 * Graceful shutdown
 */
function shutdown() {
  log("[api] shutting down...");
  try {
    if (mqttClient) mqttClient.end(true);
  } catch (_) {}
  server.close(() => {
    log("[api] http server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
