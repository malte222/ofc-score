// src/App.jsx
// Main application component for Pineapple OFC Poker scorer
// Refactored into clean modules while preserving 100% of original functionality

import React, { useState, useEffect, useRef, useCallback } from "react";

// Constants
import { BACKGROUND_COLOR, BACKGROUND_IMAGE_URL } from "./constants/pokerConstants";

// Utils
import {
  isFouled,
  getTotalRoyalties,
  qualifiesFL,
  calcPoints,
  isBoardFilled,
} from "./utils/pokerLogic";
import { loadData, saveData } from "./utils/storage";

// Services
import { recognizeAllBoards, normalizeCard } from "./services/geminiService";

// Components
import Nav from "./components/Nav";
import BoardEditor from "./components/BoardEditor";
import CardSelectorModal from "./components/CardSelectorModal";
import InAppCamera from "./components/InAppCamera";
import ImageBlackoutEditor from "./components/ImageBlackoutEditor";

export default function App() {
  const [view, setView] = useState("home");
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [capturedImages, setCapturedImages] = useState({});
  const [forcedFouls, setForcedFouls] = useState({});
  const [scanStatus, setScanStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [blackoutState, setBlackoutState] = useState(null);
  const [cameraState, setCameraState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeCardEdit, setActiveCardEdit] = useState(null);

  const galleryRefs = useRef({});

  // Load persisted data on mount
  useEffect(() => {
    const { players: p, sessions: s } = loadData();
    setPlayers(p);
    setSessions(s);
    setLoading(false);
  }, []);

  const persist = useCallback((p, s) => {
    setPlayers(p);
    setSessions(s);
    saveData(p, s);
  }, []);

  const emptyBoard = () => ({
    top: ["", "", ""],
    middle: ["", "", "", "", ""],
    bottom: ["", "", "", "", ""],
  });

  // Player management
  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    persist(
      [
        ...players,
        { id: Date.now(), name: newPlayerName.trim(), score: 0, games: 0 },
      ],
      sessions
    );
    setNewPlayerName("");
  };

  const removePlayer = (id) => {
    persist(
      players.filter((p) => p.id !== id),
      sessions
    );
  };

  // Start a new round
  const startRound = () => {
    if (activePlayers.length < 2) return;
    setBoards(activePlayers.map(() => emptyBoard()));
    setCapturedImages({});
    setForcedFouls({});
    setScanStatus("");
    setResult(null);
    setView("round");
  };

  const toggleFoul = (bi) => {
    setForcedFouls((prev) => {
      const next = { ...prev };
      if (next[bi]) delete next[bi];
      else next[bi] = true;
      return next;
    });
  };

  // Long-press camera context menu
  const pressTimer = useRef(null);
  const wasLongPress = useRef(false);

  const handleCameraPress = (e, bi) => {
    wasLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const menuY = rect.top - 120;
      setContextMenu({
        x: rect.left,
        y: menuY < 10 ? rect.bottom + 4 : menuY,
        boardIndex: bi,
      });
    }, 500);
  };

  const handleCameraRelease = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const openInAppCamera = (bi) => setCameraState({ boardIndex: bi });

  const openGallery = (bi) => {
    if (galleryRefs.current[bi]) galleryRefs.current[bi].click();
  };

  const handleCameraCapture = (dataUrl) => {
    const bi = cameraState.boardIndex;
    setCameraState(null);
    setBlackoutState({
      boardIndex: bi,
      src: dataUrl,
      initialStrokes: [],
      mimeType: "image/jpeg",
    });
  };

  const handleFileSelected = async (e, bi) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = null;

    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    setBlackoutState({
      boardIndex: bi,
      src: dataUrl,
      initialStrokes: [],
      mimeType: file.type || "image/jpeg",
    });
  };

  const handleBlackoutConfirm = (b64, strokes) => {
    const bi = blackoutState.boardIndex;
    setCapturedImages((p) => ({
      ...p,
      [bi]: {
        base64: b64,
        mimeType: blackoutState.mimeType,
        previewUrl: `data:${blackoutState.mimeType};base64,${b64}`,
        originalSrc: blackoutState.src,
        strokes,
      },
    }));
    setBlackoutState(null);
    setForcedFouls((p) => {
      const n = { ...p };
      delete n[bi];
      return n;
    });
  };

  const removePhoto = (bi) =>
    setCapturedImages((p) => {
      const n = { ...p };
      delete n[bi];
      return n;
    });

  // Auto-advance card input
  const getNextSlot = (rowKey, slotIndex) => {
    if (rowKey === "top") {
      if (slotIndex < 2) return { rowKey: "top", slotIndex: slotIndex + 1 };
      return { rowKey: "middle", slotIndex: 0 };
    }
    if (rowKey === "middle") {
      if (slotIndex < 4) return { rowKey: "middle", slotIndex: slotIndex + 1 };
      return { rowKey: "bottom", slotIndex: 0 };
    }
    if (rowKey === "bottom") {
      if (slotIndex < 4) return { rowKey: "bottom", slotIndex: slotIndex + 1 };
      return null;
    }
    return null;
  };

  const handleSelectCard = (cardString) => {
    if (!activeCardEdit) return;
    const { playerIndex, rowKey, slotIndex } = activeCardEdit;

    setBoards((prev) => {
      const next = [...prev];
      const currentBoard = { ...next[playerIndex] };
      currentBoard[rowKey] = [...currentBoard[rowKey]];
      currentBoard[rowKey][slotIndex] = cardString;
      next[playerIndex] = currentBoard;
      return next;
    });

    const next = getNextSlot(rowKey, slotIndex);
    if (next) {
      setActiveCardEdit({
        playerIndex,
        rowKey: next.rowKey,
        slotIndex: next.slotIndex,
      });
    } else {
      setActiveCardEdit(null);
    }
  };

  const handleClearCard = () => {
    if (!activeCardEdit) return;
    const { playerIndex, rowKey, slotIndex } = activeCardEdit;

    setBoards((prev) => {
      const next = [...prev];
      const currentBoard = { ...next[playerIndex] };
      currentBoard[rowKey] = [...currentBoard[rowKey]];
      currentBoard[rowKey][slotIndex] = "";
      next[playerIndex] = currentBoard;
      return next;
    });

    const next = getNextSlot(rowKey, slotIndex);
    if (next) {
      setActiveCardEdit({
        playerIndex,
        rowKey: next.rowKey,
        slotIndex: next.slotIndex,
      });
    } else {
      setActiveCardEdit(null);
    }
  };

  // Ready check
  const allReady =
    activePlayers.length > 0 &&
    activePlayers.every(
      (_, bi) =>
        capturedImages[bi] || forcedFouls[bi] || isBoardFilled(boards[bi])
    );

  // Main evaluation (with optional AI card recognition)
  const handleEvaluate = async () => {
    if (!allReady) return;
    setIsScanning(true);

    const imageSlots = activePlayers.map((_, bi) =>
      forcedFouls[bi] ? null : capturedImages[bi]
    );
    const nonFouledImages = imageSlots.filter(Boolean);
    const hasImages = nonFouledImages.length > 0;

    if (hasImages) {
      setScanStatus("KI analysiert Boards…");
    }

    try {
      let recognized = [];
      if (hasImages) {
        recognized = (await recognizeAllBoards(nonFouledImages)) || [];
      }

      let riIdx = 0;
      const newBoards = boards.map((b, bi) => {
        if (forcedFouls[bi]) return b;

        if (capturedImages[bi]) {
          const r = recognized[riIdx++];
          if (!r) return b;
          return {
            top: (Array.isArray(r.top) ? r.top : [])
              .slice(0, 3)
              .map(normalizeCard)
              .concat(["", "", ""])
              .slice(0, 3),
            middle: (Array.isArray(r.middle) ? r.middle : [])
              .slice(0, 5)
              .map(normalizeCard)
              .concat(["", "", "", "", ""])
              .slice(0, 5),
            bottom: (Array.isArray(r.bottom) ? r.bottom : [])
              .slice(0, 5)
              .map(normalizeCard)
              .concat(["", "", "", "", ""])
              .slice(0, 5),
          };
        }
        return b;
      });

      setBoards(newBoards);

      const foulsArr = activePlayers.map((_, bi) => !!forcedFouls[bi]);
      const res = calcPoints(newBoards, foulsArr);
      setResult({
        ...res,
        fl: newBoards.map((b, i) => (foulsArr[i] ? false : qualifiesFL(b))),
      });
      setScanStatus("");
    } catch (err) {
      setScanStatus("Fehler: " + err.message);
    }
    setIsScanning(false);
  };

  const saveRound = () => {
    const ns = {
      id: Date.now(),
      date: new Date().toISOString(),
      players: activePlayers.map((i) => (players[i] ? players[i].id : null)),
      playerNames: activePlayers.map((i) =>
        players[i] ? players[i].name : ""
      ),
      delta: result.delta,
      royalties: result.royalties,
      fouled: result.fouled,
    };

    persist(
      players.map((p, idx) => {
        const pi = activePlayers.indexOf(idx);
        if (pi === -1) return p;
        return {
          ...p,
          score: (p.score || 0) + result.delta[pi],
          games: (p.games || 0) + 1,
        };
      }),
      [ns, ...sessions]
    );

    setResult(null);
    setView("home");
  };

  const discardRound = () => {
    setResult(null);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 300,
          background: BACKGROUND_COLOR,
          color: "#fff",
        }}
      >
        Lade…
      </div>
    );
  }

  const appBgStyle = BACKGROUND_IMAGE_URL
    ? {
        backgroundImage: "url(" + BACKGROUND_IMAGE_URL + ")",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : {
        backgroundColor: BACKGROUND_COLOR,
      };

  const BOTTOM_H = result ? 130 : 100;

  return (
    <div
      style={{
        ...appBgStyle,
        color: "#ffffff",
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* HOME VIEW */}
      {view === "home" && (
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "1rem 16px",
            paddingBottom: 100,
            minHeight: "100vh",
            position: "relative",
          }}
        >
          <Nav view={view} setView={setView} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <i className="ti ti-cards" style={{ fontSize: 28, color: "#ffffff" }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 500 }}>Pineapple OFC</div>
              <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)" }}>
                Spieler für die neue Runde auswählen
              </div>
            </div>
          </div>

          {players.length === 0 && (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.7)",
                border: "1.5px dashed rgba(255, 255, 255, 0.3)",
                borderRadius: 12,
              }}
            >
              Noch keine Spieler – gehe zu <strong>Spieler</strong> um welche
              anzulegen.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {players.map((p, i) => {
              const active = activePlayers.includes(i);
              return (
                <div
                  key={p.id}
                  onClick={() =>
                    setActivePlayers((ap) =>
                      active
                        ? ap.filter((x) => x !== i)
                        : activePlayers.length < 3
                        ? [...ap, i]
                        : ap
                    )
                  }
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: active
                      ? "2px solid #ffffff"
                      : "1px solid rgba(255, 255, 255, 0.15)",
                    background: active
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(255, 255, 255, 0.08)",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 15,
                        color: "#ffffff",
                      }}
                    >
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15, color: "#ffffff" }}>
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255, 255, 255, 0.7)",
                          marginTop: 1,
                        }}
                      >
                        {p.games || 0} Spiele · {p.score > 0 ? "+" : ""}
                        {p.score || 0} Pts
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "2px solid",
                      borderColor: active ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
                      background: active ? "#ffffff" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          color: BACKGROUND_COLOR,
                          fontSize: 14,
                          lineHeight: 1,
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 16px",
              background: "#0d3a1f",
              borderTop: "1px solid rgba(255, 255, 255, 0.2)",
              zIndex: 50,
            }}
          >
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {activePlayers.length >= 2 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {activePlayers.map((i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: "rgba(255, 255, 255, 0.2)",
                        color: "#ffffff",
                        fontWeight: 500,
                      }}
                    >
                      {players[i] ? players[i].name : ""}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={startRound}
                disabled={activePlayers.length < 2}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 600,
                  fontSize: 16,
                  cursor:
                    activePlayers.length >= 2 ? "pointer" : "not-allowed",
                  background:
                    activePlayers.length >= 2
                      ? "#ffffff"
                      : "rgba(255, 255, 255, 0.15)",
                  color:
                    activePlayers.length >= 2
                      ? BACKGROUND_COLOR
                      : "rgba(255, 255, 255, 0.4)",
                  boxShadow:
                    activePlayers.length >= 2
                      ? "0 4px 12px rgba(0,0,0,0.2)"
                      : "none",
                }}
              >
                {"Runde starten (" + activePlayers.length + " Spieler)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUND VIEW */}
      {view === "round" && (
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "1rem 16px",
            paddingBottom: BOTTOM_H + 16,
            minHeight: "100vh",
          }}
        >
          <div style={{ padding: "0.5rem 0" }}>
            {scanStatus && (
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.15)",
                  fontSize: 13,
                  color: "#ffffff",
                  marginBottom: 12,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                {scanStatus}
              </div>
            )}

            {activePlayers.map((pi, bi) => {
              const p = players[pi];
              const fouled = boards[bi] ? isFouled(boards[bi]) : false;
              const royalty =
                boards[bi] && !fouled ? getTotalRoyalties(boards[bi]) : 0;
              const fl =
                boards[bi] && !fouled ? qualifiesFL(boards[bi]) : false;

              return (
                <div
                  key={pi}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  {bi === 0 ? (
                    <button
                      onClick={() => setView("home")}
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: "50%",
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#ffffff",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: "bold",
                          lineHeight: 1,
                          display: "inline-block",
                          transform: "translateY(-1px)",
                        }}
                      >
                        ←
                      </span>
                    </button>
                  ) : (
                    <div style={{ width: 36, flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <BoardEditor
                      board={boards[bi] || emptyBoard()}
                      label={(p && p.name) || "Spieler " + (bi + 1)}
                      fouled={fouled}
                      royalty={royalty}
                      fl={fl}
                      isForcedFoul={!!forcedFouls[bi]}
                      playerIndex={bi}
                      activeCardEdit={activeCardEdit}
                      onSelectSlot={(rowKey, slotIndex) =>
                        setActiveCardEdit({ playerIndex: bi, rowKey, slotIndex })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card Selector Modal */}
          {activeCardEdit && (
            <CardSelectorModal
              activeSlot={activeCardEdit}
              boards={boards}
              players={players}
              activePlayers={activePlayers}
              onSelectCard={handleSelectCard}
              onClearCard={handleClearCard}
              onClose={() => setActiveCardEdit(null)}
            />
          )}

          {/* Bottom action bar */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#103f22",
              borderTop: "1px solid rgba(255, 255, 255, 0.2)",
              zIndex: 50,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{ maxWidth: 680, margin: "0 auto", padding: "10px 12px" }}
            >
              {result ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 10,
                      justifyContent: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {activePlayers.map((pi, i) => {
                      const p = players[pi];
                      const d = result.delta[i];
                      return (
                        <div
                          key={pi}
                          style={{
                            textAlign: "center",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: 10,
                            padding: "8px 14px",
                            minWidth: 80,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.8)",
                              marginBottom: 2,
                            }}
                          >
                            {p ? p.name : ""}
                          </div>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 600,
                              color:
                                d > 0 ? "#2ecc71" : d < 0 ? "#e74c3c" : "#ffffff",
                            }}
                          >
                            {d > 0 ? "+" : ""}
                            {d}
                          </div>
                          {result.fouled[i] && (
                            <div style={{ fontSize: 10, color: "#e74c3c", marginTop: 1 }}>
                              Fouled
                            </div>
                          )}
                          {result.fl && result.fl[i] && (
                            <div style={{ fontSize: 10, color: "#f1c40f", marginTop: 1 }}>
                              Fantasyland!
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={discardRound}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        borderRadius: 10,
                        border: "1.5px solid rgba(255,255,255,0.3)",
                        background: "transparent",
                        color: "#fff",
                        fontWeight: 500,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Verwerfen
                    </button>
                    <button
                      onClick={saveRound}
                      style={{
                        flex: 2,
                        padding: "12px 0",
                        borderRadius: 10,
                        border: "none",
                        background: "#2ecc71",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      ✓ Speichern
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 10,
                      justifyContent: "space-around",
                    }}
                  >
                    {activePlayers.map((pi, bi) => {
                      const p = players[pi];
                      const img = capturedImages[bi];
                      const foul = !!forcedFouls[bi];
                      return (
                        <div
                          key={bi}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.8)",
                              fontWeight: 500,
                              textAlign: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                            }}
                          >
                            {(p && p.name) || "P" + (bi + 1)}
                          </span>

                          {img && !foul && (
                            <div
                              style={{
                                position: "relative",
                                width: "100%",
                                maxWidth: 72,
                                aspectRatio: "1/1",
                              }}
                            >
                              <img
                                src={img.previewUrl}
                                alt=""
                                onClick={() =>
                                  setBlackoutState({
                                    boardIndex: bi,
                                    src: img.originalSrc,
                                    mimeType: img.mimeType,
                                    initialStrokes: img.strokes || [],
                                  })
                                }
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                  borderRadius: 6,
                                  display: "block",
                                  cursor: "pointer",
                                  border: "1.5px solid rgba(255,255,255,0.3)",
                                  backgroundColor: "#000",
                                }}
                              />
                              <button
                                onClick={() => removePhoto(bi)}
                                style={{
                                  position: "absolute",
                                  top: -6,
                                  right: -6,
                                  background: "#e74c3c",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "50%",
                                  width: 20,
                                  height: 20,
                                  fontSize: 11,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  padding: 0,
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          )}

                          <button
                            onMouseDown={
                              foul ? null : (e) => handleCameraPress(e, bi)
                            }
                            onMouseUp={foul ? null : () => handleCameraRelease()}
                            onMouseLeave={
                              foul ? null : () => handleCameraRelease()
                            }
                            onTouchStart={
                              foul ? null : (e) => handleCameraPress(e, bi)
                            }
                            onTouchEnd={foul ? null : () => handleCameraRelease()}
                            onClick={() => {
                              if (foul) return;
                              if (!wasLongPress.current) openInAppCamera(bi);
                              wasLongPress.current = false;
                            }}
                            disabled={foul}
                            style={{
                              width: "100%",
                              padding: "8px 0",
                              borderRadius: 8,
                              border: foul
                                ? "1.5px solid rgba(255,255,255,0.1)"
                                : img
                                ? "1.5px solid #27ae60"
                                : "1.5px solid rgba(255,255,255,0.3)",
                              background: foul
                                ? "rgba(255,255,255,0.03)"
                                : img
                                ? "#27ae60"
                                : "rgba(255,255,255,0.12)",
                              color: foul ? "rgba(255,255,255,0.2)" : "#fff",
                              cursor: foul ? "not-allowed" : "pointer",
                              fontSize: 20,
                              lineHeight: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: foul ? 0.4 : 1,
                            }}
                          >
                            📷
                          </button>

                          <button
                            onClick={() => toggleFoul(bi)}
                            style={{
                              width: "100%",
                              padding: "7px 0",
                              borderRadius: 8,
                              border: "none",
                              background: foul
                                ? "#e74c3c"
                                : "rgba(255, 255, 255, 0.12)",
                              color: foul ? "#fff" : "rgba(255, 255, 255, 0.7)",
                              fontWeight: foul ? 600 : 400,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                            }}
                          >
                            {foul && "✕ "}Foul
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleEvaluate}
                    disabled={!allReady || isScanning}
                    style={{
                      width: "100%",
                      padding: "13px 0",
                      borderRadius: 10,
                      border: "none",
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: allReady && !isScanning ? "pointer" : "not-allowed",
                      background:
                        allReady && !isScanning
                          ? "#f39c12"
                          : "rgba(255,255,255,0.15)",
                      color:
                        allReady && !isScanning
                          ? "#fff"
                          : "rgba(255,255,255,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <i className="ti ti-sparkles" style={{ fontSize: 16 }} />
                    {isScanning ? "Analysiere…" : "Auswertung"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY VIEW */}
      {view === "history" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "1rem 16px" }}>
          <Nav view={view} setView={setView} />
          <h3 style={{ fontWeight: 500, fontSize: 16, marginBottom: 16, color: "#ffffff" }}>
            Spielverlauf
          </h3>
          {sessions.length === 0 && (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.7)",
                border: "1.5px dashed rgba(255, 255, 255, 0.3)",
                borderRadius: 12,
              }}
            >
              Noch keine Runden gespeichert.
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "1rem 1.25rem",
                marginBottom: 10,
                background: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: 8,
                }}
              >
                {new Date(s.date).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {s.playerNames.map((name, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 14, color: "#ffffff" }}>{name}</span>
                    <span
                      style={{
                        fontWeight: 500,
                        color:
                          s.delta[i] > 0
                            ? "#2ecc71"
                            : s.delta[i] < 0
                            ? "#e74c3c"
                            : "#ffffff",
                      }}
                    >
                      {s.delta[i] > 0 ? "+" : ""}
                      {s.delta[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PLAYERS VIEW */}
      {view === "players" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "1rem 16px" }}>
          <Nav view={view} setView={setView} />
          <h3 style={{ fontWeight: 500, fontSize: 16, marginBottom: 16, color: "#ffffff" }}>
            Spielerverwaltung
          </h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Neuer Spieler..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#1e293b",
                outline: "none",
              }}
            />
            <button
              onClick={addPlayer}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#ffffff",
                color: BACKGROUND_COLOR,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <i className="ti ti-plus" /> Hinzufügen
            </button>
          </div>
          {players.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 8,
                background: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 500,
                  fontSize: 14,
                  marginRight: 12,
                  color: "#ffffff",
                }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: "#ffffff" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.7)" }}>
                  {p.games || 0} Spiele · Gesamt: {p.score > 0 ? "+" : ""}
                  {p.score || 0}
                </div>
              </div>
              <button
                onClick={() => removePlayer(p.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: 18,
                }}
              >
                <i className="ti ti-trash" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Overlays */}
      {cameraState && (
        <InAppCamera
          onCapture={handleCameraCapture}
          onCancel={() => setCameraState(null)}
          onSelectFile={() => {
            // Trigger hidden file input if needed
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = (e) => handleFileSelected(e, cameraState.boardIndex);
            input.click();
          }}
        />
      )}

      {blackoutState && (
        <ImageBlackoutEditor
          src={blackoutState.src}
          initialStrokes={blackoutState.initialStrokes}
          onConfirm={(b64, strokes) => handleBlackoutConfirm(b64, strokes)}
          onCancel={() => setBlackoutState(null)}
        />
      )}
    </div>
  );
}
