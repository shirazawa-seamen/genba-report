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

// iframe 内部の描画サイズ（大きめにしてブラウザにPDFを高解像度で描画させる）
const PDF_IFRAME_W = 1200;
const PDF_IFRAME_H = 1600;

// ── PDF プレビュー ─────────────────────────────────────────────────────
// iframe を実際のコンテナより大きく描画し、CSS transform で縮小して
// PDF 全体が見えるようにする。ピンチ／ホイールでズーム可能。
function PdfPreview({ src, alt }: { src: string; alt: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);

  // コンテナサイズを監視
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerW(width);
      setContainerH(height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // コンテナに PDF 全体が収まる基本スケール
  const baseScale =
    containerW > 0
      ? Math.min(containerW / PDF_IFRAME_W, containerH / PDF_IFRAME_H)
      : 0.5;

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const applyZoom = useCallback(
    (next: number, originX?: number, originY?: number) => {
      const el = wrapRef.current;
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
    [],
  );

  // タッチ＋ホイール
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let pinchInitDist = 0;
    let pinchInitScale = 1;
    let panActive = false;
    let panStartX = 0,
      panStartY = 0,
      panStartTx = 0,
      panStartTy = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0],
          b = e.touches[1];
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
      if (e.touches.length === 2 && pinchInitDist > 0) {
        e.preventDefault();
        const a = e.touches[0],
          b = e.touches[1];
        const rect = el.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - rect.left;
        const cy = (a.clientY + b.clientY) / 2 - rect.top;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        applyZoom(pinchInitScale * (dist / pinchInitDist), cx, cy);
      } else if (e.touches.length === 1 && panActive) {
        e.preventDefault();
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
      applyZoom(
        scaleRef.current * (1 + -e.deltaY * 0.01),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [applyZoom]);

  const reset = () => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    setScale(1);
    setTx(0);
    setTy(0);
  };

  // 最終的な CSS transform: baseScale でコンテナにフィット → scale でユーザーズーム
  const finalScale = baseScale * scale;

  return (
    <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={wrapRef}
        className="w-full h-full flex items-start justify-center select-none"
        style={{ touchAction: "none" }}
      >
        <iframe
          src={src}
          title={alt}
          style={{
            width: PDF_IFRAME_W,
            height: PDF_IFRAME_H,
            border: "none",
            transformOrigin: "top center",
            transform: `translate(${tx}px, ${ty}px) scale(${finalScale})`,
            pointerEvents: scale > 1 ? "none" : "auto",
          }}
        />
      </div>

      {/* ズームコントロール */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow px-1 py-1">
        <button
          type="button"
          onClick={() => applyZoom(scaleRef.current - 0.25)}
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
          onClick={() => applyZoom(scaleRef.current + 0.25)}
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

      {/* 外部で開くリンク */}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
      >
        <ExternalLink size={13} />
        外部で開く
      </a>
    </div>
  );
}

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

  useEffect(() => {
    reset();
  }, [src, reset]);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

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
    [],
  );

  // 画像のみ: TouchEvent ベースのピンチズーム + パン + ホイールズーム
  // GestureEvent（WebKit非標準）は使わない — TouchEvent だけで統一
  useEffect(() => {
    if (kind !== "image") return;
    const el = containerRef.current;
    if (!el) return;

    let pinchInitDist = 0;
    let pinchInitScale = 1;
    let pinchCX = 0;
    let pinchCY = 0;
    let panActive = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTx = 0;
    let panStartTy = 0;

    // touchstart — passive: true（preventDefault しない）
    // iOS Safari で preventDefault すると後続のタッチイベントが正しく発火しなくなる
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0],
          b = e.touches[1];
        const rect = el.getBoundingClientRect();
        pinchCX = (a.clientX + b.clientX) / 2 - rect.left;
        pinchCY = (a.clientY + b.clientY) / 2 - rect.top;
        pinchInitDist = Math.hypot(
          a.clientX - b.clientX,
          a.clientY - b.clientY,
        );
        pinchInitScale = scaleRef.current;
        panActive = false;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        panActive = true;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        panStartTx = txRef.current;
        panStartTy = tyRef.current;
      } else {
        panActive = false;
      }
    };

    // touchmove — passive: false（ピンチ/パン中のみ preventDefault）
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchInitDist > 0) {
        e.preventDefault();
        const a = e.touches[0],
          b = e.touches[1];
        const rect = el.getBoundingClientRect();
        pinchCX = (a.clientX + b.clientX) / 2 - rect.left;
        pinchCY = (a.clientY + b.clientY) / 2 - rect.top;
        const dist = Math.hypot(
          a.clientX - b.clientX,
          a.clientY - b.clientY,
        );
        applyScale(
          pinchInitScale * (dist / pinchInitDist),
          pinchCX,
          pinchCY,
        );
      } else if (e.touches.length === 1 && panActive) {
        e.preventDefault();
        txRef.current =
          panStartTx + (e.touches[0].clientX - panStartX);
        tyRef.current =
          panStartTy + (e.touches[0].clientY - panStartY);
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

    const onTouchCancel = () => {
      panActive = false;
      pinchInitDist = 0;
    };

    // デスクトップ: ホイールズーム
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyScale(
        scaleRef.current * (1 + -e.deltaY * 0.01),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };

    // touchstart/touchend は passive: true — preventDefault しない
    // touchmove のみ passive: false — ピンチ/パン中にスクロールを止めるため
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("wheel", onWheel);
    };
  }, [kind, applyScale]);

  const onDoubleClick = (e: React.MouseEvent) => {
    if (kind !== "image") return;
    const rect = containerRef.current?.getBoundingClientRect();
    applyScale(
      scaleRef.current > 1 ? 1 : 2,
      rect ? e.clientX - rect.left : undefined,
      rect ? e.clientY - rect.top : undefined,
    );
  };

  // ── PDF ──────────────────────────────────────────────────────────────
  // iOS Safari の iframe 内 PDF は初期ズームを制御できないため、
  // iframe を大きく描画して CSS transform で縮小し全体を見せる。
  // ピンチズームは画像と同じ TouchEvent ベースのカスタム実装。
  if (kind === "pdf") {
    return (
      <PdfPreview src={src} alt={alt} />
    );
  }

  // ── 画像 ──────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center select-none"
        style={{ touchAction: "none", cursor: scale > 1 ? "grab" : "default" }}
        onDoubleClick={onDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
