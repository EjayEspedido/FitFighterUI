import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePadInput } from "../apis/RigInputProvider"; // ⬅️ new
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

type Item = { label: string; path: string };

const ITEMS: Item[] = [
  { label: "Play", path: "/modes" },
  { label: "Statistics", path: "/leaderboards" }, // change to /statistics if you add that route
  { label: "Tutorial", path: "/tutorial" },
];

export default function Home() {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const { addListener } = usePadInput(); // ⬅️ new

  const moveUp = () => setIdx((i) => (i - 1 + ITEMS.length) % ITEMS.length);
  const moveDown = () => setIdx((i) => (i + 1) % ITEMS.length);
  const confirm = () => navigate(ITEMS[idx].path);

  // Keyboard controls (existing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "4" || e.key === "6") moveUp(); // UP
      else if (e.key === "7" || e.key === "8") moveDown(); // DOWN
      else if (e.key === "2" || e.key === "Enter") confirm(); // CONFIRM
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pad controls via MQTT (new)
  useEffect(() => {
    const off = addListener((e) => {
      // e.pad is 1..8, we mirror your keyboard mapping:
      if (e.pad === 4 || e.pad === 6) moveUp(); // UP
      else if (e.pad === 7 || e.pad === 8) moveDown(); // DOWN
      else if (e.pad === 2) confirm(); // CONFIRM
    });
    return off;
  }, [addListener]);

  return (
    <div className="page home">
      {/* Title + Tagline */}
      <div className="hero">
        <h1 className="title">FIT FIGHTER</h1>
        <p className="tagline">
          Where we fight laziness and put the fun in fitness.
        </p>
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
        Press <b>4</b>/<b>6</b> = Up • <b>7</b>/<b>8</b> = Down • <b>2</b> =
        Confirm
      </div>
      <button onClick={() => signOut(auth)}>Logout</button>
    </div>
  );
}
