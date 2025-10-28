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
import { RigInputProvider, useRigInput } from "./apis/RigInputProvider";

import Home from "./Home";
import Leaderboards from "./Leaderboards";
import Settings from "./Settings";
import Modes from "./Modes";

// add these imports near the other gameplay imports
import PlayStart from "./gameplay/PlayStart";

import StartScreenCombo from "./gameplay/StartScreenCombo"; // optional explicit route
import PlayCombo from "./gameplay/play/PlayCombo";
import EndScreenCombo from "./gameplay/EndScreenCombo";

import StartScreenFoF from "./gameplay/StartScreenFoF"; // optional explicit route
import PlayFoF from "./gameplay/play/PlayFoF";
import EndScreenFoF from "./gameplay/EndScreenFoF";

import StartScreenRhythm from "./gameplay/StartScreenRhythm"; // optional explicit route
import PlayRhythm from "./gameplay/play/PlayRhythm";
import EndScreenRhythm from "./gameplay/EndScreenRhythm";

import TopBarHR from "./components/TopBarHR";
import Login from "./Login";
import Signup from "./Signup";

import Profile from "./Profile";

const PAGES = ["/", "/leaderboards", "/settings", "/DebugMQTT"];
const RIG_ID = import.meta.env.VITE_RIG_ID ?? "rig-ff-001";

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

  // call location hook unconditionally so hooks order is stable
  const location = useLocation();

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(true);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        // one-time fetch (optional)
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

  // keep MainApp nested so it can use hooks that depend on routing context
  function MainApp({ userDoc }: { userDoc: AppUserDoc | null }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { addListener } = useRigInput();

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
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile user={userDoc} />} />

          {/* canonical single entry for mode selection */}
          <Route path="/play/start" element={<PlayStart />} />

          {/* explicit start aliases (optional but handy) */}
          <Route path="/play/start/rhythm" element={<StartScreenRhythm />} />
          <Route path="/play/start/combo" element={<StartScreenCombo />} />
          <Route path="/play/start/fof" element={<StartScreenFoF />} />

          {/* existing play routes (leave as-is) */}
          <Route path="/play/combo" element={<PlayCombo />} />
          <Route path="/play/fof" element={<PlayFoF />} />
          <Route path="/play/rhythm" element={<PlayRhythm />} />

          {/* existing end screens (leave as-is) */}
          <Route path="/play/end/combo" element={<EndScreenCombo />} />
          <Route path="/play/end/fof" element={<EndScreenFoF />} />
          <Route path="/play/rhythm/end" element={<EndScreenRhythm />} />
        </Routes>
      </div>
    );
  }

  // --- Render flow for App ---
  if (loading) {
    return <div>Loading…</div>;
  }

  if (!user) {
    // not authenticated: show simple routes for login/signup (you can expand later)
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // signed in: provide rig/hr contexts and show main app
  return (
    <RigInputProvider rigId={RIG_ID}>
      <HeartRateProvider>
        <MainApp userDoc={userDoc} />
      </HeartRateProvider>
    </RigInputProvider>
  );
}
