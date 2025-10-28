// server/index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// DEV ONLY: if you don't use Vite proxy, allow the UI origin
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/mqtt-token", (_req, res) => {
  const username = process.env.WEB_MQTT_USERNAME;
  const password = process.env.WEB_MQTT_PASSWORD;

  if (!username || !password) {
    // Log loudly so you see why it's 500
    console.error("[api] Missing WEB_MQTT_USERNAME/WEB_MQTT_PASSWORD envs");
    return res.status(500).json({ error: "Missing WEB_MQTT_* envs" });
  }
  return res.json({ username, password });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));
