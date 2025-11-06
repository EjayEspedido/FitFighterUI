// StartScreenRhythm.tsx — defensive against empty songs + buttons outside card
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePadInput } from "../apis/RigInputProvider";
import "./StartScreen.css";

import { db } from "../firebase";
import { collection, getDocs, type QuerySnapshot } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";

export type Song = {
  id: string;
  title: string;
  artist?: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  durationSec: number;
  csvPath?: string;
  songPath?: string;
  csvOffset?: number;
  bpm?: number;
  createdAt?: string;
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

const slug = (s: string) =>
  s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

export default function StartScreenRhythm() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>(DEFAULT_SONGS);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const { last } = usePadInput();
  const lastSeen = useRef<number>(0);

  // Ensure there's always at least a safe selected object to avoid crashes
  const selectedSafe: Song = useMemo(() => {
    if (songs && songs.length > 0) {
      const idx = Math.max(0, Math.min(selectedIdx, songs.length - 1));
      return songs[idx];
    }
    // fallback stub
    return {
      id: "__none__",
      title: "No songs available",
      artist: undefined,
      difficulty: "Beginner",
      durationSec: 120,
    };
  }, [songs, selectedIdx]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!db) {
        console.warn("Firestore db not initialized; using default songs");
        return;
      }
      try {
        const snap: QuerySnapshot<DocumentData> = await getDocs(
          collection(db, "songs")
        );
        console.log("Firestore debug: songs docs count:", snap.size);
        snap.docs.forEach((d) =>
          console.log("Firestore debug: doc:", d.id, d.data())
        );

        if (cancelled) return;

        if (!snap.empty) {
          const mapped: Song[] = snap.docs.map((doc) => {
            const b = doc.data() as Record<string, any>;
            const id = String(b?.songID ?? doc.id);
            const title = String(b?.title ?? `Untitled-${id}`);
            const artist = typeof b?.artist === "string" ? b.artist : undefined;
            const rawDiff = (b?.difficulty ?? "Beginner") as string;
            const difficulty =
              rawDiff === "Beginner" ||
              rawDiff === "Intermediate" ||
              rawDiff === "Advanced" ||
              rawDiff === "Expert"
                ? (rawDiff as Song["difficulty"])
                : "Beginner";
            const duration =
              Number(b?.durationSec ?? b?.durationSeconds ?? 120) || 120;
            const csvPath =
              typeof b?.csvPath === "string" ? b.csvPath : undefined;
            const songPath =
              typeof b?.songPath === "string" ? b.songPath : undefined;
            const csvOffset =
              typeof b?.csvOffset === "number" ? b.csvOffset : undefined;
            const bpm = typeof b?.bpm === "number" ? b.bpm : undefined;
            const createdAt =
              typeof b?.createdAt === "string" ? b.createdAt : undefined;

            return {
              id,
              title,
              artist,
              difficulty,
              durationSec: duration,
              csvPath,
              songPath,
              csvOffset,
              bpm,
              createdAt,
            } as Song;
          });

          setSongs(mapped);
          setSelectedIdx(0);
        } else {
          // If collection empty, clear to empty array so UI shows the "No songs" state.
          console.warn("No documents found in 'songs' collection.");
          setSongs([]);
          setSelectedIdx(0);
        }
      } catch (err) {
        console.warn(
          "Failed reading songs from Firestore; using defaults",
          err
        );
        // keep defaults (or choose to set songs([]) if you prefer)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const prevSong = () => {
    if (songs.length === 0) return;
    setSelectedIdx((i) => (i - 1 + songs.length) % songs.length);
  };
  const nextSong = () => {
    if (songs.length === 0) return;
    setSelectedIdx((i) => (i + 1) % songs.length);
  };

  const startSong = async (song: Song) => {
    if (!song || song.id === "__none__") return;
    const sessionId = Date.now().toString();
    const deviceId = import.meta.env.VITE_MQTT_DEVICE || "pi01";
    const songBase = import.meta.env.VITE_SONG_BASE || "/home/fitfighter/songs";
    const audioPath = song.songPath ?? `${songBase}/${slug(song.title)}.wav`;
    const csvPath =
      song.csvPath ?? `${songBase}/${slug(song.title)}_Beatmap.csv`;

    const payload = {
      action: "start",
      game: "gameMode3",
      sessionId,
      replyTopic: `device/${deviceId}/control/ack/${sessionId}`,
      params: {
        user: 1,
        songId: song.id,
        difficulty: song.difficulty,
        audio: audioPath,
        csv: csvPath,
        csvOffset: song.csvOffset ?? 0,
        bpm: song.bpm ?? null,
      },
    };

    try {
      await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `device/${deviceId}/control/start`,
          payload,
          qos: 0,
        }),
      });
    } catch (err) {
      console.error("Failed to send start command", err);
    }

    navigate("/play/rhythm", { state: { song } });
  };

  // pad handling
  useEffect(() => {
    if (!last || last.ts === lastSeen.current) return;
    lastSeen.current = last.ts ?? 0;
    if (last.edge && last.edge !== "down") return;

    switch (last.pad) {
      case 4:
        prevSong();
        break;
      case 6:
        nextSong();
        break;
      case 2:
        startSong(selectedSafe);
        break;
      case 5:
        navigate("/Modes");
        break;
      default:
        break;
    }
  }, [last, songs, selectedSafe, navigate]);

  // keyboard handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.key) {
        case "4":
          prevSong();
          break;
        case "6":
          nextSong();
          break;
        case "Enter":
        case "2":
          startSong(selectedSafe);
          break;
        case "5":
        case "Escape":
          navigate("/Modes");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [songs, selectedSafe, navigate]);

  const hasSongs = songs.length > 0;

  return (
    <div className="page start-page">
      <h1 className="title">Rhythm Mode — Start</h1>

      <div style={{ padding: 6, fontSize: 12, opacity: 0.9 }}>
        Connected project: {(db as any)?.app?.options?.projectId ?? "unknown"}
      </div>

      <div className="start-card">
        <section className="section">
          <label className="section__label">Pick Song</label>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              className="btn arrow-btn"
              onClick={prevSong}
              aria-label="Previous song"
            >
              ◀ <span className="pad-hint">4</span>
            </button>

            <div style={{ flex: 1 }}>
              {hasSongs ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {songs.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedIdx(i)}
                      className={`btn small ${
                        i === selectedIdx ? "btn--active" : ""
                      }`}
                      style={{
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      aria-pressed={i === selectedIdx}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>
                        {s.artist ?? "Unknown"} • {s.difficulty} •{" "}
                        {Math.floor(s.durationSec / 60)}:
                        {String(s.durationSec % 60).padStart(2, "0")}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  style={{ padding: 12, textAlign: "center", color: "#888" }}
                >
                  No songs available
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn arrow-btn"
              onClick={nextSong}
              aria-label="Next song"
            >
              <span className="pad-hint">6</span> ▶
            </button>
          </div>

          <div className="keyguide">
            Change song: <b>4</b>/<b>6</b> (pads or keys)
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
                {Math.floor(selectedSafe.durationSec / 60)}:
                {String(selectedSafe.durationSec % 60).padStart(2, "0")}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Difficulty</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {selectedSafe.difficulty}
              </div>
            </div>
            <div className="btn small">
              <div style={{ fontSize: 11, opacity: 0.85 }}>Rating Impact</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                x
                {difficultyRatingToMultiplier(selectedSafe.difficulty).toFixed(
                  2
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Buttons outside the card */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          marginTop: 20,
        }}
      >
        <button className="btn" onClick={() => navigate("/Modes")}>
          Back (5)
        </button>
        <button
          className={`btn btn--primary ${!hasSongs ? "btn--disabled" : ""}`}
          onClick={() => startSong(selectedSafe)}
          disabled={!hasSongs}
        >
          Start (2)
        </button>
      </div>

      <div
        className="keyguide mt-2"
        style={{ textAlign: "center", marginTop: 10 }}
      >
        Pads/Keys — Change: <b>4</b>/<b>6</b> • Start: <b>2</b> • Back: <b>5</b>
      </div>
    </div>
  );
}
