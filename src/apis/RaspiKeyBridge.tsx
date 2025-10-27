// import { useEffect, useRef } from "react";
// import { useRaspi } from "../apis/RaspiWSProvider";

// // fire real key events
// function dispatchKey(kind: "keydown" | "keyup", key: string) {
//   const code = `Digit${key}`;
//   const e = new KeyboardEvent(kind, {
//     key,
//     code,
//     bubbles: true,
//     cancelable: true,
//   });
//   Object.defineProperty(e, "keyCode", { get: () => key.charCodeAt(0) });
//   window.dispatchEvent(e);
// }

// export default function RaspiKeyBridge({
//   enabled = true,
//   generateKeyUpForPadHit = true,
//   keyUpDelayMs = 8, // ⚡ make it tiny; feels instant
// }: {
//   enabled?: boolean;
//   generateKeyUpForPadHit?: boolean;
//   keyUpDelayMs?: number;
// }) {
//   // Keep provider mounted (ensures the socket exists)
//   useRaspi();

//   const upTimers = useRef<Record<string, number>>({});

//   useEffect(() => {
//     if (!enabled) return;

//     const handler = (ev: Event) => {
//       const msg = (ev as CustomEvent).detail;
//       if (!msg) return;

//       // Path A: richer events
//       if (msg.type === "pad_key" && /^[1-8]$/.test(msg.key)) {
//         const key = msg.key as string;
//         if (msg.event === "down") {
//           const t = upTimers.current[key];
//           if (t) {
//             clearTimeout(t);
//             delete upTimers.current[key];
//           }
//           dispatchKey("keydown", key);
//         } else if (msg.event === "up") {
//           dispatchKey("keyup", key);
//         }
//         return;
//       }

//       // Path B: simple pad_hit -> synthesize a tap
//       if (msg.type === "pad_hit" && Number.isInteger(msg.pad)) {
//         const pad = String(msg.pad);
//         if (!/^[1-8]$/.test(pad)) return;
//         dispatchKey("keydown", pad);
//         if (generateKeyUpForPadHit) {
//           const id = window.setTimeout(() => {
//             dispatchKey("keyup", pad);
//             delete upTimers.current[pad];
//           }, keyUpDelayMs);
//           upTimers.current[pad] = id;
//         }
//       }
//     };

//     window.addEventListener("__raspi_event", handler as EventListener, {
//       passive: true,
//     });

//     return () => {
//       window.removeEventListener("__raspi_event", handler as EventListener);
//       Object.values(upTimers.current).forEach(clearTimeout);
//       upTimers.current = {};
//     };
//   }, [enabled, generateKeyUpForPadHit, keyUpDelayMs]);

//   return null;
// }
