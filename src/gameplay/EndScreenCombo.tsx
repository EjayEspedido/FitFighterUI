// src/gameplay/EndScreenCombo.tsx
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeartRate } from "../apis/HeartRateProvider";
import { usePadInput } from "../apis/RigInputProvider";

import "./StartScreen.css";

export default function EndScreenCombo() {
  const { state } = useLocation() as any;
  const result = state?.result ?? {};
  const { bpm: liveBpm } = useHeartRate();
  const navigate = useNavigate();

  const startBpm = result?.startBpm ?? result?.session?.startBpm ?? "—";
  const endBpm = result?.endBpm ?? "—";
  const score = result?.score ?? 0;
  const maxCombo = result?.maxCombo ?? 0;
  const difficulty = result?.session?.level ?? "—";
  const durationPlayedSec = Number(result?.durationPlayedSec ?? 0);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // key / pad handler (for testing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Using key codes '2' and '5' as your pad placeholders
      if (e.key === "2") {
        navigate("/Modes");
      } else if (e.key === "5") {
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <div className="page start-page" style={{ padding: 14 }}>
      <h1 className="title">Combo Mode — Final</h1>

      <div className="start-card" style={{ padding: 12 }}>
        <section className="section" style={{ marginBottom: 8 }}>
          <label className="section__label">Summary</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Final Score</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{score}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Max Combo</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{maxCombo}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Difficulty</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{difficulty}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Duration Played</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {formatTime(durationPlayedSec)}
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ marginBottom: 6 }}>
          <label className="section__label">Heart Rate</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                Start HR (snapshot)
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {startBpm ?? "—"} bpm
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                End HR (captured)
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {endBpm ?? "—"} bpm
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                Current HR (live)
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {liveBpm ?? "—"} bpm
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Notes</div>
              <div style={{ fontWeight: 700, marginTop: 6, opacity: 0.85 }}>
                Replace with session breakdown
              </div>
            </div>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          <button className="btn" onClick={() => navigate("/Modes")}>
            Back (2)
          </button>
          <button className="btn" onClick={() => navigate("/")}>
            Home (5)
          </button>
        </div>
      </div>
    </div>
  );
}
