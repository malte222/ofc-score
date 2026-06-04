// src/components/InAppCamera.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";

export default function InAppCamera({ onCapture, onCancel, onSelectFile }) {
  const videoRef = useRef();
  const streamRef = useRef();
  const containerRef = useRef();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  const [zoom, setZoom] = useState(1);
  const maxZoom = 4;
  const minZoom = 1;

  const initialDistRef = useRef(null);
  const initialZoomRef = useRef(1);

  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultZoom = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventDefaultZoom, {
      passive: false,
    });
    return () => {
      container.removeEventListener("touchmove", preventDefaultZoom);
    };
  }, []);

  const startStream = useCallback(async (facing) => {
    setTorch(false);
    setHasTorch(false);
    setZoom(1);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === "function") {
          const caps = videoTrack.getCapabilities();
          if (caps.torch) {
            setHasTorch(true);
          }
        }

        setReady(true);
        setError(null);
      }
    } catch (err) {
      if (err.name !== "AbortError" && err.name !== "DOMException") {
        setError(
          "Kamera-Zugriff verweigert. In Sandboxed Previews (StackBlitz) nutzen Sie bitte die Foto-Auswahl."
        );
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      startStream(facingMode);
    }
    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startStream]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialDistRef.current = dist;
      initialZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialDistRef.current;
      let nextZoom = initialZoomRef.current * factor;
      nextZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
      setZoom(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    initialDistRef.current = null;
  };

  const handleSliderChange = (val) => {
    setZoom(val);
  };

  const toggleTorch = () => {
    const videoTrack =
      streamRef.current && streamRef.current.getVideoTracks()[0];
    if (videoTrack && hasTorch) {
      const nextTorch = !torch;
      videoTrack
        .applyConstraints({ advanced: [{ torch: nextTorch }] })
        .then(() => {
          setTorch(nextTorch);
        })
        .catch(() => {});
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    const baseSquareSize = Math.min(w, h);
    const croppedSensorSize = baseSquareSize / zoom;
    const x = (w - croppedSensorSize) / 2;
    const y = (h - croppedSensorSize) / 2;

    const canvas = document.createElement("canvas");
    const outputSize = 1080;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      video,
      x,
      y,
      croppedSensorSize,
      croppedSensorSize,
      0,
      0,
      outputSize,
      outputSize
    );

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onCapture(dataUrl);
  };

  const flipCamera = () => {
    setZoom(1);
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {error ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            padding: "2rem",
            textAlign: "center",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 48 }}>📷</div>
          <div style={{ fontSize: 15, maxWidth: 300, lineHeight: 1.5 }}>{error}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={onCancel}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Abbrechen
            </button>
            {onSelectFile && (
              <button
                onClick={onSelectFile}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: "#3498db",
                  color: "#fff",
                  fontSize: 15,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Foto hochladen / Galerie
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1/1",
              margin: "auto auto 0 auto",
              position: "relative",
              overflow: "hidden",
              background: "#000",
              border: "3px solid rgba(255,255,255,0.3)",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transform: "scale(" + zoom + ")",
                transformOrigin: "center center",
                transition: "transform 0.05s ease-out",
              }}
            />

            {["tl", "tr", "bl", "br"].map((c) => (
              <div
                key={c}
                style={{
                  position: "absolute",
                  top: c.startsWith("t") ? 16 : "auto",
                  bottom: c.startsWith("b") ? 16 : "auto",
                  left: c.endsWith("l") ? 16 : "auto",
                  right: c.endsWith("r") ? 16 : "auto",
                  width: 28,
                  height: 28,
                  borderTop: c.startsWith("t") ? "3px solid #fff" : "none",
                  borderBottom: c.startsWith("b") ? "3px solid #fff" : "none",
                  borderLeft: c.endsWith("l") ? "3px solid #fff" : "none",
                  borderRight: c.endsWith("r") ? "3px solid #fff" : "none",
                }}
              />
            ))}
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              margin: "0 auto auto auto",
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              background: "transparent",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#fff",
              }}
            >
              <span style={{ fontSize: 13, minWidth: 35, color: "#95a5a6" }}>
                1.0x
              </span>
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step="0.05"
                value={zoom}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.2)",
                  outline: "none",
                  WebkitAppearance: "none",
                  accentColor: "#3498db",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  minWidth: 45,
                  textAlign: "right",
                  color: "#3498db",
                }}
              >
                {zoom.toFixed(1)}x
              </span>
            </div>

            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                onClick={toggleTorch}
                disabled={!hasTorch}
                style={{
                  background: torch ? "#f1c40f" : "rgba(255,255,255,0.12)",
                  border: "none",
                  color: torch ? "#000" : "#fff",
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: hasTorch ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: hasTorch ? 1 : 0.4,
                }}
              >
                <span>💡</span>{" "}
                {hasTorch
                  ? torch
                    ? "Licht AN"
                    : "Licht AUS"
                  : "Licht blockiert"}
              </button>

              <span style={{ color: "#7f8c8d", fontSize: 12 }}>
                Pinch zum Zoomen aktiv
              </span>
            </div>
          </div>

          <div
            style={{
              background: "#000",
              padding: "20px 32px 36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={onCancel}
              style={{
                background: "transparent",
                border: "none",
                color: "#7f8c8d",
                fontSize: 15,
                cursor: "pointer",
                padding: "8px 12px",
              }}
            >
              Abbrechen
            </button>

            <button
              onClick={shoot}
              disabled={!ready}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "4px solid #fff",
                background: ready ? "#fff" : "rgba(255,255,255,0.3)",
                cursor: ready ? "pointer" : "not-allowed",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: ready ? "#fff" : "transparent",
                  border: "2px solid #ccc",
                }}
              />
            </button>

            <button
              onClick={flipCamera}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 22,
              }}
            >
              🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
}
