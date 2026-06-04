// src/components/BoardEditor.jsx
import React from "react";
import CardSlot from "./CardSlot";
import { evalHand, parsedCards } from "../utils/pokerLogic";

export default function BoardEditor({
  board,
  label,
  fouled,
  royalty,
  fl,
  isForcedFoul,
  playerIndex,
  activeCardEdit,
  onSelectSlot,
}) {
  const rowDef = [
    { key: "top", label: "Top", count: 3 },
    { key: "middle", label: "Middle", count: 5 },
    { key: "bottom", label: "Bottom", count: 5 },
  ];

  const getHandName = (key, count) => {
    const f = board[key].filter(Boolean);
    if (f.length < count) return "";
    return evalHand(parsedCards(f)).name;
  };

  if (isForcedFoul)
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          border: "1.5px solid #e74c3c",
          borderRadius: 12,
          padding: "0.75rem 1rem",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 14, color: "#ffffff" }}>{label}</span>
          <span
            style={{
              background: "#e74c3c",
              color: "#ffffff",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            Foul
          </span>
        </div>
      </div>
    );

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        border: fouled
          ? "1.5px solid #e74c3c"
          : "0.5px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 12,
        padding: "0.75rem 1rem",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: "#ffffff" }}>{label}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {fl && (
            <span
              style={{
                background: "#2ecc71",
                color: "#ffffff",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 6,
              }}
            >
              Fantasyland
            </span>
          )}
          {fouled && (
            <span
              style={{
                background: "#e74c3c",
                color: "#ffffff",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 6,
              }}
            >
              Fouled
            </span>
          )}
          {royalty > 0 && (
            <span
              style={{
                background: "#f1c40f",
                color: "#1e293b",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 6,
                fontWeight: "bold",
              }}
            >
              +{royalty} Roy
            </span>
          )}
        </div>
      </div>

      {rowDef.map(({ key, count }) => (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: count }).map((_, i) => {
              const isCurrent =
                activeCardEdit &&
                activeCardEdit.playerIndex === playerIndex &&
                activeCardEdit.rowKey === key &&
                activeCardEdit.slotIndex === i;

              return (
                <CardSlot
                  key={i}
                  value={board[key][i] || ""}
                  isActive={isCurrent}
                  onClick={() => onSelectSlot(key, i)}
                />
              );
            })}
          </div>

          <span
            style={{
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.6)",
              maxWidth: 90,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingLeft: 8,
            }}
          >
            {getHandName(key, count)}
          </span>
        </div>
      ))}
    </div>
  );
}
