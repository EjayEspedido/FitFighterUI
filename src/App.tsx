import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./firebase";
import { HeartRateProvider } from "./apis/HeartRateProvider";
import { RigInputProvider, usePadInput } from "./apis/RigInputProvider";
import Home from "./pages/Home";
import Leaderboards from "./pages/Leaderboards";
import Settings from "./pages/Settings";
import Modes from "./pages/Modes";
import PlayCombo from "./pages/play/PlayCombo";
import PlayFoF from "./pages/play/PlayFoF";
import PlayRhythm from "./pages/play/PlayRhythm";
import DebugMQTT from "./pages/DebugMQTT";
import TopBarHR from "./components/TopBarHR";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const PAGES = ["/", "/leaderboards", "/settings", "/DebugMQTT"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;

  const location = useLocation();

  if (!user) {
    if (location.pathname === "/signup") return <Signup />;
    return <Login />;
  }

  return (
    <RigInputProvider>
      <HeartRateProvider>
        <MainApp />
      </HeartRateProvider>
    </RigInputProvider>
  );
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addListener } = usePadInput();

  const normalizedPath = location.pathname.replace("/fit-fighter-ui", "");
  const inGameplay = normalizedPath.startsWith("/play");

  useEffect(() => {
    const off = addListener((e) => {
      if (inGameplay) return;
      const idx = Math.max(0, PAGES.indexOf(normalizedPath));
      if (e.pad === 1) {
        const prev = (idx - 1 + PAGES.length) % PAGES.length;
        navigate(PAGES[prev]);
      } else if (e.pad === 3) {
        const next = (idx + 1) % PAGES.length;
        navigate(PAGES[next]);
      }
    });
    return off;
  }, [addListener, inGameplay, normalizedPath, navigate]);

  return (
    <div>
      <TopBarHR />
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
        <Route path="/DebugMQTT" element={<DebugMQTT />} />
        <Route path="/play/combo" element={<PlayCombo />} />
        <Route path="/play/fof" element={<PlayFoF />} />
        <Route path="/play/rhythm" element={<PlayRhythm />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  );
}
