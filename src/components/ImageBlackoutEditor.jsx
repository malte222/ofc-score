// src/components/ImageBlackoutEditor.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";

export default function ImageBlackoutEditor({
  src,
  initialStrokes = [],
  onConfirm,
  onCancel,
}) {
  const canvasRef = useRef();
  const imgRef = useRef();
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState(initialStrokes);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(img.width, window.innerWidth - 32);
      const scale = maxW / img.width,
        w = maxW,
        h = img.height * scale;
      setImgSize({ w, h });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 28;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      initialStrokes.forEach((pts) => {
        if (!pts.length) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      });
      imgRef.current = img;
    };
    img.src = src;
  }, [src, initialStrokes]);

  const redraw = useCallback(
    (all, active) => {
      const canvas = canvasRef.current;
      if (!canvas || !imgRef.current) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgRef.current, 0, 0, imgSize.w, imgSize.h);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 28;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const draw = (pts) => {
        if (!pts.length) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      };
      all.forEach(draw);
      if (active && active.length > 0) draw(active);
    },
    [imgSize]
  );

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect(),
      cx = e.touches ? e.touches[0].clientX : e.clientX,
      cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
  };

  const onDown = (e) => {
    e.preventDefault();
    const p = getPos(e);
    setDrawing(true);
    setCurrentStroke([p]);
    redraw(strokes, [p]);
  };

  const onMove = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const p = getPos(e);
    setCurrentStroke((prev) => {
      const ns = [...prev, p];
      redraw(strokes, ns);
      return ns;
    });
  };

  const onUp = (e) => {
    e.preventDefault();
    if (!drawing) return;
    setDrawing(false);
    if (currentStroke.length > 0) {
      const ns = [...strokes, currentStroke];
      setStrokes(ns);
      redraw(ns, []);
    }
    setCurrentStroke([]);
  };

  const undo = () => {
    const ns = strokes.slice(0, -1);
    setStrokes(ns);
    redraw(ns, []);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/jpeg", 0.92).split(",")[1], strokes);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 300,
        overflowY: "auto",
        padding: "12px 0 0 0",
      }}
    >
      <div
        style={{
          background: "var(--color-background-primary)",
          borderRadius: 12,
          padding: "16px",
          width: "100%",
          maxWidth: Math.min(imgSize.w + 24, window.innerWidth - 8),
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          marginBottom: "120px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "var(--color-text-primary)",
            }}
          >
            Bereiche schwärzen
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-secondary)",
            marginBottom: 8,
          }}
        >
          Mit dem Finger über Bereiche malen, die geschwärzt werden sollen.
        </p>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            borderRadius: 8,
            touchAction: "none",
            cursor: "crosshair",
            maxWidth: "100%",
          }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#1a5276",
          padding: "20px 32px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 301,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
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
          onClick={confirm}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "4px solid #fff",
            background: "#27ae60",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 15px rgba(39, 174, 96, 0.4)",
          }}
        >
          <span
            style={{
              fontSize: 38,
              color: "#fff",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ✓
          </span>
        </button>

        <button
          onClick={undo}
          disabled={!strokes.length}
          style={{
            background: strokes.length
              ? "rgba(255,255,255,0.15)"
              : "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: strokes.length ? "pointer" : "not-allowed",
            fontSize: 24,
            color: strokes.length ? "#fff" : "#7f8c8d",
            opacity: strokes.length ? 1 : 0.6,
            transition: "all 0.1s ease",
          }}
        >
          ↩
        </button>
      </div>
    </div>
  );
}
