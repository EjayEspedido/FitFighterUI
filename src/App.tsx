// src/App.tsx
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import Leaderboards from "./pages/Leaderboards";
import Settings from "./pages/Settings";
import Modes from "./pages/Modes";
import PlayCombo from "./pages/play/PlayCombo";
import PlayFoF from "./pages/play/PlayFoF";
import PlayRhythm from "./pages/play/PlayRhythm";
import { HeartRateProvider } from "./apis/HeartRateProvider";
import TopBarHR from "./components/TopBarHR";
import { RaspiWSProvider } from "./apis/RaspiComboWSContext";

// Routes relative to basename
const PAGES = ["/", "/leaderboards", "/settings"];

export default function App() {
  return (
    <RaspiWSProvider>
      <HeartRateProvider>
        <MainApp />
      </HeartRateProvider>
    </RaspiWSProvider>
  );
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Normalize for GitHub Pages-style basenames (as in your original code)
  const normalizedPath = location.pathname.replace("/fit-fighter-ui", "");
  const inGameplay = normalizedPath.startsWith("/play");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // 🚫 Disable global page navigation while in any /play/* route
      if (inGameplay) return;

      const idx = Math.max(0, PAGES.indexOf(normalizedPath));

      if (e.key === "1") {
        const prev = (idx - 1 + PAGES.length) % PAGES.length;
        navigate(PAGES[prev]);
      } else if (e.key === "3") {
        const next = (idx + 1) % PAGES.length;
        navigate(PAGES[next]);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [normalizedPath, navigate, inGameplay]);

  return (
    <div>
      {/* 🔝 Global HR bar (persists device & BPM across the whole app) */}
      <TopBarHR />

      {/* 🧭 Hide the main nav while playing to avoid distractions */}
      {!inGameplay && (
        <>
          <nav>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Home
            </NavLink>
            <NavLink
              to="/leaderboards"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Leaderboards
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Settings
            </NavLink>
          </nav>

          <div className="keyguide">
            Press <b>1</b> ◀︎ / ▶︎ <b>3</b> to switch pages
          </div>
        </>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/modes" element={<Modes />} />
        <Route path="/settings" element={<Settings />} />

        {/* 🎮 Gameplay routes */}
        <Route path="/play/combo" element={<PlayCombo />} />
        <Route path="/play/fof" element={<PlayFoF />} />
        <Route path="/play/rhythm" element={<PlayRhythm />} />
      </Routes>
    </div>
  );
}
