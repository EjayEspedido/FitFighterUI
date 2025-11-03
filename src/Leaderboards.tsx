// src/Leaderboards.tsx
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { useRigInput } from "./apis/RigInputProvider";

type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";
type CatKey = "combo" | "fof" | "rhythm";

type Song = {
  id?: string;
  songID: number;
  title: string;
  difficulty?: string;
};

export default function Leaderboards() {
  const [cat, setCat] = useState<CatKey>("combo");
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<number | null>(null);
  const [comboRows, setComboRows] = useState<DocumentData[]>([]);
  const [fofRows, setFofRows] = useState<DocumentData[]>([]);
  const [rhythmRows, setRhythmRows] = useState<DocumentData[]>([]);
  const { addListener } = useRigInput();

  // Keyboard nav (preserve original behaviour)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const cats: CatKey[] = ["combo", "fof", "rhythm"];
      const ci = cats.indexOf(cat);

      if (e.key === "4" || e.key === "ArrowLeft") {
        setCat(cats[(ci - 1 + cats.length) % cats.length]);
      } else if (e.key === "6" || e.key === "ArrowRight") {
        setCat(cats[(ci + 1) % cats.length]);
      } else if (cat === "rhythm") {
        const si = songs.findIndex((s) => s.songID === selectedSong);
        if (e.key === "7") {
          const prev = songs[(si - 1 + songs.length) % songs.length];
          setSelectedSong(prev?.songID ?? null);
        } else if (e.key === "8") {
          const next = songs[(si + 1) % songs.length];
          setSelectedSong(next?.songID ?? null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cat, songs, selectedSong]);

  // Pad (MQTT) nav: mirror keyboard mapping
  useEffect(() => {
    const off = addListener((e: any) => {
      const cats: CatKey[] = ["combo", "fof", "rhythm"];
      const ci = cats.indexOf(cat);

      if (e.pad === 4) {
        setCat(cats[(ci - 1 + cats.length) % cats.length]);
      } else if (e.pad === 6) {
        setCat(cats[(ci + 1) % cats.length]);
      } else if (cat === "rhythm") {
        const si = songs.findIndex((s) => s.songID === selectedSong);
        if (e.pad === 7) {
          const prev = songs[(si - 1 + songs.length) % songs.length];
          setSelectedSong(prev?.songID ?? null);
        } else if (e.pad === 8) {
          const next = songs[(si + 1) % songs.length];
          setSelectedSong(next?.songID ?? null);
        }
      }
    });
    return off;
  }, [addListener, cat, songs, selectedSong]);

  /* ---------------- Firestore listeners ---------------- */

  // Songs: listen once, and set initial selectedSong when songs arrive.
  useEffect(() => {
    const qSongs = query(collection(db, "songs"), orderBy("songID", "asc"));
    const unsub = onSnapshot(
      qSongs,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Song, "id">),
        }));
        setSongs(list);
        // only set initial selectedSong if still null (so user selection isn't clobbered)
        if (list.length > 0 && selectedSong === null) {
          setSelectedSong(list[0].songID);
        }
      },
      (err) => {
        console.error("songs onSnapshot error:", err);
      }
    );
    return () => unsub();
    // NOTE: intentionally empty deps so we subscribe once.
    // Do not include selectedSong here.
  }, []);

  // Combo
  useEffect(() => {
    const q = query(
      collection(db, "comboSessions"),
      orderBy("score", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setComboRows(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        ),
      (err) => console.error("combo onSnapshot error:", err)
    );
    return () => unsub();
  }, []);

  // Friend or Foe
  useEffect(() => {
    const q = query(
      collection(db, "friendfoeSessions"),
      orderBy("score", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setFofRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.error("fof onSnapshot error:", err)
    );
    return () => unsub();
  }, []);

  // Rhythm (filtered by selectedSong).
  useEffect(() => {
    if (selectedSong === null) {
      // clear rhythm rows while waiting
      setRhythmRows([]);
      return;
    }
    const songIdNum = Number(selectedSong);
    if (Number.isNaN(songIdNum)) {
      console.warn("selectedSong is not numeric:", selectedSong);
      setRhythmRows([]);
      return;
    }

    const q = query(
      collection(db, "rhythmSessions"),
      where("songID", "==", songIdNum),
      orderBy("score", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setRhythmRows(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        ),
      (err) => console.error("rhythm onSnapshot error:", err)
    );
    return () => unsub();
  }, [selectedSong]);

  const rows = useMemo(() => {
    if (cat === "combo") return comboRows;
    if (cat === "fof") return fofRows;
    return rhythmRows;
  }, [cat, comboRows, fofRows, rhythmRows]);

  const fmtDate = (t?: Timestamp | any) => {
    if (!t) return "-";
    const d = t instanceof Timestamp ? t.toDate() : new Date(t);
    return d.toLocaleDateString();
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="page">
      <h1>Leaderboards</h1>

      {/* Category tabs */}
      <div className="lb-tabs">
        <button
          className={`lb-tab ${cat === "combo" ? "active" : ""}`}
          onClick={() => setCat("combo")}
        >
          Combo Mode
        </button>
        <button
          className={`lb-tab ${cat === "fof" ? "active" : ""}`}
          onClick={() => setCat("fof")}
        >
          Friend or Foe
        </button>
        <button
          className={`lb-tab ${cat === "rhythm" ? "active" : ""}`}
          onClick={() => setCat("rhythm")}
        >
          Rhythm Game
        </button>
      </div>

      {/* Rhythm song tabs */}
      {cat === "rhythm" && (
        <div className="lb-song-tabs">
          {songs.map((s) => (
            <button
              key={s.songID}
              className={`lb-song ${s.songID === selectedSong ? "active" : ""}`}
              onClick={() => setSelectedSong(s.songID)}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            {cat === "combo" && (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th>Level</th>
                <th>Score</th>
                <th>Max Score Combo</th>
                <th>Longest Combo</th>
                <th>Date</th>
              </tr>
            )}
            {cat === "fof" && (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th>Level</th>
                <th>Score</th>
                <th>Foes Hit</th>
                <th>Friends Hit</th>
                <th>Date</th>
              </tr>
            )}
            {cat === "rhythm" && (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th>Score</th>
                <th>Perfect</th>
                <th>Great</th>
                <th>Good</th>
                <th>Missed</th>
                <th>Max Combo</th>
                <th>Date</th>
              </tr>
            )}
          </thead>

          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.id ?? i}>
                <td>{i + 1}</td>
                <td>{r.displayName ?? r.name ?? "Anon"}</td>

                {cat === "combo" && (
                  <>
                    <td>
                      <LevelBadge level={r.level ?? "Beginner"} />
                    </td>
                    <td>{r.score?.toLocaleString()}</td>
                    <td>{r.maxScoreCombo ?? r.maxCombo ?? "-"}</td>
                    <td>{r.longestCombo ?? "-"}</td>
                    <td>{fmtDate(r.sessionDate ?? r.createdAt)}</td>
                  </>
                )}

                {cat === "fof" && (
                  <>
                    <td>
                      <LevelBadge level={r.level ?? "Beginner"} />
                    </td>
                    <td>{r.score?.toLocaleString()}</td>
                    <td>{r.foesHit ?? "-"}</td>
                    <td>{r.friendsHit ?? "-"}</td>
                    <td>{fmtDate(r.sessionDate ?? r.createdAt)}</td>
                  </>
                )}

                {cat === "rhythm" && (
                  <>
                    <td>{r.score?.toLocaleString()}</td>
                    <td>{r.perfectHit ?? "-"}</td>
                    <td>{r.greatHit ?? "-"}</td>
                    <td>{r.goodHit ?? "-"}</td>
                    <td>{r.missed ?? "-"}</td>
                    <td>{r.maxCombo ?? "-"}</td>
                    <td>{fmtDate(r.sessionDate ?? r.createdAt)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="keyguide">
        Categories: <b>4</b>/<b>6</b> • Rhythm Songs: <b>7</b>/<b>8</b>
      </div>
    </div>
  );
}

/* ---------- LevelBadge (unchanged) ---------- */
function LevelBadge({ level }: { level: Level }) {
  const color =
    level === "Expert"
      ? "#18ff6d"
      : level === "Advanced"
      ? "#8bffc0"
      : level === "Intermediate"
      ? "#bfffe1"
      : "#e2fff3";
  const glow =
    level === "Expert"
      ? "0 0 10px rgba(24,255,109,.6)"
      : "0 0 8px rgba(24,255,109,.25)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        border: `1px solid ${color}`,
        borderRadius: 8,
        color,
        textShadow: glow,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {level}
    </span>
  );
}
