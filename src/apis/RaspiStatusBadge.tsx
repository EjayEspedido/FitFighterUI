// // src/components/RaspiStatusBadge.tsx
// import React from "react";
// import { useRaspiConnection } from "../apis/useRaspiConnection";

// export default function RaspiStatusBadge() {
//   const { connected, alive, latencyMs, sinceLastHeartbeatMs, ping } =
//     useRaspiConnection();

//   const color = !connected ? "#ef4444" : !alive ? "#f59e0b" : "#22c55e";
//   const text = !connected ? "Disconnected" : !alive ? "No Heartbeat" : "Online";

//   return (
//     <button
//       onClick={ping}
//       style={{
//         display: "inline-flex",
//         alignItems: "center",
//         gap: 8,
//         padding: "6px 10px",
//         borderRadius: 999,
//         border: "1px solid rgba(255,255,255,0.15)",
//         background: "rgba(255,255,255,0.05)",
//         color: "white",
//         cursor: "pointer",
//       }}
//       title="Click to ping"
//     >
//       <span
//         style={{
//           width: 10,
//           height: 10,
//           borderRadius: "50%",
//           background: color,
//           boxShadow: `0 0 8px ${color}`,
//         }}
//       />
//       <span style={{ fontSize: 12, opacity: 0.9 }}>{text}</span>
//       {latencyMs != null && (
//         <span style={{ fontSize: 12, opacity: 0.6 }}>· {latencyMs} ms</span>
//       )}
//       {sinceLastHeartbeatMs != null && (
//         <span style={{ fontSize: 12, opacity: 0.6 }}>
//           · hb {Math.floor(sinceLastHeartbeatMs / 1000)}s ago
//         </span>
//       )}
//     </button>
//   );
// }
