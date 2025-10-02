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

// Routes relative to basename
const PAGES = ["/", "/leaderboards", "/settings"];

export default function App() {
  return <MainApp />;
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const idx = Math.max(
        0,
        PAGES.indexOf(location.pathname.replace("/fit-fighter-ui", ""))
      );

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
  }, [location.pathname, navigate]);

  return (
    <div>
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

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
