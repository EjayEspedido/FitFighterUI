// src/apis/gameControl.tsx
export type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export async function sendStartParams(
  rigId: string,
  payload: {
    userLevel: Level;
    gameMode: 1 | 2;
    total_time: number;
    isEndless: boolean;
  }
): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  forwarded?: boolean;
}> {
  try {
    const res = await fetch("http://localhost:6969/api/rig-command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rigId, cmd: "start", payload }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[sendStartParams] non-OK response", res.status, text);
      return { ok: false, status: res.status, error: text };
    }

    const body = await res.json().catch(() => null);
    // server responds with { ok: true, forwarded: true } when forwarded
    return { ok: true, forwarded: body?.forwarded ?? false };
  } catch (err: any) {
    console.warn("[sendStartParams] failed to fetch", err);
    return { ok: false, error: err?.message ?? String(err) };
  }
}
