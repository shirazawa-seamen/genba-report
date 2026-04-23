"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface Props {
  src: string;
  alt: string;
  kind: "image" | "pdf";
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

// ── 共通: ピンチ／ホイールズーム + パンのフック ────────────────────────
function useZoomPan(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const reset = useCallback(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

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
    [containerRef],
  );

  // タッチ＋ホイールイベント登録
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let pinchInitDist = 0;
    let pinchInitScale = 1;
    let panActive = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTx = 0;
    let panStartTy = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0],
          b = e.touches[1];
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

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchInitDist > 0) {
        e.preventDefault();
        const a = e.touches[0],
          b = e.touches[1];
        const rect = el.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - rect.left;
        const cy = (a.clientY + b.clientY) / 2 - rect.top;
        const dist = Math.hypot(
          a.clientX - b.clientX,
          a.clientY - b.clientY,
        );
        applyScale(pinchInitScale * (dist / pinchInitDist), cx, cy);
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
      applyScale(
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
  }, [containerRef, applyScale]);

  return { scale, tx, ty, reset, applyScale, scaleRef };
}

// ── ズームコントロール UI ───────────────────────────────────────────
function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow px-1 py-1">
      <button
        type="button"
        onClick={onZoomOut}
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
        onClick={onZoomIn}
        className="p-1.5 hover:bg-gray-100 rounded-md"
        aria-label="拡大"
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="p-1.5 hover:bg-gray-100 rounded-md"
        aria-label="リセット"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

// ── PDF プレビュー（PDF.js で canvas 描画）──────────────────────────
function PdfPreview({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  const { scale, tx, ty, reset, applyScale, scaleRef } =
    useZoomPan(containerRef);

  // PDF.js を動的に読み込んでドキュメントをロード
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // PDF データを先に fetch（CORS 回避: ブラウザが署名付きURLを直接取得）
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        if (cancelled) return;

        const pdfjsLib = await import("pdfjs-dist");

        // Worker をローカルから読み込む（CDN 依存を排除）
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setError("PDFの読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // 指定ページを canvas に描画
  useEffect(() => {
    if (!pdfDocRef.current || pageNum < 1) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        // コンテナ幅に合わせてスケール
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const unscaledViewport = page.getViewport({ scale: 1 });

        // コンテナに収まるスケールを計算（devicePixelRatio で高解像度描画）
        const fitScale = Math.min(
          containerWidth / unscaledViewport.width,
          containerHeight / unscaledViewport.height,
        );
        const dpr = window.devicePixelRatio || 1;
        const renderScale = fitScale * dpr;
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // CSS サイズはフィットスケールで表示
        canvas.style.width = `${unscaledViewport.width * fitScale}px`;
        canvas.style.height = `${unscaledViewport.height * fitScale}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("PDF render error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNum, totalPages]);

  // ページ変更時にズームリセット
  useEffect(() => {
    reset();
  }, [pageNum, reset]);

  if (loading) {
    return (
      <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">{error}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700"
        >
          <ExternalLink size={14} />
          外部で開く
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[70vh] bg-gray-50 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center select-none"
        style={{ touchAction: "none", cursor: scale > 1 ? "grab" : "default" }}
      >
        <canvas
          ref={canvasRef}
          className="pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* ページ送り */}
      {totalPages > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg shadow px-2 py-1">
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="p-1 hover:bg-gray-100 rounded-md disabled:opacity-30"
            aria-label="前のページ"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-gray-700 tabular-nums">
            {pageNum} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
            disabled={pageNum >= totalPages}
            className="p-1 hover:bg-gray-100 rounded-md disabled:opacity-30"
            aria-label="次のページ"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ズームコントロール */}
      <ZoomControls
        scale={scale}
        onZoomIn={() => applyScale(scaleRef.current + 0.25)}
        onZoomOut={() => applyScale(scaleRef.current - 0.25)}
        onReset={reset}
      />

      {/* 外部で開く */}
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

// ── メインコンポーネント ─────────────────────────────────────────────
export function ZoomablePreview({ src, alt, kind }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scale, tx, ty, reset, applyScale, scaleRef } =
    useZoomPan(containerRef);

  useEffect(() => {
    reset();
  }, [src, reset]);

  const onDoubleClick = (e: React.MouseEvent) => {
    if (kind !== "image") return;
    const rect = containerRef.current?.getBoundingClientRect();
    applyScale(
      scaleRef.current > 1 ? 1 : 2,
      rect ? e.clientX - rect.left : undefined,
      rect ? e.clientY - rect.top : undefined,
    );
  };

  // ── PDF ──
  if (kind === "pdf") {
    return <PdfPreview src={src} alt={alt} />;
  }

  // ── 画像 ──
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

      <ZoomControls
        scale={scale}
        onZoomIn={() => applyScale(scaleRef.current + 0.25)}
        onZoomOut={() => applyScale(scaleRef.current - 0.25)}
        onReset={reset}
      />
    </div>
  );
}
