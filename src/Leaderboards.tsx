import { useEffect, useMemo, useState } from "react";

type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

/* ---------- SAMPLE DATA ---------- */
const comboRows = [
  {
    name: "Aly",
    level: "Expert" as Level,
    score: 9820,
    maxScoreCombo: 64,
    longestCombo: 79,
  },
  {
    name: "Ben",
    level: "Advanced" as Level,
    score: 8760,
    maxScoreCombo: 48,
    longestCombo: 62,
  },
  {
    name: "Cara",
    level: "Intermediate" as Level,
    score: 7340,
    maxScoreCombo: 33,
    longestCombo: 41,
  },
  {
    name: "Dee",
    level: "Beginner" as Level,
    score: 5100,
    maxScoreCombo: 18,
    longestCombo: 25,
  },
];

const fofRows = [
  {
    name: "Aly",
    level: "Expert" as Level,
    score: 8420,
    foesHit: 132,
    friendsSaved: 118,
    foesMissed: 14,
    friendsHit: 6,
    goldenHits: 9,
  },
  {
    name: "Evan",
    level: "Advanced" as Level,
    score: 7990,
    foesHit: 121,
    friendsSaved: 104,
    foesMissed: 18,
    friendsHit: 11,
    goldenHits: 6,
  },
  {
    name: "Mira",
    level: "Intermediate" as Level,
    score: 6120,
    foesHit: 96,
    friendsSaved: 82,
    foesMissed: 23,
    friendsHit: 19,
    goldenHits: 3,
  },
  {
    name: "Zee",
    level: "Beginner" as Level,
    score: 3980,
    foesHit: 61,
    friendsSaved: 55,
    foesMissed: 28,
    friendsHit: 26,
    goldenHits: 1,
  },
];

/** Rhythm is per-song: a mapping from song key -> rows */
const RHYTHM_SONGS = [
  { key: "neoncity", label: "Neon City" },
  { key: "skyline", label: "Skyline Run" },
  { key: "breaker", label: "Beat Breaker" },
] as const;
type SongKey = (typeof RHYTHM_SONGS)[number]["key"];

const rhythmBySong: Record<
  SongKey,
  Array<{
    name: string;
    score: number;
    accuracy: number;
    perfect: number;
    great: number;
    good: number;
    missed: number;
    maxCombo: number;
  }>
> = {
  neoncity: [
    {
      name: "Aly",
      score: 11020,
      accuracy: 98.4,
      perfect: 221,
      great: 38,
      good: 9,
      missed: 4,
      maxCombo: 91,
    },
    {
      name: "Jin",
      score: 9720,
      accuracy: 96.1,
      perfect: 198,
      great: 45,
      good: 15,
      missed: 8,
      maxCombo: 70,
    },
    {
      name: "Kai",
      score: 8010,
      accuracy: 93.2,
      perfect: 164,
      great: 54,
      good: 23,
      missed: 16,
      maxCombo: 52,
    },
  ],
  skyline: [
    {
      name: "Aly",
      score: 10540,
      accuracy: 97.9,
      perfect: 208,
      great: 49,
      good: 11,
      missed: 6,
      maxCombo: 87,
    },
    {
      name: "Lia",
      score: 9220,
      accuracy: 95.3,
      perfect: 184,
      great: 52,
      good: 19,
      missed: 12,
      maxCombo: 66,
    },
  ],
  breaker: [
    {
      name: "Jin",
      score: 10180,
      accuracy: 97.2,
      perfect: 214,
      great: 47,
      good: 12,
      missed: 7,
      maxCombo: 83,
    },
    {
      name: "Zee",
      score: 7840,
      accuracy: 92.6,
      perfect: 152,
      great: 58,
      good: 31,
      missed: 22,
      maxCombo: 48,
    },
  ],
};
/* --------------------------------- */

const CATS = [
  { key: "combo", label: "Combo Mode" },
  { key: "fof", label: "Friend or Foe" },
  { key: "rhythm", label: "Rhythm Game" },
] as const;
type CatKey = (typeof CATS)[number]["key"];

export default function Leaderboards() {
  const [cat, setCat] = useState<CatKey>("combo");
  const [song, setSong] = useState<SongKey>("neoncity");

  // Keyboard: 4/6 = category left/right; 7/8 = rhythm song up/down
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const ci = CATS.findIndex((c) => c.key === cat);

      if (e.key === "4" || e.key === "ArrowLeft") {
        setCat(CATS[(ci - 1 + CATS.length) % CATS.length].key);
      } else if (e.key === "6" || e.key === "ArrowRight") {
        setCat(CATS[(ci + 1) % CATS.length].key);
      } else if (cat === "rhythm") {
        const si = RHYTHM_SONGS.findIndex((s) => s.key === song);
        if (e.key === "7") {
          setSong(
            RHYTHM_SONGS[(si - 1 + RHYTHM_SONGS.length) % RHYTHM_SONGS.length]
              .key
          );
        } else if (e.key === "8") {
          setSong(RHYTHM_SONGS[(si + 1) % RHYTHM_SONGS.length].key);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cat, song]);

  const rows = useMemo(() => {
    if (cat === "combo")
      return [...comboRows].sort((a, b) => b.score - a.score);
    if (cat === "fof") return [...fofRows].sort((a, b) => b.score - a.score);
    return [...rhythmBySong[song]].sort((a, b) => b.score - a.score);
  }, [cat, song]);

  return (
    <div className="page">
      <h1>Leaderboards</h1>

      {/* Category tabs */}
      <div className="lb-tabs">
        {CATS.map((c) => (
          <button
            key={c.key}
            className={`lb-tab ${c.key === cat ? "active" : ""}`}
            onClick={() => setCat(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Rhythm song tabs (only when Rhythm selected) */}
      {cat === "rhythm" && (
        <div className="lb-song-tabs">
          {RHYTHM_SONGS.map((s) => (
            <button
              key={s.key}
              className={`lb-song ${s.key === song ? "active" : ""}`}
              onClick={() => setSong(s.key)}
            >
              {s.label}
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
              </tr>
            )}
            {cat === "fof" && (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th>Level</th>
                <th>Score</th>
                <th>Foes Hit</th>
                <th>Friends Saved</th>
                <th>Foes Missed</th>
                <th>Friends Hit</th>
                <th>Golden Hits</th>
              </tr>
            )}
            {cat === "rhythm" && (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Perfect</th>
                <th>Great</th>
                <th>Good</th>
                <th>Missed</th>
                <th>Max Combo</th>
              </tr>
            )}
          </thead>

          <tbody>
            {cat === "combo" &&
              rows.map((r: any, i) => (
                <tr key={r.name + i}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>
                    <LevelBadge level={r.level} />
                  </td>
                  <td>{r.score.toLocaleString()}</td>
                  <td>{r.maxScoreCombo}</td>
                  <td>{r.longestCombo}</td>
                </tr>
              ))}

            {cat === "fof" &&
              rows.map((r: any, i) => (
                <tr key={r.name + i}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>
                    <LevelBadge level={r.level} />
                  </td>
                  <td>{r.score.toLocaleString()}</td>
                  <td>{r.foesHit}</td>
                  <td>{r.friendsSaved}</td>
                  <td>{r.foesMissed}</td>
                  <td>{r.friendsHit}</td>
                  <td>{r.goldenHits}</td>
                </tr>
              ))}

            {cat === "rhythm" &&
              rows.map((r: any, i) => (
                <tr key={r.name + i}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.score.toLocaleString()}</td>
                  <td>{r.accuracy.toFixed(1)}%</td>
                  <td>{r.perfect}</td>
                  <td>{r.great}</td>
                  <td>{r.good}</td>
                  <td>{r.missed}</td>
                  <td>{r.maxCombo}</td>
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
