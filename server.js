// server.js
const express = require("express");
const app = express();
app.use(express.json());

app.post("/api/rig-command", (req, res) => {
  console.log("rig-command", req.body);
  // validate and forward to rig hardware here
  res.json({ ok: true });
});

app.listen(3001, () => console.log("api listening on :3001"));
