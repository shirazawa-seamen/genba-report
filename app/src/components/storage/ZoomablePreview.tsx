"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink } from "lucide-react";

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

  // ── iOS PWA 対応: user-scalable=no はピンチイベントをOSレベルでブロックするため
  //    プレビュー表示中だけ viewport meta を切り替えてイベントをJSに届ける ──
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const original = meta?.getAttribute("content") ?? "";
    if (meta) {
      meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
    }
    return () => {
      if (meta && original) meta.setAttribute("content", original);
    };
  }, []);

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

    let usingGestureAPI = false;
    let pinchInitScale = 1;
    let pinchInitDist = 0;
    let pinchCX = 0;
    let pinchCY = 0;
    let panActive = false;
    let panStartX = 0, panStartY = 0;
    let panStartTx = 0, panStartTy = 0;

    // iOS Safari / WKWebView: WebKit 独自の GestureEvent
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      usingGestureAPI = true;
      pinchInitScale = scaleRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyScale(pinchInitScale * (e as any).scale, pinchCX, pinchCY);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      usingGestureAPI = false;
    };

    // TouchEvent: pinch center 追跡 + Android/非iOS ピンチ計算
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        const rect = el.getBoundingClientRect();
        pinchCX = (a.clientX + b.clientX) / 2 - rect.left;
        pinchCY = (a.clientY + b.clientY) / 2 - rect.top;
        pinchInitDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchInitScale = scaleRef.current;
        panActive = false;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        panActive = true;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        panStartTx = txRef.current;
        panStartTy = tyRef.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        const rect = el.getBoundingClientRect();
        pinchCX = (a.clientX + b.clientX) / 2 - rect.left;
        pinchCY = (a.clientY + b.clientY) / 2 - rect.top;
        if (!usingGestureAPI && pinchInitDist > 0) {
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          applyScale(pinchInitScale * (dist / pinchInitDist), pinchCX, pinchCY);
        }
      } else if (e.touches.length === 1 && panActive) {
        txRef.current = panStartTx + (e.touches[0].clientX - panStartX);
        tyRef.current = panStartTy + (e.touches[0].clientY - panStartY);
        setTx(txRef.current);
        setTy(tyRef.current);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1 && scaleRef.current > 1) {
        panActive = true;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        panStartTx = txRef.current;
        panStartTy = tyRef.current;
        pinchInitDist = 0;
      } else if (e.touches.length === 0) {
        panActive = false;
        pinchInitDist = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyScale(scaleRef.current * (1 + -e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    };

    el.addEventListener("gesturestart", onGestureStart, { passive: false });
    el.addEventListener("gesturechange", onGestureChange, { passive: false });
    el.addEventListener("gestureend", onGestureEnd, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [applyScale]);

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    applyScale(scaleRef.current > 1 ? 1 : 2, rect ? e.clientX - rect.left : undefined, rect ? e.clientY - rect.top : undefined);
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
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "center center" }}
          />
        ) : (
          // PDF: iframeのネイティブレンダラーがタッチを横取りするためオーバーレイで捕捉
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
            <div className="absolute inset-0" style={{ touchAction: "none" }} />
          </div>
        )}
      </div>

      {/* ズームコントロール */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow px-1 py-1">
        <button type="button" onClick={() => applyScale(scaleRef.current - 0.25)} className="p-1.5 hover:bg-gray-100 rounded-md" aria-label="縮小">
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-700 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => applyScale(scaleRef.current + 0.25)} className="p-1.5 hover:bg-gray-100 rounded-md" aria-label="拡大">
          <ZoomIn size={16} />
        </button>
        <button type="button" onClick={reset} className="p-1.5 hover:bg-gray-100 rounded-md" aria-label="リセット">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* PDF: 外部ビューアで開くボタン（iOS ネイティブPDFビューアはピンチズーム対応） */}
      {kind === "pdf" && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          <ExternalLink size={13} />
          外部で開く
        </a>
      )}
    </div>
  );
}
