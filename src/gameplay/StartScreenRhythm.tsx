// StartScreenRhythm.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePadInput } from "../apis/RigInputProvider";
import "./StartScreen.css";

export type Song = {
  id: string;
  title: string;
  artist?: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  durationSec: number;
};

const DEFAULT_SONGS: Song[] = [
  {
    id: "s1",
    title: "Pulse Drive",
    artist: "Local",
    difficulty: "Beginner",
    durationSec: 60,
  },
  {
    id: "s2",
    title: "Neon Night",
    artist: "Synth",
    difficulty: "Intermediate",
    durationSec: 90,
  },
  {
    id: "s3",
    title: "Binary Beat",
    artist: "Chip",
    difficulty: "Advanced",
    durationSec: 120,
  },
  {
    id: "s4",
    title: "Hypernova",
    artist: "Studio",
    difficulty: "Expert",
    durationSec: 150,
  },
];

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

export default function StartScreenRhythm() {
  const navigate = useNavigate();
  const [songs] = useState<Song[]>(DEFAULT_SONGS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = useMemo(() => songs[selectedIdx], [songs, selectedIdx]);

  const { last } = usePadInput();
  const lastSeen = useRef<number>(0);

  useEffect(() => {
    if (!last || last.ts === lastSeen.current) return;
    lastSeen.current = last.ts ?? 0;
    if (last.edge && last.edge !== "down") return;
    switch (last.pad) {
      case 1:
        setSelectedIdx((i) => Math.max(0, i - 1));
        break;
      case 3:
        setSelectedIdx((i) => Math.min(songs.length - 1, i + 1));
        break;
      case 2:
        navigate("/play/rhythm", { state: { song: selected } });
        break;
      case 5:
        navigate("/");
        break;
    }
  }, [last, songs, selected, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.key) {
        case "ArrowUp":
          setSelectedIdx((i) => Math.max(0, i - 1));
          break;
        case "ArrowDown":
          setSelectedIdx((i) => Math.min(songs.length - 1, i + 1));
          break;
        case "Enter":
        case " ":
          navigate("/play/rhythm", { state: { song: selected } });
          break;
        case "Escape":
          navigate("/");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [songs, selected, navigate]);

  return (
    <div className="page start-page">
      <h1 className="title">Rhythm Mode — Start</h1>
      <div className="start-card">
        <section className="section">
          <label className="section__label">Pick Song</label>
          <div style={{ display: "grid", gap: 6 }}>
            {songs.map((s, i) => (
              <div
                key={s.id}
                className={`btn small ${i === selectedIdx ? "active" : ""}`}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  {s.artist} • {s.difficulty} • {Math.floor(s.durationSec / 60)}
                  :{String(s.durationSec % 60).padStart(2, "0")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section" style={{ marginTop: 8 }}>
          <label className="section__label">Session</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Duration</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {Math.floor(selected.durationSec / 60)}:
                {String(selected.durationSec % 60).padStart(2, "0")}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Difficulty</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {selected.difficulty}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Rating Impact</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                x{difficultyRatingToMultiplier(selected.difficulty).toFixed(2)}
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
          <button className="btn" onClick={() => navigate("/")}>
            Back
          </button>
          <button
            className="btn btn--primary"
            onClick={() =>
              navigate("/play/rhythm", { state: { song: selected } })
            }
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
