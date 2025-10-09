// HRMPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
const HEART_RATE_SERVICE = 0x180d;
const HEART_RATE_MEASUREMENT = 0x2a37;

export default function HRMPanel() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const parseHeartRate = (dv: DataView): number => {
    const flags = dv.getUint8(0);
    const hr16 = (flags & 0x01) !== 0;
    return hr16 ? dv.getUint16(1, true) : dv.getUint8(1);
  };

  const onValueChanged = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    setBpm(parseHeartRate(dv));
  };

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [HEART_RATE_SERVICE],
      });
      const gatt = await dev.gatt!.connect();
      setDevice(dev);

      const svc = await gatt.getPrimaryService(HEART_RATE_SERVICE);
      const ch = await svc.getCharacteristic(HEART_RATE_MEASUREMENT);
      charRef.current = ch;

      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", onValueChanged);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      try {
        device?.gatt?.disconnect?.();
      } catch {}
      setDevice(null);
      setBpm(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      charRef.current?.removeEventListener(
        "characteristicvaluechanged",
        onValueChanged
      );
      device?.gatt?.disconnect?.();
    } catch {}
    setDevice(null);
    setBpm(null);
  }, [device]);

  // Clean up listener if component unmounts
  useEffect(() => {
    return () => {
      try {
        charRef.current?.removeEventListener(
          "characteristicvaluechanged",
          onValueChanged
        );
        device?.gatt?.disconnect?.();
      } catch {}
    };
  }, [device]);

  return (
    <div
      style={{
        maxWidth: 420,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 12,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Heart Rate Monitor</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={connect} disabled={isConnecting || !!device}>
          {isConnecting ? "Connecting…" : "Connect HRM"}
        </button>
        <button onClick={disconnect} disabled={!device}>
          Disconnect
        </button>
      </div>
      <p>
        Device: <strong>{device?.name ?? "—"}</strong>
      </p>
      <p style={{ fontSize: 28, margin: "12px 0" }}>
        {bpm == null ? "—" : `${bpm} bpm`}
      </p>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      <small>
        Tip: keep the sensor awake and close to your computer when connecting.
      </small>
    </div>
  );
}
