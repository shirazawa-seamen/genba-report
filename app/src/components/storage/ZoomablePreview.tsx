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

  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

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

  // ── ネイティブタッチ/ポインターイベント (passive:false で preventDefault 可) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      Array.from(e.changedTouches).forEach((t) => {
        touches.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      });
      if (touches.current.size === 2) {
        const [a, b] = Array.from(touches.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStart.current = { dist, scale: scaleRef.current };
        panStart.current = null;
      } else if (touches.current.size === 1 && scaleRef.current > 1) {
        const t = e.changedTouches[0];
        panStart.current = { x: t.clientX, y: t.clientY, tx: txRef.current, ty: tyRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      Array.from(e.changedTouches).forEach((t) => {
        touches.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      });
      if (touches.current.size === 2 && pinchStart.current) {
        const [a, b] = Array.from(touches.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const next = pinchStart.current.scale * (dist / pinchStart.current.dist);
        const rect = el.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        applyScale(next, cx, cy);
      } else if (touches.current.size === 1 && panStart.current) {
        const t = e.changedTouches[0];
        txRef.current = panStart.current.tx + (t.clientX - panStart.current.x);
        tyRef.current = panStart.current.ty + (t.clientY - panStart.current.y);
        setTx(txRef.current);
        setTy(tyRef.current);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      Array.from(e.changedTouches).forEach((t) => {
        touches.current.delete(t.identifier);
      });
      if (touches.current.size < 2) pinchStart.current = null;
      if (touches.current.size === 0) panStart.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      applyScale(scaleRef.current * (1 + -e.deltaY * 0.01), x, y);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
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
        style={{
          touchAction: "none",
          cursor: scale > 1 ? "grab" : "default",
        }}
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
          // PDF: iframeの上に透明オーバーレイを重ねてタッチを捕捉
          <div className="relative w-full h-full">
            <iframe
              src={src}
              title={alt}
              className="w-full h-full rounded-lg border-0"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: "center center",
                pointerEvents: scale > 1 ? "none" : "auto",
              }}
            />
            {/* タッチ捕捉用オーバーレイ (scale>1 or ピンチ操作中) */}
            <div
              className="absolute inset-0"
              style={{ pointerEvents: scale > 1 ? "auto" : "none" }}
            />
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
