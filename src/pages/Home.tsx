import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Item = { label: string; path: string };

const ITEMS: Item[] = [
  { label: "Play", path: "/modes" },
  { label: "Statistics", path: "/leaderboards" }, // change to /statistics if you add that route
  { label: "Tutorial", path: "/tutorial" },
];

export default function Home() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  const moveUp = () => setIdx((i) => (i - 1 + ITEMS.length) % ITEMS.length);
  const moveDown = () => setIdx((i) => (i + 1) % ITEMS.length);
  const confirm = () => navigate(ITEMS[idx].path);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "4" || e.key === "6") moveUp(); // UP
      else if (e.key === "7" || e.key === "8") moveDown(); // DOWN
      else if (e.key === "5" || e.key === "Enter" || e.key === "2") confirm(); // CONFIRM
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page home">
      {/* Title + Tagline */}
      <div className="hero">
        <h1 className="title">FIT FIGHTER</h1>
        <p className="tagline">The ultimate arcade boxing experience.</p>
      </div>

      {/* Menu */}
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
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="keyguide">
        Press <b>4</b>/<b>6</b> = Up • <b>7</b>/<b>8</b> = Down • <b>5</b> =
        Confirm
      </div>
    </div>
  );
}
