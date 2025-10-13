// src/raspi/useRaspiWS.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { RaspiWS } from "./wsClient";

export function useRaspiWS(url: string) {
  const clientRef = useRef<RaspiWS | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastCombo, setLastCombo] = useState<number[] | null>(null);

  // (Re)create the client when URL changes
  useEffect(() => {
    // Close old client if URL changed
    if (clientRef.current) {
      try {
        clientRef.current.close();
      } catch {}
      clientRef.current = null;
    }

    const client = new RaspiWS(url);
    clientRef.current = client;
    client.connect();

    const offOpen = client.on("open", () => setConnected(true));
    const offClose = client.on("close", () => setConnected(false));
    const offCombo = client.on("combo", (msg) => {
      if (Array.isArray(msg?.payload)) setLastCombo(msg.payload);
    });

    return () => {
      offOpen();
      offClose();
      offCombo();
      try {
        client.close();
      } catch {}
      clientRef.current = null;
    };
  }, [url]);

  const client = clientRef.current;

  return useMemo(
    () => ({
      connected,
      lastCombo,
      requestCombo: (level?: string) => client?.requestCombo(level),
      reportResult: (payload: any) => client?.reportResult(payload),
    }),
    [connected, lastCombo, client]
  );
}
