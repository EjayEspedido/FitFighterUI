// src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import type { AppUserDoc } from "./App";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

type ProfileProps = { user: AppUserDoc | null | undefined };

export default function Profile({ user }: ProfileProps) {
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setHeight(
      user.height !== undefined && user.height !== null
        ? String(user.height)
        : ""
    );
    setWeight(
      user.weight !== undefined && user.weight !== null
        ? String(user.weight)
        : ""
    );
    setAge(user.age !== undefined && user.age !== null ? String(user.age) : "");
  }, [user]);

  if (user === undefined) {
    return (
      <div className="page">
        <div className="menu-desc" style={{ marginTop: 40 }}>
          Loading profile…
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="page">
        <div className="menu-desc" style={{ marginTop: 40 }}>
          No user data available.
        </div>
      </div>
    );
  }

  const createdAt = formatCreatedAt(user.createdAt);
  const initials = (user.displayName || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  async function handleSave() {
    const uid = user?.uid;
    if (!uid) {
      setMessage("User ID missing — cannot save.");
      return;
    }

    const heightVal = height.trim() === "" ? null : Number(height);
    const weightVal = weight.trim() === "" ? null : Number(weight);
    const ageVal = age.trim() === "" ? null : Number(age);

    if (heightVal !== null && Number.isNaN(heightVal)) {
      setMessage("Height must be a number.");
      return;
    }
    if (weightVal !== null && Number.isNaN(weightVal)) {
      setMessage("Weight must be a number.");
      return;
    }
    if (
      ageVal !== null &&
      (Number.isNaN(ageVal) || !Number.isInteger(ageVal) || ageVal < 0)
    ) {
      setMessage("Age must be a non-negative integer (or left blank).");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const db = getFirestore();
      const userRef = doc(db, "users", uid);

      // Build payload explicitly so we only set intended fields
      const payload: Record<string, any> = {
        height: heightVal,
        weight: weightVal,
        age: ageVal,
      };

      await updateDoc(userRef, payload);
      setMessage("Saved.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid rgba(24,255,109,0.25)",
    background: "rgba(24,255,109,0.05)",
    color: "#b9ffd8",
    fontFamily: '"Orbitron", sans-serif',
    fontSize: "14px",
    minWidth: "120px",
    outline: "none",
    transition: "border 0.15s ease, background 0.15s ease",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "2px solid var(--neon)",
    background: "transparent",
    color: "var(--neon)",
    fontFamily: '"Orbitron", sans-serif',
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    letterSpacing: "1px",
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: "default",
  };

  return (
    <div className="page profile-page">
      <div className="hero">
        <div className="profile-header-row">
          <div className="profile-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" />
            ) : (
              <span style={{ color: "var(--neon)", fontWeight: 800 }}>
                {initials}
              </span>
            )}
          </div>
          <div>
            <h1 className="title">{user.displayName ?? "User Profile"}</h1>
            <p className="tagline">{user.email ?? ""}</p>
            <div className="profile-underline" />
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <h2>Personal Info</h2>
          <div className="profile-fields">
            <div className="profile-field">
              <span className="field-label">Level</span>
              <span className="field-value">{user.level ?? "—"}</span>
            </div>

            <div className="profile-field">
              <span className="field-label">Age</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  id="age-input"
                  style={inputStyle}
                  type="number"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="years"
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--neon)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(24,255,109,0.25)")
                  }
                  min={0}
                />
              </div>
            </div>

            <div className="profile-field" style={{ display: "flex", gap: 12 }}>
              <label className="field-label" htmlFor="height-input">
                Height
              </label>
              <input
                id="height-input"
                style={inputStyle}
                type="text"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="cm"
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--neon)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(24,255,109,0.25)")
                }
              />
            </div>

            <div className="profile-field" style={{ display: "flex", gap: 12 }}>
              <label className="field-label" htmlFor="weight-input">
                Weight
              </label>
              <input
                id="weight-input"
                style={inputStyle}
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="kg"
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--neon)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(24,255,109,0.25)")
                }
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                style={saving ? disabledButtonStyle : buttonStyle}
                onClick={handleSave}
                disabled={saving}
                onMouseEnter={(e) => {
                  if (!saving) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--neon)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#000";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 0 16px var(--neon)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--neon)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "none";
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {message && (
                <span style={{ marginLeft: 12, color: "#9be8bd" }}>
                  {message}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h2>Account Details</h2>
          <div className="profile-fields">
            <div className="profile-field">
              <span className="field-label">Created At</span>
              <span className="field-value time">{createdAt}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCreatedAt(raw: any) {
  if (!raw) return "—";
  if (raw.seconds && typeof raw.seconds === "number") {
    return new Date(raw.seconds * 1000).toLocaleString();
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toLocaleString();
  return String(raw);
}
