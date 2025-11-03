// src/libs/socket.ts
import { io, type Socket } from "socket.io-client";

const BASE =
  (import.meta.env.VITE_API_BASE as string) || "http://localhost:3001";

const OPTS = {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

// singleton socket instance
const socket: Socket = io(BASE, OPTS);

export function connectSocket(): Socket {
  if (!socket.connected) socket.connect();
  return socket;
}

export default socket;
