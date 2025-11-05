import { useEffect, useMemo, useRef, useState } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
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

const AGE_RANGES = ["all", "13-29", "30-59", "60+"] as const;

export default function Leaderboards() {
  const [cat, setCat] = useState<CatKey>("combo");
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<number | null>(null);
  const [comboRows, setComboRows] = useState<DocumentData[]>([]);
  const [fofRows, setFofRows] = useState<DocumentData[]>([]);
  const [rhythmRows, setRhythmRows] = useState<DocumentData[]>([]);
  const { addListener } = useRigInput();

  const [ageFilter, setAgeFilter] = useState<(typeof AGE_RANGES)[number]>("all");
  const [ownOnly, setOwnOnly] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const userCacheRef = useRef<Map<string, any>>(new Map());

  // helpers to cycle ranges
  function nextAgeRange(cur: (typeof AGE_RANGES)[number]) {
    const i = AGE_RANGES.indexOf(cur);
    return AGE_RANGES[(i + 1) % AGE_RANGES.length];
  }
  function prevAgeRange(cur: (typeof AGE_RANGES)[number]) {
    const i = AGE_RANGES.indexOf(cur);
    return AGE_RANGES[(i - 1 + AGE_RANGES.length) % AGE_RANGES.length];
  }

  /* keyboard + pad handlers */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const cats: CatKey[] = ["combo", "fof", "rhythm"];
      const ci = cats.indexOf(cat);

      if (e.key === "4" || e.key === "ArrowLeft") {
        setCat(cats[(ci - 1 + cats.length) % cats.length]);
        return;
      }
      if (e.key === "6" || e.key === "ArrowRight") {
        setCat(cats[(ci + 1) % cats.length]);
        return;
      }

      if (cat === "rhythm") {
        const si = songs.findIndex((s) => s.songID === selectedSong);
        if (e.key === "7") {
          const prev = songs[(si - 1 + songs.length) % songs.length];
          setSelectedSong(prev?.songID ?? null);
        } else if (e.key === "8") {
          const next = songs[(si + 1) % songs.length];
          setSelectedSong(next?.songID ?? null);
        }
        return;
      }

      if (cat === "combo" || cat === "fof") {
        if (e.key === "7") setAgeFilter((a) => prevAgeRange(a));
        else if (e.key === "8") setAgeFilter((a) => nextAgeRange(a));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cat, songs, selectedSong]);

  useEffect(() => {
    const off = addListener((e: any) => {
      const cats: CatKey[] = ["combo", "fof", "rhythm"];
      const ci = cats.indexOf(cat);

      if (e.pad === 4) {
        setCat(cats[(ci - 1 + cats.length) % cats.length]);
        return;
      }
      if (e.pad === 6) {
        setCat(cats[(ci + 1) % cats.length]);
        return;
      }

      if (cat === "rhythm") {
        const si = songs.findIndex((s) => s.songID === selectedSong);
        if (e.pad === 7) {
          const prev = songs[(si - 1 + songs.length) % songs.length];
          setSelectedSong(prev?.songID ?? null);
        } else if (e.pad === 8) {
          const next = songs[(si + 1) % songs.length];
          setSelectedSong(next?.songID ?? null);
        }
        return;
      }

      if (cat === "combo" || cat === "fof") {
        if (e.pad === 7) setAgeFilter((a) => prevAgeRange(a));
        else if (e.pad === 8) setAgeFilter((a) => nextAgeRange(a));
      }
    });
    return off;
  }, [addListener, cat, songs, selectedSong]);

  /* songs listener */
  useEffect(() => {
    const qSongs = query(collection(db, "songs"), orderBy("songID", "asc"));
    const unsub = onSnapshot(
      qSongs,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Song, "id">) }));
        setSongs(list);
        if (list.length > 0 && selectedSong === null) setSelectedSong(list[0].songID);
      },
      (err) => console.error("songs onSnapshot error:", err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => setCurrentUid(u?.uid ?? null));
    return () => off();
  }, []);

  /* user helper and cache */
  function extractUidFromSession(row: any): string | null {
    if (!row) return null;
    return row.uid ?? row.userId ?? row.playerId ?? row.playerUid ?? (row.user && row.user.uid) ?? null;
  }

  async function fetchUserByUid(uid: string) {
    if (!uid) return null;
    const cache = userCacheRef.current;
    if (cache.has(uid)) return cache.get(uid);
    try {
      const dref = doc(db, "users", uid);
      const snap = await getDoc(dref);
      if (!snap.exists()) {
        cache.set(uid, null);
        return null;
      }
      const data = snap.data();
      cache.set(uid, data);
      return data;
    } catch (err) {
      console.error("fetchUserByUid error", err);
      return null;
    }
  }

  function ageMatchesFilter(age: number | undefined | null, ageFilter: string) {
    if (ageFilter === "all") return true;
    if (age == null) return false;
    if (ageFilter === "13-29") return age >= 13 && age <= 29;
    if (ageFilter === "30-59") return age >= 30 && age <= 59;
    if (ageFilter === "60+") return age >= 60;
    return true;
  }

  async function processRows(docs: any[]) {
    const uids = Array.from(new Set(docs.map((r) => extractUidFromSession(r)).filter(Boolean) as string[]));
    await Promise.all(uids.map((u) => fetchUserByUid(u)));
    return docs
      .map((r) => {
        const uid = extractUidFromSession(r);
        const user = uid ? userCacheRef.current.get(uid) ?? null : null;
        return { ...r, userAge: user?.age ?? null, __uid: uid ?? null };
      })
      .filter((r) => ageMatchesFilter(r.userAge, ageFilter))
      .filter((r) => (ownOnly ? r.__uid === currentUid : true));
  }

  /* listeners for leaderboards */
  useEffect(() => {
    const q = query(collection(db, "comboSessions"), orderBy("score", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      async (snap) => setComboRows(await processRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))),
      (err) => console.error("combo onSnapshot error:", err)
    );
    return () => unsub();
  }, [ageFilter, ownOnly, currentUid]);

  useEffect(() => {
    const q = query(collection(db, "friendfoeSessions"), orderBy("score", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      async (snap) => setFofRows(await processRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))),
      (err) => console.error("fof onSnapshot error:", err)
    );
    return () => unsub();
  }, [ageFilter, ownOnly, currentUid]);

  useEffect(() => {
    if (selectedSong === null) {
      setRhythmRows([]);
      return;
    }
    const songIdNum = Number(selectedSong);
    if (Number.isNaN(songIdNum)) {
      setRhythmRows([]);
      return;
    }
    const q = query(collection(db, "rhythmSessions"), where("songID", "==", songIdNum), orderBy("score", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => setRhythmRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))) ,
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

  return (
    <div className="page">
      <div className="lb-container" style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 18px" }}>
        <h1 className="title">Leaderboards</h1>

        {/* top category tabs - no songs inline here */}
        <div className="lb-tabs" role="tablist" aria-label="Leaderboard categories">
          <button className={`lb-tab ${cat === "combo" ? "active" : ""}`} onClick={() => setCat("combo")}>
            Combo Mode
          </button>
          <button className={`lb-tab ${cat === "fof" ? "active" : ""}`} onClick={() => setCat("fof")}>
            Friend or Foe
          </button>
          <button className={`lb-tab ${cat === "rhythm" ? "active" : ""}`} onClick={() => setCat("rhythm")}>
            Rhythm Game
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 36, alignItems: "flex-start" }}>
          {/* LEFT sticky filter column - songs or ages depending on category */}
          <aside style={{ width: 180, flex: "0 0 180px" }}>
            <div style={{ position: "sticky", top: 28 }}>
              {(cat === "combo" || cat === "fof") && (
                <div className="menu" style={{ width: "100%" }}>
                  <div style={{ fontSize: 12, color: "var(--neon)", marginBottom: 8, textAlign: "left" }}>Age Range</div>
                  {AGE_RANGES.map((r) => (
                    <button
                      key={r}
                      className={`menu-item ${ageFilter === r ? "active" : ""}`}
                      onClick={() => setAgeFilter(r)}
                      style={{ width: "100%" }}
                      aria-pressed={ageFilter === r}
                    >
                      {r === "all" ? "All Ages" : r}
                    </button>
                  ))}

                  <label className="custom-check" style={{ marginTop: 12 }}>
                    <input type="checkbox" checked={ownOnly} onChange={(e) => setOwnOnly(e.target.checked)} />
                    <span className="box" aria-hidden="true" />
                    <span>Only show my scores</span>
                  </label>
                </div>
              )}

              {cat === "rhythm" && (
                <div className="menu" style={{ width: "100%" }}>
                  <div style={{ fontSize: 12, color: "var(--neon)", marginBottom: 8, textAlign: "left" }}>Songs</div>
                  {songs.map((s) => (
                    <button
                      key={s.songID}
                      className={`menu-item ${selectedSong === s.songID ? "active" : ""}`}
                      onClick={() => setSelectedSong(s.songID)}
                      style={{ width: "100%" }}
                      aria-pressed={selectedSong === s.songID}
                    >
                      {s.title}
                    </button>
                  ))}

                  <label className="custom-check" style={{ marginTop: 12 }}>
                    <input type="checkbox" checked={ownOnly} onChange={(e) => setOwnOnly(e.target.checked)} />
                    <span className="box" aria-hidden="true" />
                    <span>Only show my scores</span>
                  </label>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT: leaderboard table */}
          <main style={{ flex: "1 1 760px", maxWidth: 760 }}>
            <div className="lb-table-wrap" style={{ marginTop: 8 }}>
              <table className="lb-table" role="table" aria-label="Leaderboard table">
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
                      <th>Age</th>
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
                      <th>Age</th>
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
                          <td><LevelBadge level={r.level ?? "Beginner"} /></td>
                          <td>{r.score?.toLocaleString()}</td>
                          <td>{r.maxScoreCombo ?? r.maxCombo ?? "-"}</td>
                          <td>{r.longestCombo ?? "-"}</td>
                          <td>{fmtDate(r.sessionDate ?? r.createdAt)}</td>
                          <td>{r.userAge ?? "-"}</td>
                        </>
                      )}

                      {cat === "fof" && (
                        <>
                          <td><LevelBadge level={r.level ?? "Beginner"} /></td>
                          <td>{r.score?.toLocaleString()}</td>
                          <td>{r.foesHit ?? "-"}</td>
                          <td>{r.friendsHit ?? "-"}</td>
                          <td>{fmtDate(r.sessionDate ?? r.createdAt)}</td>
                          <td>{r.userAge ?? "-"}</td>
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
          </main>
        </div>

        <div style={{ marginTop: 12, textAlign: "center", color: "var(--neon, #9ef8c6)" }}>
          Categories: <b>4</b>/<b>6</b> • Rhythm Songs: <b>7</b>/<b>8</b> • Ages: <b>7</b>/<b>8</b>
        </div>
      </div>
    </div>
  );
}

/* LevelBadge helper */
function LevelBadge({ level }: { level: Level }) {
  const color =
    level === "Expert" ? "#18ff6d" : level === "Advanced" ? "#8bffc0" : level === "Intermediate" ? "#bfffe1" : "#e2fff3";
  const glow = level === "Expert" ? "0 0 10px rgba(24,255,109,.6)" : "0 0 8px rgba(24,255,109,.25)";
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
