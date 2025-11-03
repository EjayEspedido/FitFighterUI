// src/apis/RigInputProvider.tsx
import React, { useEffect, useRef, useState } from "react";
import socket, { connectSocket } from "../libs/socket"; // adjust path if needed

export interface PadEvent {
  deviceId?: string;
  pad?: number;
  action?: string;
  seq?: number;
  timestamp?: string;
  [k: string]: any;
}

type Listener = (e: PadEvent) => void;

export function useRigInput() {
  const listenersRef = useRef<Listener[]>([]);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [last, setLast] = useState<PadEvent | null>(null);

  useEffect(() => {
    // Idempotent connect
    const s = connectSocket();

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onPad(e: PadEvent) {
      setLast(e);
      listenersRef.current.forEach((fn) => fn(e));
    }

    // Subscribe
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("pad", onPad);

    // If already connected at mount, update state
    if (s.connected) setConnected(true);

    return () => {
      // cleanup handlers but DO NOT disconnect shared socket
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("pad", onPad);
    };
  }, []);

  const addListener = (fn: Listener) => {
    listenersRef.current.push(fn);
    return () => {
      listenersRef.current = listenersRef.current.filter((f) => f !== fn);
    };
  };

  return { connected, last, addListener };
}

// Provider component unchanged except it now reads from the hook
export const RigInputProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const { connected } = useRigInput();
  return <div data-rig-connected={connected}>{children}</div>;
};

export default RigInputProvider;
export { useRigInput as usePadInput };
