// PlayRhythm.tsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePadInput } from "../../apis/RigInputProvider";
import "../StartScreen.css";

// duplicate Song type here so file is standalone; if you prefer, import it from a shared types file
export type Song = {
  id: string;
  title: string;
  artist?: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  durationSec: number;
};

export function difficultyRatingToMultiplier(d: Song["difficulty"]) {
  switch (d) {
    case "Beginner":
      return 1;
    case "Intermediate":
      return 1.15;
    case "Advanced":
      return 1.35;
    case "Expert":
      return 1.6;
  }
}

export default function PlayRhythm() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const song: Song = state?.song ?? {
    id: "s1",
    title: "Pulse Drive",
    difficulty: "Beginner",
    durationSec: 60,
  };

  const [timeLeft, setTimeLeft] = useState<number>(song.durationSec);

  const [goodHits, setGoodHits] = useState(0);
  const [greatHits, setGreatHits] = useState(0);
  const [perfectHits, setPerfectHits] = useState(0);
  const [missHits, setMissHits] = useState(0);

  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);

  const startTs = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const { last } = usePadInput();
  const lastSeen = useRef<number>(0);

  useEffect(() => {
    startTs.current = Date.now();
    tickRef.current = window.setInterval(
      () => setTimeLeft((t) => Math.max(0, t - 1)),
      1000
    );
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      const rating = computeRatingFromScore(score, song.durationSec);
      const durationPlayed = Math.max(
        0,
        (Date.now() - (startTs.current ?? Date.now())) / 1000
      );
      navigate("/play/rhythm/end", {
        state: {
          result: {
            song,
            score,
            goodHits,
            greatHits,
            perfectHits,
            missHits,
            combo,
            maxCombo,
            durationPlayedSec: Math.round(durationPlayed),
            rating,
          },
        },
      });
    }
  }, [
    timeLeft,
    score,
    perfectHits,
    greatHits,
    goodHits,
    missHits,
    combo,
    maxCombo,
    navigate,
    song.durationSec,
    song,
  ]);

  useEffect(() => {
    if (!last || last.ts === lastSeen.current) return;
    lastSeen.current = last.ts ?? 0;
    if (last.edge && last.edge !== "down") return;
    switch (last.pad) {
      case 1:
        handleHit("perfect");
        break;
      case 2:
        handleHit("great");
        break;
      case 3:
        handleHit("good");
        break;
      case 4:
        handleHit("miss");
        break;
    }
  }, [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.key) {
        case "1":
          handleHit("perfect");
          break;
        case "2":
          handleHit("great");
          break;
        case "3":
          handleHit("good");
          break;
        case "4":
          handleHit("miss");
          break;
        case "Escape":
          // quick exit to end screen for debugging
          navigate("/play/rhythm/end", {
            state: {
              result: {
                song,
                score,
                perfectHits,
                greatHits,
                goodHits,
                missHits,
                combo,
                maxCombo,
                durationPlayedSec: Math.round(
                  (Date.now() - (startTs.current ?? Date.now())) / 1000
                ),
              },
            },
          });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    navigate,
    song,
    score,
    perfectHits,
    greatHits,
    goodHits,
    missHits,
    combo,
    maxCombo,
  ]);

  function handleHit(type: "perfect" | "great" | "good" | "miss") {
    if (type === "perfect") {
      setPerfectHits((v) => v + 1);
      addScore(300);
      bumpCombo();
    } else if (type === "great") {
      setGreatHits((v) => v + 1);
      addScore(200);
      bumpCombo();
    } else if (type === "good") {
      setGoodHits((v) => v + 1);
      addScore(100);
      bumpCombo();
    } else {
      setMissHits((v) => v + 1);
      resetCombo();
    }
  }

  function addScore(v: number) {
    const mul = difficultyRatingToMultiplier(song.difficulty);
    setScore((s) => s + Math.round(v * mul));
  }
  function bumpCombo() {
    setCombo((c) => {
      const nc = c + 1;
      setMaxCombo((m) => Math.max(m, nc));
      return nc;
    });
  }
  function resetCombo() {
    setCombo(0);
  }

  return (
    <div className="page start-page" style={{ padding: 12 }}>
      <h1 className="title">Rhythm Mode — Playing</h1>
      <div className="start-card">
        <section className="section">
          <label className="section__label">Now Playing</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Song</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{song.title}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Time Left</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, "0")}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Combo</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {combo} (max {maxCombo})
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ marginTop: 8 }}>
          <label className="section__label">Stats</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Perfect</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{perfectHits}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Great</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{greatHits}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Good</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{goodHits}</div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Miss</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>{missHits}</div>
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
          <button
            className="btn"
            onClick={() =>
              navigate("/play/rhythm/end", {
                state: {
                  result: {
                    song,
                    score,
                    perfectHits,
                    greatHits,
                    goodHits,
                    missHits,
                    combo,
                    maxCombo,
                    durationPlayedSec: Math.round(
                      (Date.now() - (startTs.current ?? Date.now())) / 1000
                    ),
                  },
                },
              })
            }
          >
            End Now
          </button>
        </div>
      </div>
    </div>
  );
}

function computeRatingFromScore(score: number, durationSec: number) {
  const sps = score / Math.max(1, durationSec);
  if (sps >= 270) return "SS";
  if (sps >= 200) return "S";
  if (sps >= 150) return "A";
  if (sps >= 100) return "B";
  if (sps >= 50) return "C";
  return "F";
}
