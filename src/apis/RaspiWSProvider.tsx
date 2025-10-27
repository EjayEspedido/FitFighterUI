// import React, {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";

// export type RaspiContextType = {
//   connected: boolean;
//   lastEvent: any | null;
//   __send: (obj: any) => void; // exposed for utilities (ping, etc.)
//   sendPadHit: (pad: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => void;
// };

// const RaspiCtx = createContext<RaspiContextType | null>(null);

// export function RaspiWSProvider({ children }: { children: React.ReactNode }) {
//   const RASPI_IP = "10.183.115.58"; // <- your Pi’s IP
//   const RASPI_PORT = 8765;
//   const RASPI_TOKEN = "changeme-dev-token";
//   const url = `ws://${RASPI_IP}:${RASPI_PORT}?token=${RASPI_TOKEN}`;

//   const wsRef = useRef<WebSocket | null>(null);
//   const [connected, setConnected] = useState(false);
//   const [lastEvent, setLastEvent] = useState<any | null>(null);
//   const retryRef = useRef(0);

//   const __send = useCallback((obj: any) => {
//     const ws = wsRef.current;
//     if (!ws || ws.readyState !== WebSocket.OPEN) return;
//     ws.send(JSON.stringify(obj));
//   }, []);

//   const sendPadHit: RaspiContextType["sendPadHit"] = useCallback(
//     (pad) => {
//       __send({ action: "pad_hit", data: { pad, ts: Date.now() } });
//     },
//     [__send]
//   );

//   useEffect(() => {
//     let stop = false;

//     const connect = () => {
//       if (stop) return;
//       const ws = new WebSocket(url);
//       wsRef.current = ws;

//       ws.onopen = () => {
//         setConnected(true);
//         retryRef.current = 0;
//       };

//       ws.onmessage = (ev) => {
//         // Parse once
//         let msg: any;
//         try {
//           msg = JSON.parse(ev.data);
//         } catch {
//           return;
//         }

//         // 🚀 FAST PATH: emit a DOM event (no React render needed)
//         // Anything listening for "__raspi_event" will get this instantly.
//         window.dispatchEvent(new CustomEvent("__raspi_event", { detail: msg }));

//         // Optional/secondary: still store for components that want state
//         setLastEvent(msg);
//       };

//       ws.onerror = () => {
//         try {
//           ws.close();
//         } catch {}
//       };
//       ws.onclose = () => {
//         setConnected(false);
//         const delay = Math.min(5000, 300 * Math.pow(2, retryRef.current++));
//         setTimeout(connect, delay);
//       };
//     };

//     connect();
//     return () => {
//       stop = true;
//       const ws = wsRef.current;
//       wsRef.current = null;
//       try {
//         ws?.close();
//       } catch {}
//     };
//   }, [url]);

//   const value = useMemo(
//     () => ({ connected, lastEvent, __send, sendPadHit }),
//     [connected, lastEvent, __send, sendPadHit]
//   );

//   return <RaspiCtx.Provider value={value}>{children}</RaspiCtx.Provider>;
// }

// export function useRaspi() {
//   const ctx = useContext(RaspiCtx);
//   if (!ctx) throw new Error("useRaspi must be used within RaspiWSProvider");
//   return ctx;
// }
