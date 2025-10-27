import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connectRig } from "../apis/rigMqtt";
import type { PadEvent } from "../apis/rigMqtt";

type Listener = (e: PadEvent) => void;
type RigInputCtx = {
  connected: boolean;
  rigId: string | null;
  setRigId: (id: string) => void;
  addListener: (fn: Listener) => () => void;
  last: PadEvent | null;
};
const Ctx = createContext<RigInputCtx>(null as unknown as RigInputCtx);

export function RigInputProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [rigId, setRigIdState] = useState<string | null>(
    () => localStorage.getItem("rigId") || "rig-ff-001"
  );
  const setRigId = (id: string) => {
    setRigIdState(id);
    localStorage.setItem("rigId", id);
  };
  const [last, setLast] = useState<PadEvent | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  const addListener = (fn: Listener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  };

  useEffect(() => {
    if (!rigId) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const c = await connectRig(
          rigId,
          (e) => {
            if (!disposed) {
              console.log("[PAD]", e.pad, e);
              setLast(e);
              for (const fn of listenersRef.current) fn(e);
            }
          },
          () => !disposed && setConnected(true),
          () => !disposed && setConnected(false)
        );
        if (!disposed) cleanup = c;
      } catch (err) {
        console.error("[RigInput] connect error:", err);
        if (!disposed) setConnected(false);
      }
    })();

    return () => {
      disposed = true;
      try {
        cleanup?.();
      } catch {}
    };
  }, [rigId]);

  const value = useMemo(
    () => ({ connected, rigId, setRigId, addListener, last }),
    [connected, rigId, last]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePadInput(): RigInputCtx {
  return useContext(Ctx);
}
