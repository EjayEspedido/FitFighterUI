import { useEffect, useMemo, useState } from "react";

type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";
type Row = {
  name: string;
  level: Level;
  score: number;
  maxScoreCombo: number; // longest without error
  longestCombo: number; // overall longest combo
};

const comboData: Row[] = [
  {
    name: "Aly",
    level: "Expert",
    score: 9820,
    maxScoreCombo: 64,
    longestCombo: 79,
  },
  {
    name: "Ben",
    level: "Advanced",
    score: 8760,
    maxScoreCombo: 48,
    longestCombo: 62,
  },
  {
    name: "Cara",
    level: "Intermediate",
    score: 7340,
    maxScoreCombo: 33,
    longestCombo: 41,
  },
  {
    name: "Dee",
    level: "Beginner",
    score: 5100,
    maxScoreCombo: 18,
    longestCombo: 25,
  },
];

const fofData: Row[] = [
  {
    name: "Aly",
    level: "Expert",
    score: 8420,
    maxScoreCombo: 51,
    longestCombo: 68,
  },
  {
    name: "Evan",
    level: "Advanced",
    score: 7990,
    maxScoreCombo: 44,
    longestCombo: 55,
  },
  {
    name: "Mira",
    level: "Intermediate",
    score: 6120,
    maxScoreCombo: 27,
    longestCombo: 39,
  },
  {
    name: "Zee",
    level: "Beginner",
    score: 3980,
    maxScoreCombo: 14,
    longestCombo: 21,
  },
];

const rhythmData: Row[] = [
  {
    name: "Aly",
    level: "Expert",
    score: 11020,
    maxScoreCombo: 72,
    longestCombo: 91,
  },
  {
    name: "Jin",
    level: "Advanced",
    score: 9720,
    maxScoreCombo: 58,
    longestCombo: 70,
  },
  {
    name: "Kai",
    level: "Intermediate",
    score: 8010,
    maxScoreCombo: 39,
    longestCombo: 52,
  },
  {
    name: "Lia",
    level: "Beginner",
    score: 5200,
    maxScoreCombo: 21,
    longestCombo: 29,
  },
];

const CATEGORIES = [
  { key: "combo", label: "Combo Mode", data: comboData },
  { key: "fof", label: "Friend or Foe", data: fofData },
  { key: "rhythm", label: "Rhythm", data: rhythmData },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

export default function Leaderboards() {
  const [cat, setCat] = useState<CatKey>("combo");

  const rows = useMemo(() => {
    const found = CATEGORIES.find((c) => c.key === cat)!;
    // Sort by score desc as a default
    return [...found.data].sort((a, b) => b.score - a.score);
  }, [cat]);

  // Keyboard: Left/Right or 1/2/3 switch category
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const idx = CATEGORIES.findIndex((c) => c.key === cat);
      if (e.key === "ArrowRight" || e.key === "3") {
        setCat(CATEGORIES[(idx + 1) % CATEGORIES.length].key);
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        setCat(
          CATEGORIES[(idx - 1 + CATEGORIES.length) % CATEGORIES.length].key
        );
      } else if (e.key === "2") {
        setCat("fof");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cat]);

  return (
    <div className="page">
      <h1>📊 Leaderboards</h1>

      {/* Category tabs */}
      <div className="lb-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`lb-tab ${c.key === cat ? "active" : ""}`}
            onClick={() => setCat(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th style={{ width: "36px" }}>#</th>
              <th>Name</th>
              <th>Level</th>
              <th>Score</th>
              <th>Max Score Combo</th>
              <th>Longest Combo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
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
          </tbody>
        </table>
      </div>

      <div className="keyguide">
        Use <b>←/→</b> or <b>1–3</b> to switch category
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
