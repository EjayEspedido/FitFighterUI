// src/apis/RigInputProvider.tsx
import React, { useEffect, useRef, useState } from "react";
import { connectRig, type PadEvent } from "./rigMqtt"; // adjust path if necessary

type Listener = (e: PadEvent) => void;

/**d
 * useRigInput(rigId?: string | null)
 * - rigId is optional; if omitted or null, the hook will be disconnected/idle.
 */
export function useRigInput(rigId?: string | null) {
  const listenersRef = useRef<Listener[]>([]);
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<PadEvent | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined = undefined;
    const effectiveRigId = rigId ?? null;

    if (!effectiveRigId) {
      setConnected(false);
      return;
    }

    (async () => {
      try {
        console.debug(
          "[RigInputProvider] calling connectRig for",
          effectiveRigId
        );
        const c = await connectRig(
          effectiveRigId,
          (e: PadEvent) => {
            if (!disposed) {
              console.log("[PAD]", e.pad, e);
              setLast(e);
              for (const fn of listenersRef.current) fn(e);
            }
          },
          () => {
            if (!disposed) {
              console.debug("[RigInputProvider] onConnect");
              setConnected(true);
            }
          },
          () => {
            if (!disposed) {
              console.debug("[RigInputProvider] onClose");
              setConnected(false);
            }
          }
        );
        if (!disposed) cleanup = c;
      } catch (err) {
        console.error("[RigInput] connect error:", err);
        if (!disposed) setConnected(false);
      }
    })();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [rigId]);

  const addListener = (fn: Listener) => {
    listenersRef.current.push(fn);
    return () => {
      listenersRef.current = listenersRef.current.filter((f) => f !== fn);
    };
  };

  return {
    connected,
    last,
    addListener,
  };
}

/**
 * RigInputProvider component
 * - rigId prop is optional; default is null.
 * - keeps rendering children; it only manages the connection lifecycle.
 */
export const RigInputProvider: React.FC<{
  rigId?: string | null;
  children?: React.ReactNode;
}> = ({ rigId = null, children }) => {
  const { connected } = useRigInput(rigId);

  return <div data-rig-connected={connected}>{children}</div>;
};

export default RigInputProvider;

// Backwards-compat: alias the old hook name so existing imports work
export { useRigInput as usePadInput };
