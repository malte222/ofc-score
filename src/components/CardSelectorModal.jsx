// src/components/CardSelectorModal.jsx
import React from "react";

export default function CardSelectorModal({
  activeSlot,
  boards,
  players,
  activePlayers,
  onSelectCard,
  onClearCard,
  onClose,
}) {
  if (!activeSlot) return null;

  const { playerIndex, rowKey, slotIndex } = activeSlot;
  const player = players[activePlayers[playerIndex]];
  const playerName = player ? player.name : "Spieler " + (playerIndex + 1);

  const usedCards = new Set();
  boards.forEach((b) => {
    if (!b) return;
    ["top", "middle", "bottom"].forEach((rk) => {
      if (b[rk]) {
        b[rk].forEach((c) => {
          if (c) usedCards.add(c);
        });
      }
    });
  });

  const suits = [
    { key: "s", symbol: "♠", color: "#000000" },
    { key: "h", symbol: "♥", color: "#e74c3c" },
    { key: "d", symbol: "♦", color: "#3498db" },
    { key: "c", symbol: "♣", color: "#b38f00" },
  ];
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

  const rowLabel = rowKey.charAt(0).toUpperCase() + rowKey.slice(1);
  const maxSlots = rowKey === "top" ? 3 : 5;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.15)",
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          width: "100%",
          maxWidth: 680,
          margin: "0 auto",
          padding: "16px 16px 36px 16px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
              {playerName}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
              {rowLabel} - Karte {slotIndex + 1} von {maxSlots}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={onClearCard}
              title="Karte entfernen"
              style={{
                background: "#e74c3c",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(231, 76, 60, 0.3)",
              }}
            >
              ✕
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#3498db",
                border: "none",
                borderRadius: 8,
                padding: "6px 16px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Schließen
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {suits.map((suit) => (
            <div
              key={suit.key}
              style={{
                display: "flex",
                gap: 3,
                alignItems: "center",
                minWidth: 340,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: suit.color,
                  minWidth: 20,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {suit.symbol}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  flex: 1,
                  justifyContent: "space-between",
                }}
              >
                {ranks.map((rank) => {
                  const cardString = rank + suit.symbol;
                  const isUsed = usedCards.has(cardString);
                  const isCurrent =
                    boards[playerIndex] &&
                    boards[playerIndex][rowKey] &&
                    boards[playerIndex][rowKey][slotIndex] === cardString;

                  return (
                    <button
                      key={rank}
                      disabled={isUsed && !isCurrent}
                      onClick={() => onSelectCard(cardString)}
                      style={{
                        flex: 1,
                        height: 38,
                        minWidth: 23,
                        padding: 0,
                        borderRadius: 4,
                        border: isCurrent
                          ? "2px solid #f39c12"
                          : "0.5px solid #475569",
                        background: isCurrent
                          ? "rgba(243, 156, 18, 0.35)"
                          : isUsed
                          ? "#1e293b"
                          : "#ffffff",
                        color: isCurrent
                          ? "#f39c12"
                          : isUsed
                          ? "#475569"
                          : "#000000",
                        cursor: isUsed && !isCurrent ? "not-allowed" : "pointer",
                        opacity: isUsed && !isCurrent ? 0.25 : 1,
                        fontSize: 12,
                        fontWeight: "bold",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s ease",
                      }}
                    >
                      <span>{rank}</span>
                      <span
                        style={{
                          fontSize: 10,
                          marginTop: -2,
                          color: isUsed && !isCurrent ? "#475569" : suit.color,
                        }}
                      >
                        {suit.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
