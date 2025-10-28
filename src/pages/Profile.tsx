// src/pages/Profile.tsx  (small changes from your existing file)
import React from "react";
import type { AppUserDoc } from "../App";

type ProfileProps = { user: AppUserDoc | null | undefined };

export default function Profile({ user }: ProfileProps) {
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
              <span className="field-value">{user.age ?? "—"}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Height</span>
              <span className="field-value">{user.height ?? "—"}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Weight</span>
              <span className="field-value">{user.weight ?? "—"}</span>
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
