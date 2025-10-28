// src/gameplay/PlayStart.tsx
import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";

// start screens — adjust these paths if your files live elsewhere
import StartScreenCombo from "./StartScreenCombo";
import StartScreenFoF from "./StartScreenFoF";
import StartScreenRhythm from "./StartScreenRhythm";

/**
 * PlayStart: single canonical entry for play modes.
 * It supports:
 *  - router state: navigate("/play/start", { state: { mode: "rhythm" } })
 *  - query param: /play/start?mode=rhythm
 *  - fallback: defaults to combo
 */
export default function PlayStart() {
  const { state } = useLocation() as any;
  const [qs] = useSearchParams();

  const modeFromState: string | undefined = state?.mode;
  const modeFromQs = qs.get("mode") ?? undefined;
  const mode = (modeFromState || modeFromQs || "combo")
    .toString()
    .toLowerCase();

  switch (mode) {
    case "rhythm":
    case "r":
      return <StartScreenRhythm />;
    case "fof":
    case "friendorfoe":
    case "friend-or-foe":
      return <StartScreenFoF />;
    case "combo":
    default:
      return <StartScreenCombo />;
  }
}
