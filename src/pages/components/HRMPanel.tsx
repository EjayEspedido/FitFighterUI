// HRMPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";

const HEART_RATE_SERVICE = 0x180d;
const HEART_RATE_MEASUREMENT = 0x2a37;

type Props = {
  onBpm?: (bpm: number) => void;
  onConnect?: (device: BluetoothDevice) => void;
  onDisconnect?: () => void;
};

export default function HRMPanel({ onBpm, onConnect, onDisconnect }: Props) {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);

  const devRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const onBpmRef = useRef(onBpm);
  useEffect(() => {
    onBpmRef.current = onBpm;
  }, [onBpm]);

  const parseHeartRate = (dv: DataView): number => {
    const flags = dv.getUint8(0);
    const hr16 = (flags & 0x01) !== 0;
    return hr16 ? dv.getUint16(1, true) : dv.getUint8(1);
  };

  // Stable handler that reads from onBpmRef (so function identity never changes)
  const handleValueChanged = useCallback((e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    const val = parseHeartRate(dv);
    setBpm(val);
    onBpmRef.current?.(val);
  }, []); // ← stable

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
    setDevice(null);
    setBpm(null);
    onDisconnect?.();
  }, []); // ← stable

  // Stable, doesn’t change when props change
  const handleGattDisconnected = useCallback(() => {
    hardDisconnect();
  }, [hardDisconnect]);

  const connect = useCallback(async () => {
    if (!("bluetooth" in navigator)) {
      setError("Web Bluetooth not available in this browser.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [HEART_RATE_SERVICE],
      });
      devRef.current = dev;
      dev.addEventListener("gattserverdisconnected", handleGattDisconnected);

      const gatt = await dev.gatt!.connect();
      setDevice(dev);
      onConnect?.(dev);

      const svc = await gatt.getPrimaryService(HEART_RATE_SERVICE);
      const ch = await svc.getCharacteristic(HEART_RATE_MEASUREMENT);
      charRef.current = ch;

      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", handleValueChanged);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      hardDisconnect();
    } finally {
      setIsConnecting(false);
    }
  }, [handleGattDisconnected, handleValueChanged, hardDisconnect, onConnect]);

  const disconnect = useCallback(async () => {
    hardDisconnect();
  }, [hardDisconnect]);

  // 🔒 Unmount-only cleanup (empty deps) — no disconnect on prop changes
  useEffect(() => {
    return () => {
      hardDisconnect();
    };
  }, [hardDisconnect]);

  return (
    <div
      style={{
        maxWidth: 420,
        padding: 16,
        border: "1px solid #374151",
        borderRadius: 12,
        background: "#0b1220",
        color: "#e5e7eb",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Heart Rate Monitor</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={connect}
          disabled={isConnecting || !!device}
          style={btn}
        >
          {isConnecting ? "Connecting…" : "Connect HRM"}
        </button>
        <button onClick={disconnect} disabled={!device} style={btnOutline}>
          Disconnect
        </button>
      </div>
      <p>
        Device: <strong>{device?.name ?? "—"}</strong>
      </p>
      <p style={{ fontSize: 28, margin: "12px 0" }}>
        {bpm == null ? "—" : `${bpm} bpm`}
      </p>
      {error && <p style={{ color: "rgb(248,113,113)" }}>Error: {error}</p>}
      <small>
        Tip: keep the sensor awake and close to your computer when connecting.
      </small>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#00110a",
  border: "none",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};
