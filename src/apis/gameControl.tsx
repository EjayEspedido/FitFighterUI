// src/apis/gameControl.tsx
import { publishRigCommand, waitForClient } from "./rigMqtt";

/**
 * sendStartParams - publish a start command for the rig over MQTT.
 * - rigId: rig identifier (e.g. "rig-ff-001")
 * - payload: game params (userLevel, gameMode, total_time, isEndless, etc.)
 *
 * This function waits briefly for the MQTT client to be ready and throws if not.
 * It intentionally does NOT silently fallback to HTTP localhost to avoid the 404 issue.
 */
export async function sendStartParams(
  rigId: string,
  payload: {
    userLevel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    gameMode: number;
    total_time: number;
    isEndless?: boolean;
    [k: string]: any;
  }
) {
  const topic = `rig/${rigId}/command`;
  console.debug("[gameControl] sendStartParams invoked", { rigId, payload });

  // wait up to 2500ms for MQTT client to be ready
  const ready = await waitForClient(2500);
  console.debug("[gameControl] waitForClient ->", ready);
  if (!ready) {
    console.error(
      "[gameControl] MQTT client not ready after wait; aborting start."
    );
    // Let the caller handle the user-facing error (toast/modal). Throw so it doesn't do HTTP fallback.
    throw new Error(
      "MQTT client not ready; ensure RigInputProvider is connected."
    );
  }

  try {
    publishRigCommand(rigId, topic, { cmd: "start", payload });
    console.info("[gameControl] published start over MQTT");
  } catch (err) {
    console.error("[gameControl] publishRigCommand failed:", err);
    throw err;
  }
}
