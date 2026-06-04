// src/components/Nav.jsx
import React from "react";
import { BACKGROUND_COLOR } from "../constants/pokerConstants";

export default function Nav({ view, setView }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 20,
        borderBottom: "0.5px solid rgba(255, 255, 255, 0.2)",
        paddingBottom: 12,
      }}
    >
      {[
        ["home", "ti-home", "Home"],
        ["history", "ti-history", "Verlauf"],
        ["players", "ti-users", "Spieler"],
      ].map(([v, icon, label]) => (
        <button
          key={v}
          onClick={() => setView(v)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: view === v ? "none" : "1px solid rgba(255, 255, 255, 0.3)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: view === v ? 600 : 400,
            background: view === v ? "#ffffff" : "transparent",
            color: view === v ? BACKGROUND_COLOR : "#ffffff",
          }}
        >
          <i
            className={"ti " + icon}
            style={{ marginRight: 6, fontSize: 14, verticalAlign: "-2px" }}
          />
          {label}
        </button>
      ))}
    </div>
  );
}
