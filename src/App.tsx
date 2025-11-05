// src/App.tsx
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Providers
import { HeartRateProvider } from "./apis/HeartRateProvider";
import { RigInputProvider, useRigInput } from "./apis/RigInputProvider";

// Components
import TopBarHR from "./components/TopBarHR";

// Auth Pages
import Login from "./Login";
import Signup from "./Signup";

// Main Pages
import Home from "./Home";
import Leaderboards from "./Leaderboards";
import Settings from "./Settings";
import Modes from "./Modes";
import Profile from "./Profile";

// Gameplay Screens
import PlayStart from "./gameplay/PlayStart";
import StartScreenCombo from "./gameplay/StartScreenCombo";
import StartScreenFoF from "./gameplay/StartScreenFoF";
import StartScreenRhythm from "./gameplay/StartScreenRhythm";

// Gameplay (Active)
import PlayCombo from "./gameplay/play/PlayCombo";
import PlayFoF from "./gameplay/play/PlayFoF";
import PlayRhythm from "./gameplay/play/PlayRhythm";

// End Screens
import EndScreenCombo from "./gameplay/EndScreenCombo";
import EndScreenFoF from "./gameplay/EndScreenFoF";
import EndScreenRhythm from "./gameplay/EndScreenRhythm";

// Constants
const PAGES = ["/", "/leaderboards", "/settings"];
const RIG_ID = import.meta.env.VITE_RIG_ID ?? "rig-ff-001";

export type AppUserDoc = {
  uid?: string;
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

        try {
          const snap = await getDoc(userRef);
          setUserDoc(
            snap.exists()
              ? ({ uid: snap.id, ...snap.data() } as AppUserDoc)
              : null
          );
        } catch (err) {
          console.error("getDoc error:", err);
          setUserDoc(null);
        }

        unsubDoc = onSnapshot(
          userRef,
          (snap) => {
            setUserDoc(
              snap.exists()
                ? ({ uid: snap.id, ...snap.data() } as AppUserDoc)
                : null
            );
            setLoading(false);
          },
          (err) => {
            console.error("user doc onSnapshot error:", err);
            setLoading(false);
          }
        );
      } else {
        setUserDoc(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  if (loading) return <div>Loading…</div>;

  if (!user) {
    // not authenticated: show simple routes for login/signup
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <RigInputProvider>
      <HeartRateProvider>
        <MainApp userDoc={userDoc} />
      </HeartRateProvider>
    </RigInputProvider>
  );
}

/**
 * MainApp sits inside routing context so it can use router hooks.
 * It subscribes to rig input and allows navigating pages with pads when not in gameplay.
 */
function MainApp({ userDoc }: { userDoc: AppUserDoc | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { addListener } = useRigInput();

  const normalizedPath = location.pathname.replace("/fit-fighter-ui", "");
  const inGameplay = normalizedPath.startsWith("/play");

  useEffect(() => {
    const off = addListener((e: any) => {
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

        {/* Play / Start routes */}
        <Route path="/play/start" element={<PlayStart />} />
        <Route path="/play/start/rhythm" element={<StartScreenRhythm />} />
        <Route path="/play/start/combo" element={<StartScreenCombo />} />
        <Route path="/play/start/fof" element={<StartScreenFoF />} />

        {/* Gameplay */}
        <Route path="/play/combo" element={<PlayCombo />} />
        <Route path="/play/fof" element={<PlayFoF />} />
        <Route path="/play/rhythm" element={<PlayRhythm />} />

        {/* End screens */}
        <Route path="/play/end/combo" element={<EndScreenCombo />} />
        <Route path="/play/end/fof" element={<EndScreenFoF />} />
        <Route path="/play/rhythm/end" element={<EndScreenRhythm />} />
      </Routes>
    </div>
  );
}
