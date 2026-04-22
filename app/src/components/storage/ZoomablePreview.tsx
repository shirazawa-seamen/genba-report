"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Props {
  src: string;
  alt: string;
  kind: "image" | "pdf";
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function ZoomablePreview({ src, alt, kind }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);

  const reset = useCallback(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => { reset(); }, [src, reset]);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const applyScale = useCallback(
    (next: number, originX?: number, originY?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ox = (originX ?? rect.width / 2) - rect.width / 2;
      const oy = (originY ?? rect.height / 2) - rect.height / 2;
      const prev = scaleRef.current;
      const clamped = clamp(next, MIN_SCALE, MAX_SCALE);
      const ratio = clamped / prev;
      const newTx = clamped === 1 ? 0 : (txRef.current - ox) * ratio + ox;
      const newTy = clamped === 1 ? 0 : (tyRef.current - oy) * ratio + oy;
      scaleRef.current = clamped;
      txRef.current = newTx;
      tyRef.current = newTy;
      setScale(clamped);
      setTx(newTx);
      setTy(newTy);
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── PointerEvent + setPointerCapture (iOS PWA / WKWebView 対応) ──
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchInitDist = 0;
    let pinchInitScale = 1;
    let pinchCX = 0;
    let pinchCY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTx = 0;
    let panStartTy = 0;

    const onPointerDown = (e: PointerEvent) => {
      try { el.setPointerCapture(e.pointerId); } catch {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        pinchInitDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchInitScale = scaleRef.current;
        const rect = el.getBoundingClientRect();
        pinchCX = (pts[0].x + pts[1].x) / 2 - rect.left;
        pinchCY = (pts[0].y + pts[1].y) / 2 - rect.top;
        panStartX = 0;
      } else if (pointers.size === 1 && scaleRef.current > 1) {
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartTx = txRef.current;
        panStartTy = tyRef.current;
        pinchInitDist = 0;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinchInitDist > 0) {
        const pts = Array.from(pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        applyScale(pinchInitScale * (dist / pinchInitDist), pinchCX, pinchCY);
      } else if (pointers.size === 1 && panStartX !== 0) {
        txRef.current = panStartTx + (e.clientX - panStartX);
        tyRef.current = panStartTy + (e.clientY - panStartY);
        setTx(txRef.current);
        setTy(tyRef.current);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchInitDist = 0;
      if (pointers.size === 0) { panStartX = 0; }
      if (pointers.size === 1 && scaleRef.current > 1) {
        const remaining = Array.from(pointers.values())[0];
        panStartX = remaining.x;
        panStartY = remaining.y;
        panStartTx = txRef.current;
        panStartTy = tyRef.current;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyScale(scaleRef.current * (1 + -e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [applyScale]);

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : undefined;
    const y = rect ? e.clientY - rect.top : undefined;
    applyScale(scaleRef.current > 1 ? 1 : 2, x, y);
  };

  return (
    <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center select-none"
        style={{ touchAction: "none", cursor: scale > 1 ? "grab" : "default" }}
        onDoubleClick={onDoubleClick}
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        ) : (
          // PDF: iframeの上に透明オーバーレイを重ねてポインターを捕捉
          <div className="relative w-full h-full">
            <iframe
              src={src}
              title={alt}
              className="w-full h-full rounded-lg border-0"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: "center center",
                pointerEvents: "none",
              }}
            />
            {/* ポインター捕捉用オーバーレイ */}
            <div className="absolute inset-0" style={{ touchAction: "none" }} />
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow px-1 py-1">
        <button
          type="button"
          onClick={() => applyScale(scaleRef.current - 0.25)}
          className="p-1.5 hover:bg-gray-100 rounded-md"
          aria-label="縮小"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-700 w-10 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => applyScale(scaleRef.current + 0.25)}
          className="p-1.5 hover:bg-gray-100 rounded-md"
          aria-label="拡大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={reset}
          className="p-1.5 hover:bg-gray-100 rounded-md"
          aria-label="リセット"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
