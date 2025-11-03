// src/apis/RigInputProvider.tsx
import React, { useEffect, useRef, useState } from "react";
import socket, { connectSocket } from "../libs/socket"; // keep existing path

export interface PadEvent {
  deviceId?: string;
  pad?: number;
  action?: string;
  seq?: number;
  timestamp?: string;
  [k: string]: any;
}

type Listener = (e: PadEvent) => void;

/**
 * useRigInput: enhanced listener hook
 * - listens to socket events (pad, device:btn, device/<id>/btn)
 * - listens to window.postMessage({ type: 'pad:input', payload })
 * - listens to window.mqttClient messages as fallback
 */
export function useRigInput() {
  const listenersRef = useRef<Listener[]>([]);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [last, setLast] = useState<PadEvent | null>(null);

  useEffect(() => {
    const s = connectSocket();

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    // core handler: normalizes incoming payloads and dispatches to listeners
    const dispatchPad = (raw: any) => {
      if (!raw) return;
      // raw may be { topic, payload } (bridge), JSON string, or plain object
      let ev: any = raw;
      if (typeof raw === "string") {
        try {
          ev = JSON.parse(raw);
        } catch {}
      }
      // if it arrives as { topic, payload }
      if (ev && ev.payload !== undefined) ev = ev.payload;

      // normalize common shapes
      const padEvent: PadEvent = {
        deviceId: ev.deviceId ?? ev.device ?? ev.device_id ?? undefined,
        pad:
          typeof ev.pad === "number"
            ? ev.pad
            : ev.padIndex ?? ev.key ?? undefined,
        action: ev.action ?? ev.type ?? undefined,
        seq: ev.seq ?? undefined,
        timestamp: ev.ts ?? ev.timestamp ?? undefined,
        ...ev,
      };

      setLast(padEvent);
      listenersRef.current.forEach((fn) => fn(padEvent));
    };

    // socket listeners — listen to a variety of event names your bridge may emit
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("pad", dispatchPad);
    s.on("device:btn", dispatchPad);
    s.on("device/pi01/btn", dispatchPad);
    s.onAny &&
      s.onAny((evName: string, data: any) => {
        // optional: debug or catch generic events that look like pad events
        if (evName && evName.toLowerCase().includes("btn")) dispatchPad(data);
      });

    // postMessage listener (socket-init posts pad:input)
    const onWindowMessage = (e: MessageEvent) => {
      if (!e?.data) return;
      if (e.data?.type === "pad:input") {
        dispatchPad(e.data.payload ?? e.data);
      } else if (e.data?.topic && typeof e.data?.payload !== "undefined") {
        // generic forward if something posts { topic, payload }
        if (
          String(e.data.topic).includes("/btn") ||
          String(e.data.topic).includes("/btn")
        ) {
          dispatchPad(e.data.payload);
        }
      }
    };
    window.addEventListener("message", onWindowMessage);

    // mqttClient fallback (if window.mqttClient exists and emits 'message' (topic, payload))
    const mqtt = (window as any).mqttClient;
    const mqttHandler = (topic: string, payload: any) => {
      try {
        // topics like device/pi01/btn
        if (typeof topic === "string" && topic.includes("/btn")) {
          // payload may be string or object
          const pl =
            typeof payload === "string" ? JSON.parse(payload) : payload;
          dispatchPad(pl);
        }
      } catch (err) {
        // ignore parse
      }
    };
    if (mqtt && typeof mqtt.on === "function") {
      mqtt.on("message", mqttHandler);
    }

    // cleanup
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("pad", dispatchPad);
      s.off("device:btn", dispatchPad);
      s.off("device/pi01/btn", dispatchPad);
      if (s.offAny) {
        try {
          s.offAny();
        } catch {}
      }
      window.removeEventListener("message", onWindowMessage);
      if (mqtt && typeof mqtt.off === "function") {
        try {
          mqtt.off("message", mqttHandler);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addListener = (fn: Listener) => {
    listenersRef.current.push(fn);
    return () => {
      listenersRef.current = listenersRef.current.filter((f) => f !== fn);
    };
  };

  return { connected, last, addListener };
}

export const RigInputProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const { connected } = useRigInput();
  return <div data-rig-connected={connected}>{children}</div>;
};

export default RigInputProvider;
export { useRigInput as usePadInput };
