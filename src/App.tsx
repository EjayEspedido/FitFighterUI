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
import Home from "./pages/Home";
import Leaderboards from "./pages/Leaderboards";
import Settings from "./pages/Settings";
import Modes from "./pages/Modes";
import PlayCombo from "./pages/play/PlayCombo";
import PlayFoF from "./pages/play/PlayFoF";
import PlayRhythm from "./pages/play/PlayRhythm";
import TopBarHR from "./components/TopBarHR";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StartRouter from "./components/StartRouter";

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
    <HeartRateProvider>
      <MainApp />
    </HeartRateProvider>
  );
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const normalizedPath = location.pathname.replace("/fit-fighter-ui", "");
  const inGameplay = normalizedPath.startsWith("/play");

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
        <Route path="/play/combo" element={<PlayCombo />} />
        <Route path="/play/fof" element={<PlayFoF />} />
        <Route path="/play/rhythm" element={<PlayRhythm />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/start" element={<StartRouter />} />
      </Routes>
    </div>
  );
}
