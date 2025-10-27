// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useRaspi } from "./RaspiWSProvider";

// type ConnState = {
//   connected: boolean; // WS transport open?
//   alive: boolean; // heartbeat seen recently?
//   lastHeartbeatAt: number | null;
//   sinceLastHeartbeatMs: number | null;
//   latencyMs: number | null; // from ping/pong measurements
//   ping: () => void; // trigger a ping now
// };

// const HEARTBEAT_TIMEOUT_MS = 6000; // consider dead if no heartbeat for > 6s
// const PING_INTERVAL_MS = 10000; // auto-ping every 10s (optional)

// export function useRaspiConnection(): ConnState {
//   const { connected, lastEvent } = useRaspi();
//   const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
//   const [latencyMs, setLatencyMs] = useState<number | null>(null);
//   const [sinceLastHeartbeatMs, setSinceLastHeartbeatMs] = useState<
//     number | null
//   >(null);

//   const wsSend = useRaspiSend(); // helper below

//   // Track heartbeat and pong
//   useEffect(() => {
//     if (!lastEvent) return;
//     if (lastEvent.type === "heartbeat" && typeof lastEvent.now === "number") {
//       setLastHeartbeatAt(Date.now());
//     } else if (
//       lastEvent.type === "pong" &&
//       typeof lastEvent.sent === "number"
//     ) {
//       const rtt = Date.now() - Number(lastEvent.sent);
//       setLatencyMs(rtt);
//     }
//   }, [lastEvent]);

//   // derived "alive"
//   const alive = useMemo(() => {
//     if (!connected) return false;
//     if (lastHeartbeatAt == null) return false;
//     return Date.now() - lastHeartbeatAt < HEARTBEAT_TIMEOUT_MS;
//   }, [connected, lastHeartbeatAt]);

//   // update sinceLastHeartbeatMs continuously
//   useEffect(() => {
//     const id = window.setInterval(() => {
//       setSinceLastHeartbeatMs(
//         lastHeartbeatAt ? Date.now() - lastHeartbeatAt : null
//       );
//     }, 500);
//     return () => window.clearInterval(id);
//   }, [lastHeartbeatAt]);

//   // manual ping
//   const ping = useCallback(() => {
//     wsSend({ action: "ping", data: { sent: Date.now() } });
//   }, [wsSend]);

//   // auto-ping every PING_INTERVAL_MS while connected
//   useEffect(() => {
//     if (!connected) return;
//     const id = window.setInterval(() => {
//       wsSend({ action: "ping", data: { sent: Date.now() } });
//     }, PING_INTERVAL_MS);
//     return () => window.clearInterval(id);
//   }, [connected, wsSend]);

//   return {
//     connected,
//     alive,
//     lastHeartbeatAt,
//     sinceLastHeartbeatMs,
//     latencyMs,
//     ping,
//   };
// }

// /** Tiny helper to send raw actions via the provider without exposing details */
// function useRaspiSend() {
//   const { __send } = useRaspi();
//   return __send;
// }
