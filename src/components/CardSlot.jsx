// src/components/CardSlot.jsx
import React from "react";

export default function CardSlot({ value, isActive, isDuplicate = false, onClick }) {
  const suitColor = (v) => {
    if (!v) return "#cbd5e1";
    const s = v.slice(-1);
    if (s === "♠") return "#000000";
    if (s === "♥") return "#e74c3c";
    if (s === "♦") return "#3498db";
    if (s === "♣") return "#b38f00";
    return "#ffffff";
  };

  const borderStyle = isDuplicate
    ? "2.5px solid #e74c3c"                    // ← Roter Rand bei Duplikat
    : isActive
    ? "2px solid #f39c12"
    : value
    ? "1px solid rgba(0, 0, 0, 0.15)"
    : "1.5px dashed rgba(255, 255, 255, 0.35)";

  return (
    <div
      onClick={onClick}
      title="Klicken zum Auswählen"
      style={{
        position: "relative",
        width: 36,
        height: 50,
        borderRadius: 6,
        border: borderStyle,
        background: isActive ? "rgba(243, 156, 18, 0.25)" : "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        boxSizing: "border-box",
        cursor: "pointer",
        color: suitColor(value),
        transition: "all 0.1s ease",
        boxShadow: value ? "0 2px 4px rgba(0,0,0,0.15)" : "none",
      }}
    >
      {value ? (
        <>
          <span
            style={{
              fontWeight: 700,
              fontSize: 12,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {value.slice(0, -1)}
          </span>
          <span
            style={{
              fontSize: 14,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {value.slice(-1)}
          </span>
        </>
      ) : (
        <span
          style={{
            color: "rgba(0, 0, 0, 0.25)",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            fontWeight: "bold",
          }}
        >
          +
        </span>
      )}
    </div>
  );
}
