import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const HEART_RATE_SERVICE = 0x180d;
const HEART_RATE_MEASUREMENT = 0x2a37;

type HeartRateContextShape = {
  bpm: number | null;
  deviceName: string | null;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const HeartRateContext = createContext<HeartRateContextShape | undefined>(
  undefined
);

export const HeartRateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [bpm, setBpm] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const parseHeartRate = (dv: DataView): number => {
    const flags = dv.getUint8(0);
    const hr16 = (flags & 0x01) !== 0;
    return hr16 ? dv.getUint16(1, true) : dv.getUint8(1);
  };

  // Stable handlers
  const handleValueChanged = useCallback((e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    setBpm(parseHeartRate(dv));
  }, []);

  const hardDisconnect = useCallback(() => {
    try {
      charRef.current?.removeEventListener(
        "characteristicvaluechanged",
        handleValueChanged
      );
    } catch {}
    try {
      devRef.current?.removeEventListener?.(
        "gattserverdisconnected",
        handleGattDisconnected as any
      );
    } catch {}
    try {
      devRef.current?.gatt?.disconnect?.();
    } catch {}

    charRef.current = null;
    devRef.current = null;
    setConnected(false);
    setDeviceName(null);
    setBpm(null);
  }, [handleValueChanged]);

  const handleGattDisconnected = useCallback(() => {
    hardDisconnect();
  }, [hardDisconnect]);

  const connect = useCallback(async () => {
    if (!("bluetooth" in navigator)) {
      setError("Web Bluetooth not available in this browser.");
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [HEART_RATE_SERVICE],
      });

      devRef.current = dev;
      setDeviceName(dev.name ?? "HRM");
      dev.addEventListener("gattserverdisconnected", handleGattDisconnected);

      const gatt = await dev.gatt!.connect();
      const svc = await gatt.getPrimaryService(HEART_RATE_SERVICE);
      const ch = await svc.getCharacteristic(HEART_RATE_MEASUREMENT);
      charRef.current = ch;

      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", handleValueChanged);
      setConnected(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      hardDisconnect();
    } finally {
      setConnecting(false);
    }
  }, [handleGattDisconnected, handleValueChanged, hardDisconnect]);

  const disconnect = useCallback(() => {
    hardDisconnect();
  }, [hardDisconnect]);

  // Unmount-only cleanup
  useEffect(() => {
    return () => {
      hardDisconnect();
    };
  }, [hardDisconnect]);

  const value: HeartRateContextShape = {
    bpm,
    deviceName,
    connecting,
    connected,
    error,
    connect,
    disconnect,
  };

  return (
    <HeartRateContext.Provider value={value}>
      {children}
    </HeartRateContext.Provider>
  );
};

export function useHeartRate(): HeartRateContextShape {
  const ctx = useContext(HeartRateContext);
  if (!ctx)
    throw new Error("useHeartRate must be used within HeartRateProvider");
  return ctx;
}
