"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Camera, Video, Download } from "lucide-react";

export interface PhotoItem {
  id: string;
  url: string;
  caption?: string | null;
  mediaType?: string | null;
  label?: string | null;
  badge?: string | null;
}

interface PhotoGalleryProps {
  photos: PhotoItem[];
  columns?: 2 | 3 | 4;
  aspect?: "square" | "4/3" | "16/10";
}

export function PhotoGallery({ photos, columns = 2, aspect = "4/3" }: PhotoGalleryProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const gridClass =
    columns === 4
      ? "grid-cols-4"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";

  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "16/10"
        ? "aspect-[16/10]"
        : "aspect-[4/3]";

  const imagePhotos = photos.filter((p) => p.mediaType !== "video");

  return (
    <>
      <div className={`grid ${gridClass} gap-2.5`}>
        {photos.map((p) => {
          const isVideo = p.mediaType === "video";
          return (
            <div
              key={p.id}
              className="relative rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
              onClick={() => !isVideo && setPreviewId(p.id)}
            >
              {isVideo ? (
                <video src={p.url} controls className={`w-full ${aspectClass} object-cover`} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.url} alt={p.caption || p.label || "写真"} className={`w-full ${aspectClass} object-cover`} />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-[11px] text-white flex items-center gap-1">
                  {isVideo ? <Video size={11} /> : <Camera size={11} />}
                  {p.label || (isVideo ? "動画" : "写真")}
                </span>
              </div>
              {p.badge && (
                <span className="absolute top-1 left-1 text-[8px] bg-black/40 text-white px-1 rounded">{p.badge}</span>
              )}
            </div>
          );
        })}
      </div>

      {previewId !== null && (
        <PhotoPreviewModal
          photos={imagePhotos}
          initialId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}

export function PhotoPreviewModal({
  photos,
  initialId,
  onClose,
}: {
  photos: PhotoItem[];
  initialId: string;
  onClose: () => void;
}) {
  const startIdx = Math.max(0, photos.findIndex((p) => p.id === initialId));
  const [currentIndex, setCurrentIndex] = useState(startIdx);
  const photo = photos[currentIndex];

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  const handleDownload = async () => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = photo.caption || `photo_${currentIndex + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(photo.url, "_blank");
    }
  };

  // Swipe support
  let touchStartX = 0;
  const onTouchStart = (e: React.TouchEvent) => { touchStartX = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goPrev(); else goNext();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/70 text-[13px]">
          {currentIndex + 1} / {photos.length}
          {photo.label && <span className="ml-2 text-white/50">{photo.label}</span>}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || ""}
          className="max-w-full max-h-full object-contain select-none"
          style={{ maxHeight: "calc(100dvh - 120px)" }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      {/* Navigation arrows (PC) */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Caption */}
      {photo.caption && (
        <div className="px-4 py-3 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <p className="text-white/80 text-[13px]">{photo.caption}</p>
        </div>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }
  return modal;
}
