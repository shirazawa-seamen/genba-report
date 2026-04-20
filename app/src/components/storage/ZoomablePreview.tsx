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

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => {
    reset();
  }, [src, reset]);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const applyScale = useCallback(
    (next: number, originX?: number, originY?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ox = (originX ?? rect.width / 2) - rect.width / 2;
      const oy = (originY ?? rect.height / 2) - rect.height / 2;
      setScale((prev) => {
        const clamped = clamp(next, MIN_SCALE, MAX_SCALE);
        const ratio = clamped / prev;
        setTx((t) => (t - ox) * ratio + ox);
        setTy((t) => (t - oy) * ratio + oy);
        if (clamped === 1) {
          setTx(0);
          setTy(0);
        }
        return clamped;
      });
    },
    []
  );

  const onWheel = (e: React.WheelEvent) => {
    if (kind !== "image") return;
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : undefined;
    const y = rect ? e.clientY - rect.top : undefined;
    applyScale(scale * (1 + delta), x, y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (kind !== "image") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStart.current = { dist, scale };
      panStart.current = null;
    } else if (pointers.current.size === 1 && scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (kind !== "image") return;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = pinchStart.current.scale * (dist / pinchStart.current.dist);
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? (a.x + b.x) / 2 - rect.left : undefined;
      const cy = rect ? (a.y + b.y) / 2 - rect.top : undefined;
      applyScale(next, cx, cy);
    } else if (pointers.current.size === 1 && panStart.current) {
      setTx(panStart.current.tx + (e.clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.clientY - panStart.current.y));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (kind !== "image") return;
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : undefined;
    const y = rect ? e.clientY - rect.top : undefined;
    applyScale(scale > 1 ? 1 : 2, x, y);
  };

  return (
    <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center select-none"
        style={{
          touchAction: kind === "image" ? "none" : "auto",
          cursor: kind === "image" && scale > 1 ? "grab" : "default",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
              transition: pointers.current.size === 0 ? "transform 0.1s" : "none",
            }}
          />
        ) : (
          <iframe
            src={src}
            title={alt}
            className="w-full h-full rounded-lg border-0"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        )}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow px-1 py-1">
        <button
          type="button"
          onClick={() => applyScale(scale - 0.25)}
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
          onClick={() => applyScale(scale + 0.25)}
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
