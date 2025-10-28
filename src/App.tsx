// src/App.tsx
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
import { auth, db } from "./firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

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
import StartRouter from "./components/StartRouter";

import Profile from "./pages/Profile";

const PAGES = ["/", "/leaderboards", "/settings", "/DebugMQTT"];

export type AppUserDoc = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  age?: number;
  height?: number;
  weight?: number;
  level?: string;
  createdAt?: any;
  [key: string]: any;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<AppUserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(true);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        // one-time fetch (optional, but helpful)
        try {
          const snap = await getDoc(userRef);
          setUserDoc(snap.exists() ? (snap.data() as AppUserDoc) : null);
        } catch (err) {
          console.error("getDoc error:", err);
          setUserDoc(null);
        }

        // subscribe for realtime updates
        unsubDoc = onSnapshot(
          userRef,
          (snap) => {
            setUserDoc(snap.exists() ? (snap.data() as AppUserDoc) : null);
            setLoading(false);
          },
          (err) => {
            console.error("user doc onSnapshot error:", err);
            setLoading(false);
          }
        );
      } else {
        // signed out
        setUserDoc(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  // debug logs to confirm values — remove if noisy
  useEffect(() => {
    console.log("Auth user:", user);
    console.log("Firestore userDoc:", userDoc);
  }, [user, userDoc]);

  if (loading) return <div>Loading.</div>;

  const location = useLocation();

  if (!user) {
    if (location.pathname === "/signup") return <Signup />;
    return <Login />;
  }

  return (
    <RigInputProvider>
      <HeartRateProvider>
        <MainApp userDoc={userDoc} />
      </HeartRateProvider>
    </RigInputProvider>
  );
}

function MainApp({ userDoc }: { userDoc: AppUserDoc | null }) {
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
      <TopBarHR displayName={userDoc?.displayName} />

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
            <NavLink
              to="/profile"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Profile
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
        <Route path="/signup" element={<Signup />} />
        <Route path="/start" element={<StartRouter />} />

        <Route path="/profile" element={<Profile user={userDoc} />} />

        {/* Play routes */}
        <Route path="/play/combo" element={<PlayCombo />} />
        <Route path="/play/fof" element={<PlayFoF />} />
        <Route path="/play/rhythm" element={<PlayRhythm />} />
      </Routes>
    </div>
  );
}
