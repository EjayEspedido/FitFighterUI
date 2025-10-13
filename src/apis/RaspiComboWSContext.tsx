// src/raspi/RaspiWSContext.tsx
import React, { createContext, useContext } from "react";
import { useRaspiWS } from "./useRaspiWS";

type RaspiCtx = {
  connected: boolean;
  lastCombo: number[] | null;
  requestCombo: (level?: string) => void;
  reportResult: (payload: any) => void;
};

const RaspiWSContext = createContext<RaspiCtx>({
  connected: false,
  lastCombo: null,
  requestCombo: () => {},
  reportResult: () => {},
});

export const RaspiWSProvider: React.FC<{
  url?: string;
  children: React.ReactNode;
}> = ({
  url = import.meta.env.VITE_RASPI_WS_URL || "ws://raspberrypi.local:8765",
  children,
}) => {
  const { connected, lastCombo, requestCombo, reportResult } = useRaspiWS(url);
  return (
    <RaspiWSContext.Provider
      value={{
        connected: !!connected,
        lastCombo: lastCombo ?? null,
        requestCombo: requestCombo as any,
        reportResult: reportResult as any,
      }}
    >
      {children}
    </RaspiWSContext.Provider>
  );
};

export const useRaspi = () => useContext(RaspiWSContext);
