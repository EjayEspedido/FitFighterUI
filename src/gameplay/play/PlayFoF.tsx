// src/gameplay/play/PlayFoF.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeartRate } from "../../apis/HeartRateProvider";
import "../StartScreen.css"; // same theme as Start & End

type Session = {
  seed?: number;
  level?: string;
  minutes?: number;
  isEndless?: boolean;
  startBpm?: number | null;
  [k: string]: any;
};

type Result = {
  score: number;
  maxCombo: number;
  session: Session;
  startBpm?: number | null;
  endBpm?: number | null;
  durationPlayedSec?: number;
  finishedAt?: number;
  // new fields
  foesHit?: number;
  friendsHit?: number;
};

export default function PlayFoF() {
  const { state } = useLocation() as any;
  const session: Session = state?.session ?? {};
  const { bpm: liveBpm } = useHeartRate();
  const navigate = useNavigate();

  const difficulty = useMemo(() => session.level ?? "—", [session.level]);
  const minutes = session.minutes ?? 0;
  const isEndless = !!session.isEndless;

  const [score, setScore] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [comboDisplay, setComboDisplay] = useState<string>("—");
  const [livesLeft, setLivesLeft] = useState<number>(3);
  const [paused, setPaused] = useState<boolean>(false);
  const [ongoing, setOngoing] = useState<boolean>(true);

  // new counters
  const [foesHit, setFoesHit] = useState<number>(0);
  const [friendsHit, setFriendsHit] = useState<number>(0);

  // Fix A: missing/zero minutes -> no timer (null)
  const [durationLeftSec, setDurationLeftSec] = useState<number | null>(
    isEndless ? null : minutes > 0 ? minutes * 60 : null
  );

  const startTsRef = useRef<number | null>(null);
  const endedRef = useRef<boolean>(false);
  const countdownRef = useRef<number | null>(null);

  // debug: log initial state so we can see what's happening
  useEffect(() => {
    startTsRef.current = Date.now();
    console.debug("[PlayFoF] start", {
      minutes,
      isEndless,
      durationLeftSec,
      session,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown ticker (only when a timer is configured)
  useEffect(() => {
    if (isEndless) {
      console.debug("[PlayFoF] endless mode - no countdown");
      return undefined;
    }
    if (durationLeftSec === null) {
      console.debug("[PlayFoF] no timer configured (durationLeftSec is null)");
      return undefined;
    }

    // clear old
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    console.debug("[PlayFoF] starting countdown", { durationLeftSec });

    countdownRef.current = window.setInterval(() => {
      if (paused) return;
      setDurationLeftSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      console.debug("[PlayFoF] cleared countdown (cleanup)");
    };
  }, [isEndless, paused, durationLeftSec]);

  // watch lives
  useEffect(() => {
    console.debug("[PlayFoF] lives changed", { livesLeft });
    if (!ongoing) return;
    if (livesLeft <= 0) {
      endGame("lives");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livesLeft]);

  // watch duration
  useEffect(() => {
    console.debug("[PlayFoF] durationLeftSec changed", { durationLeftSec });
    if (!ongoing) return;
    if (minutes > 0 && durationLeftSec === 0 && !isEndless) {
      endGame("time");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationLeftSec, minutes, isEndless, ongoing]);

  // little UI simulation to keep stuff lively
  useEffect(() => {
    const sim = window.setInterval(() => {
      if (!ongoing || paused) return;
      setComboDisplay(`${Math.floor(Math.random() * 8) + 1}x`);
      setMaxCombo((c) => Math.max(c, Math.floor(Math.random() * 5)));
    }, 800);
    return () => clearInterval(sim);
  }, [ongoing, paused]);

  const formatTime = (s: number | null) => {
    if (s === null) return "∞";
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${mm}:${ss}`;
  };

  function endGame(reason?: string) {
    if (endedRef.current) {
      console.debug("[PlayFoF] endGame called but already ended", { reason });
      return;
    }
    endedRef.current = true;
    setOngoing(false);

    const finishedAt = Date.now();
    const durationPlayedSec = startTsRef.current
      ? Math.round((finishedAt - startTsRef.current) / 1000)
      : 0;

    const result: Result = {
      score,
      maxCombo,
      session,
      startBpm: session.startBpm ?? null,
      endBpm: liveBpm ?? null,
      durationPlayedSec,
      finishedAt,
      // include the new counters
      foesHit,
      friendsHit,
    };

    console.debug("[PlayFoF] ending game", { reason, result });

    // short delay to let UI update then navigate
    setTimeout(() => {
      navigate("/play/end/fof", { state: { result } });
    }, 120);
  }

  // Test helpers
  const handleLoseLife = () => setLivesLeft((l) => Math.max(0, l - 1));
  const handleAddScore = (n = 100) => setScore((s) => s + n);
  const handleAddCombo = () => {
    setMaxCombo((c) => c + 1);
    setComboDisplay(`${Math.floor(Math.random() * 10) + 1}x`);
  };
  const handleEndGamePress = () => endGame("manual");

  // new test helpers for the counters
  const handleFoeHit = (n = 1) => {
    setFoesHit((v) => v + n);
    // optionally penalize score/life for hitting a foe (not changing default behavior)
    setScore((s) => s + 50);
  };
  const handleFriendHit = (n = 1) => {
    setFriendsHit((v) => v + n);
    setScore((s) => s + 200);
  };

  // NOTE: removed aggressive unmount navigation. We no longer navigate on unmount,
  // because that can fire during React routing / hot reloads and cause abrupt ends.
  // If you want an explicit snapshot on unmount, we'll trigger that only behind a flag.

  return (
    <div className="page start-page" style={{ padding: 18 }}>
      <h1 className="title">Friend or Foe Mode — Play</h1>

      <div className="start-card">
        <div className="play-status compact-center" style={{ gap: 8 }}>
          <div className={`play-status__dot ${ongoing ? "on" : ""}`} />
          <div className="play-status__text">
            {ongoing ? "Ongoing" : "Stopped"}
          </div>
          <div className="keyguide mt-05">
            Difficulty: <b>{difficulty}</b>
          </div>
        </div>

        <div className="button-grid button-grid--4 mt-1">
          <div className="stat">
            <div className="stat__label">Current HR</div>
            <div className="stat__value">{liveBpm ?? "—"} bpm</div>
          </div>
          <div className="stat">
            <div className="stat__label">Start HR</div>
            <div className="stat__value">{session.startBpm ?? "—"} bpm</div>
          </div>
          <div className="stat">
            <div className="stat__label">Max HR</div>
            <div className="stat__value">— bpm</div>
          </div>
          <div className="stat">
            <div className="stat__label">Duration Left</div>
            <div className="stat__value">{formatTime(durationLeftSec)}</div>
          </div>
        </div>

        <div className="button-grid button-grid--4 mt-1">
          <div className="stat">
            <div className="stat__label">Lives</div>
            <div className="stat__value">{livesLeft}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Score</div>
            <div className="stat__value">{score}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Max Combo</div>
            <div className="stat__value">{maxCombo}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Combo</div>
            <div className="stat__value">{comboDisplay}</div>
          </div>
        </div>

        {/* NEW: Friends/Foes counters */}
        <div className="button-grid button-grid--4 mt-1">
          <div className="stat">
            <div className="stat__label">Friends Hit</div>
            <div className="stat__value">{friendsHit}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Foes Hit</div>
            <div className="stat__value">{foesHit}</div>
          </div>
          <div
            style={{ gridColumn: "span 2", opacity: 0.9, alignSelf: "center" }}
          >
            <div style={{ fontSize: 12 }}>Tip</div>
            <div
              style={{ fontWeight: 700 }}
            >{`Friends = +200, Foes = +50 (test)`}</div>
          </div>
        </div>

        <div className="actions-row mt-1">
          <button className="btn small" onClick={() => handleAddScore(100)}>
            +100 Score
          </button>
          <button className="btn small" onClick={handleAddCombo}>
            + Combo
          </button>
          <button className="btn small" onClick={handleLoseLife}>
            Lose Life
          </button>

          {/* test buttons for the new counters */}
          <button className="btn small" onClick={() => handleFriendHit(1)}>
            Friend Hit
          </button>
          <button className="btn small" onClick={() => handleFoeHit(1)}>
            Foe Hit
          </button>

          <button className="btn small" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="btn small" onClick={handleEndGamePress}>
            End Game
          </button>
        </div>

        <div className="keyguide mt-1">
          Testing controls active — purely local. Game ends when lives hit 0,
          when time runs out (if configured), or by End Game button.
        </div>
      </div>
    </div>
  );
}
