// src/components/StartScreenFoF.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePadInput } from "../apis/RigInputProvider";
import "./StartScreen.css";
import { useHeartRate } from "../apis/HeartRateProvider";

export type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";
const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export type StartFoFParams = {
  level: Level;
  minutes: number;
  isEndless: boolean;
  startBpm?: number | null;
  startedAt?: number;
};

export default function StartScreenFoF() {
  const navigate = useNavigate();
  const { bpm } = useHeartRate(); // <-- hook inside component

  const snap5 = (m: number) => Math.max(5, Math.round((m || 5) / 5) * 5);

  const [levelIdx, setLevelIdx] = useState(0);
  const [minutes, setMinutes] = useState(snap5(10));
  const [isEndless, setIsEndless] = useState(false);

  const level = useMemo(() => LEVELS[levelIdx], [levelIdx]);

  // actions
  const prevLevel = () =>
    setLevelIdx((i) => (i - 1 + LEVELS.length) % LEVELS.length);
  const nextLevel = () => setLevelIdx((i) => (i + 1) % LEVELS.length);
  const decMinutes5 = () => setMinutes((m) => snap5(m - 5));
  const incMinutes5 = () => setMinutes((m) => snap5(m + 5));
  const toggleEndless = () => setIsEndless((v) => !v);

  const confirm = () => {
    const session: StartFoFParams = {
      level,
      minutes: snap5(minutes),
      isEndless,
      startBpm: bpm ?? null, // snapshot at start
      startedAt: Date.now(),
    };
    navigate("/play/fof", { state: { session } });
  };

  const exit = () => navigate("/Modes");

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.key) {
        case "1":
          prevLevel();
          break;
        case "3":
          nextLevel();
          break;
        case "4":
          decMinutes5();
          break;
        case "6":
          incMinutes5();
          break;
        case "7":
        case "8":
          toggleEndless();
          break;
        case "2":
        case "Enter":
        case " ":
          confirm();
          break;
        case "5":
          exit();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [levelIdx, minutes, isEndless, bpm]); // bpm doesn't change handlers, but fine to include

  // pads
  const { last } = usePadInput();
  const lastSeenTs = useRef<number>(0);
  useEffect(() => {
    if (!last || last.ts === lastSeenTs.current) return;
    lastSeenTs.current = last.ts ?? 0;
    if (last.edge && last.edge !== "down") return;
    switch (last.pad) {
      case 1:
        prevLevel();
        break;
      case 3:
        nextLevel();
        break;
      case 4:
        decMinutes5();
        break;
      case 6:
        incMinutes5();
        break;
      case 7:
      case 8:
        toggleEndless();
        break;
      case 2:
        confirm();
        break;
      case 5:
        exit();
        break;
    }
  }, [last, bpm]);

  return (
    <div className="page start-page">
      <h1 className="title">Friend or Foe Mode — Start</h1>

      <div className="start-card">
        {/* Level with directional controls */}
        <section className="section">
          <label className="section__label">Level</label>
          <div className="row-with-arrows">
            <button type="button" className="btn arrow-btn" onClick={prevLevel}>
              ◀ <span className="pad-hint">1</span>
            </button>

            <div className="button-grid button-grid--4">
              {LEVELS.map((L, i) => (
                <button
                  key={L}
                  type="button"
                  onClick={() => setLevelIdx(i)}
                  className={`btn ${i === levelIdx ? "btn--active" : ""}`}
                >
                  {L}
                </button>
              ))}
            </div>

            <button type="button" className="btn arrow-btn" onClick={nextLevel}>
              <span className="pad-hint">3</span> ▶
            </button>
          </div>

          <div className="keyguide">
            Adjust: <b>1</b>/<b>3</b>
          </div>
        </section>

        {/* Time with directional controls */}
        <section className="section">
          <label className="section__label">Workout Time (minutes)</label>
          <div className="row-with-arrows">
            <button
              type="button"
              className="btn arrow-btn"
              onClick={decMinutes5}
            >
              ◀ <span className="pad-hint">4</span>
            </button>

            <div className="time-row">
              <div className="time-display btn">{minutes} min</div>
            </div>

            <button
              type="button"
              className="btn arrow-btn"
              onClick={incMinutes5}
            >
              <span className="pad-hint">6</span> ▶
            </button>
          </div>

          <div className="keyguide">
            Adjust: <b>4</b>/<b>6</b>
          </div>
        </section>

        {/* Endless toggle */}
        <section className="section">
          <div className="row-with-arrows">
            <button
              type="button"
              className="btn arrow-btn"
              onClick={toggleEndless}
            >
              ◀ <span className="pad-hint">7</span>
            </button>

            <button
              type="button"
              onClick={toggleEndless}
              className={`btn ${isEndless ? "btn--active" : ""}`}
            >
              Endless Mode: <b>{isEndless ? "ON" : "OFF"}</b>
            </button>

            <button
              type="button"
              className="btn arrow-btn"
              onClick={toggleEndless}
            >
              <span className="pad-hint">8</span> ▶
            </button>
          </div>

          <div className="keyguide">
            Toggle: <b>7</b>/<b>8</b>
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="actions-row">
        <button type="button" onClick={exit} className="btn">
          Back (5)
        </button>
        <button type="button" onClick={confirm} className="btn btn--primary">
          Start (2)
        </button>
      </div>

      <div className="keyguide mt-2">
        Pads/Keys — Level: <b>1</b>/<b>3</b> • Time: <b>4</b>/<b>6</b> •
        Endless: <b>7</b>/<b>8</b> • Start: <b>2</b> • Back: <b>5</b>
      </div>

      <div className="keyguide mt-1">
        HR: <b>{bpm ?? "—"}</b> bpm
      </div>
    </div>
  );
}
