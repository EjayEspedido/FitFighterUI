export type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export async function sendStartParams(
  rigId: string,
  payload: {
    userLevel: Level;
    gameMode: 1 | 2; // 1=Combo, 2=FoF
    total_time: number; // seconds
    isEndless: boolean;
  }
) {
  // HTTP bridge to your backend (adjust path if needed)
  const r = await fetch("/api/rig-command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rigId, cmd: "start", payload }),
  });
  if (!r.ok) throw new Error(`/api/rig-command failed: ${r.status}`);
}
