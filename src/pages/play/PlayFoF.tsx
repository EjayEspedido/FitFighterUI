import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePadInput } from "../../apis/RigInputProvider";
import { sendStartParams, type Level } from "../../apis/gameControl";

export default function PlayFoF() {
  const { rigId } = usePadInput();
  const nav = useNavigate();

  const [level, setLevel] = useState<Level>("Intermediate");
  const [minutes, setMinutes] = useState(10);
  const [isEndless, setIsEndless] = useState(false);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div className="page" style={{ padding: 16 }}>
        <h1>Friend or Foe — Start</h1>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <label>
            Level:&nbsp;
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>Expert</option>
            </select>
          </label>

          <label>
            Total time (minutes):&nbsp;
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) =>
                setMinutes(Math.max(1, Number(e.target.value || 1)))
              }
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isEndless}
              onChange={(e) => setIsEndless(e.target.checked)}
            />
            Endless mode
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/modes")}>Back</button>
            <button
              onClick={async () => {
                if (rigId) {
                  await sendStartParams(rigId, {
                    userLevel: level,
                    gameMode: 2, // 👈 FoF = 2
                    total_time: minutes * 60,
                    isEndless,
                  });
                }
                setStarted(true);
              }}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TODO: replace with your actual FoF gameplay
  return (
    <div className="page" style={{ padding: 16 }}>
      <h1>Friend or Foe — Playing</h1>
      <p>Implement FoF gameplay here. Params were sent to the Pi.</p>
      <button onClick={() => nav("/modes")}>End</button>
    </div>
  );
}
