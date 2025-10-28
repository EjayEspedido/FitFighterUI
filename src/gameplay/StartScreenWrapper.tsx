// StartScreenWrapper.tsx
import { useLocation } from "react-router-dom";
import StartScreenCombo from "./StartScreenCombo";
import StartScreenFriendOrFoe from "./StartScreenFoF";
import StartScreenRhythm from "./StartScreenRhythm";

export default function StartScreenWrapper() {
  const location = useLocation();
  const mode: number = (location.state as any)?.mode ?? 1;

  if (mode === 1) return <StartScreenCombo />;
  if (mode === 2) return <StartScreenFriendOrFoe />;
  return <StartScreenRhythm />;
}
