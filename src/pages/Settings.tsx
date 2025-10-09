// pages/Settings.tsx (example)
import HRMPanel from "./components/HRMPanel.tsx";

export default function Settings() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Settings</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Bluetooth Heart Rate</h2>
        <HRMPanel />
      </section>
    </div>
  );
}
