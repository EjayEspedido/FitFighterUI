// Modes.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Item = {
  label: string;
  desc: string;
  modeKey: "combo" | "fof" | "rhythm";
};

const ITEMS: Item[] = [
  {
    label: "Combo Mode",
    desc: "Memorize and execute punch strings...",
    modeKey: "combo",
  },
  {
    label: "Friend or Foe",
    desc: "Hit the foes...",
    modeKey: "fof",
  },
  {
    label: "Rhythm Game",
    desc: "Punch to the beat...",
    modeKey: "rhythm",
  },
];

export default function Modes() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  const moveUp = () => setIdx((i) => (i - 1 + ITEMS.length) % ITEMS.length);
  const moveDown = () => setIdx((i) => (i + 1) % ITEMS.length);

  // navigate to the start screen and send chosen mode
  const confirm = () => {
    const mode = ITEMS[idx].modeKey;
    // pass mode as a string so PlayStart can dispatch correctly
    navigate("/play/start", { state: { mode } });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "4" || e.key === "6") moveUp();
      else if (e.key === "7" || e.key === "8") moveDown();
      else if (e.key === "2" || e.key === "Enter" || e.key === " ") confirm();
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
