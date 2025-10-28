// EndScreenRhythm.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeartRate } from "../apis/HeartRateProvider";
import "./StartScreen.css";

export default function EndScreenRhythm() {
  const { state } = useLocation() as any;
  const navigate = useNavigate();
  const result = state?.result ?? {};
  const { bpm: liveBpm } = useHeartRate();

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div className="page start-page" style={{ padding: 14 }}>
      <h1 className="title">Rhythm Mode — Final</h1>
      <div className="start-card" style={{ padding: 12 }}>
        <section className="section">
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
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.score ?? 0}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Max Combo</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.maxCombo ?? 0}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Rating</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {result?.rating ?? "—"}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Duration Played</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {formatTime(result?.durationPlayedSec ?? 0)}
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ marginTop: 8 }}>
          <label className="section__label">Hits Breakdown</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Perfect</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.perfectHits ?? 0}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Great</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.greatHits ?? 0}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Good</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.goodHits ?? 0}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Miss</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {result?.missHits ?? 0}
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ marginTop: 8 }}>
          <label className="section__label">Heart Rate</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Current HR</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {liveBpm ?? "—"} bpm
              </div>
            </div>
            <div
              style={{
                gridColumn: "span 3",
                opacity: 0.85,
                alignSelf: "center",
              }}
            >
              <div style={{ fontSize: 12 }}>Notes</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                Use this screen to review accuracy and pacing.
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
            Back
          </button>
          <button className="btn" onClick={() => navigate("/")}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
