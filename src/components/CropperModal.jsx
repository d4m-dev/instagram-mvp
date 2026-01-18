import React, { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function CropperModal({
  open,
  file,
  aspect = 1,
  outputWidth = 1080,
  aspectOptions = null,
  onAspectChange,
  title = "Cắt ảnh",
  onCancel,
  onConfirm
}) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 520, h: 520 });

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      return;
    }

    let active = true;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      const maxHeight = Math.min(640, window.innerHeight * 0.7);
      let width = Math.min(560, window.innerWidth - 80);
      let height = Math.round(width / aspect);
      if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height * aspect);
      }
      setCanvasSize({ w: Math.max(260, Math.round(width)), h: Math.max(260, Math.round(height)) });
    };
    img.onerror = () => {
      if (active) setImage(null);
    };
    img.src = url;

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [open, file, aspect]);

  useEffect(() => {
    if (!open || !image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const baseScale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const scale = baseScale * zoom;
    const maxOffsetX = Math.max(0, (image.width * scale - canvas.width) / 2);
    const maxOffsetY = Math.max(0, (image.height * scale - canvas.height) / 2);
    const offsetX = offset.x * maxOffsetX;
    const offsetY = offset.y * maxOffsetY;

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const cx = canvas.width / 2 + offsetX;
    const cy = canvas.height / 2 + offsetY;

    ctx.drawImage(image, cx - drawWidth / 2, cy - drawHeight / 2, drawWidth, drawHeight);

    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0);
    ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((canvas.width / 3) * 2, 0);
    ctx.lineTo((canvas.width / 3) * 2, canvas.height);
    ctx.moveTo(0, canvas.height / 3);
    ctx.lineTo(canvas.width, canvas.height / 3);
    ctx.moveTo(0, (canvas.height / 3) * 2);
    ctx.lineTo(canvas.width, (canvas.height / 3) * 2);
    ctx.stroke();
  }, [open, image, zoom, offset, canvasSize]);

  function getScale(canvasWidth, canvasHeight) {
    if (!image) return { scale: 1, maxOffsetX: 0, maxOffsetY: 0 };
    const baseScale = Math.max(canvasWidth / image.width, canvasHeight / image.height);
    const scale = baseScale * zoom;
    return {
      scale,
      maxOffsetX: Math.max(0, (image.width * scale - canvasWidth) / 2),
      maxOffsetY: Math.max(0, (image.height * scale - canvasHeight) / 2)
    };
  }

  function handlePointerDown(e) {
    if (!image) return;
    const { maxOffsetX, maxOffsetY } = getScale(canvasSize.w, canvasSize.h);
    setDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
      maxX: maxOffsetX,
      maxY: maxOffsetY
    });
  }

  function handlePointerMove(e) {
    if (!dragging || !image) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const { maxOffsetX, maxOffsetY } = getScale(canvasSize.w, canvasSize.h);
    const nextX = maxOffsetX > 0 ? clamp(dragStart.ox + dx / maxOffsetX, -1, 1) : 0;
    const nextY = maxOffsetY > 0 ? clamp(dragStart.oy + dy / maxOffsetY, -1, 1) : 0;
    setOffset({ x: nextX, y: nextY });
  }

  function handlePointerUp() {
    setDragging(false);
  }

  async function confirmCrop() {
    if (!image) return;
    const outW = outputWidth;
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    const baseScale = Math.max(outW / image.width, outH / image.height);
    const scale = baseScale * zoom;
    const maxOffsetX = Math.max(0, (image.width * scale - outW) / 2);
    const maxOffsetY = Math.max(0, (image.height * scale - outH) / 2);
    const offsetX = offset.x * maxOffsetX;
    const offsetY = offset.y * maxOffsetY;

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const cx = outW / 2 + offsetX;
    const cy = outH / 2 + offsetY;

    ctx.drawImage(image, cx - drawWidth / 2, cy - drawHeight / 2, drawWidth, drawHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });
    if (!blob) return;
    const preview = URL.createObjectURL(blob);
    onConfirm?.(blob, preview);
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onCancel} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {aspectOptions?.length ? (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {aspectOptions.map((opt) => (
                <button
                  key={opt.label}
                  className={`btn2 ${Math.abs(opt.value - aspect) < 0.001 ? "active" : ""}`}
                  onClick={() => onAspectChange?.(opt.value)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="cropper-wrap">
            <canvas
              ref={canvasRef}
              className="cropper-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
          <div className="cropper-tools">
            <label className="cropper-label">
              <span className="muted">Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <button className="btn2" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>
              <RefreshCw size={16} />
              Đặt lại
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn2" onClick={onCancel}>Hủy</button>
          <button className="btn" onClick={confirmCrop}>
            <Check size={16} />
            Dùng ảnh này
          </button>
        </div>
      </div>
    </div>
  );
}
