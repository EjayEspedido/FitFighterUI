import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Item = { label: string; desc: string; mode: 1 | 2 | 3 };

const ITEMS: Item[] = [
  {
    label: "Combo Mode",
    desc: "Memorize and execute punch strings for high scores.",
    mode: 1,
  },
  {
    label: "Friend or Foe",
    desc: "Hit the foes, spare your friends. Precision matters.",
    mode: 2,
  },
  {
    label: "Rhythm Game",
    desc: "Punch to the beat. Chain perfects for massive combos.",
    mode: 3,
  },
];

export default function Modes() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  const moveUp = () => setIdx((i) => (i - 1 + ITEMS.length) % ITEMS.length);
  const moveDown = () => setIdx((i) => (i + 1) % ITEMS.length);
  const confirm = () => navigate(`/start?mode=${ITEMS[idx].mode}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "4" || e.key === "6") moveUp(); // UP
      else if (e.key === "7" || e.key === "8") moveDown(); // DOWN
      else if (e.key === "2" || e.key === "Enter" || e.key === " ") confirm(); // CONFIRM
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page">
      <h1>🎮 Select Game Mode</h1>

      <div className="menu">
        {ITEMS.map((item, i) => {
          const active = i === idx;
          return (
            <button
              key={item.label}
              className={`menu-item ${active ? "active" : ""}`}
              onClick={() => setIdx(i)}
              onDoubleClick={confirm}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") confirm();
              }}
              aria-current={active ? "true" : "false"}
            >
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {item.label}
                </div>
                <div className="menu-desc">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="keyguide">
        <b>4/6</b> = Up • <b>7/8</b> = Down • <b>2</b> = Confirm
      </div>
    </div>
  );
}
