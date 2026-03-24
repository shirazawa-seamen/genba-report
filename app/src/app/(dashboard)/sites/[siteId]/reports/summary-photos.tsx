"use client";

import { useState, useTransition, useRef } from "react";
import { Camera, Video, X, Plus, ImageIcon } from "lucide-react";
import {
  uploadSummaryPhoto,
  deleteSummaryPhoto,
  getSummaryPhotos,
} from "./actions";

export interface SummaryPhotoItem {
  id: string;
  url: string;
  caption: string | null;
  mediaType: string;
  isFromReport: boolean;
}

export function SummaryPhotos({
  summaryId,
  siteId,
  initialPhotos,
  editable = true,
}: {
  summaryId: string | null;
  siteId: string;
  initialPhotos: SummaryPhotoItem[];
  editable?: boolean;
}) {
  const [photos, setPhotos] = useState<SummaryPhotoItem[]>(initialPhotos);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPhotos = async () => {
    if (!summaryId) return;
    const updated = await getSummaryPhotos(summaryId);
    setPhotos(updated);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !summaryId) return;

    setMessage(null);
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("summaryId", summaryId);
        formData.set("siteId", siteId);
        formData.set("file", file);
        const result = await uploadSummaryPhoto(formData);
        if (!result.success) {
          setMessage(result.error || "アップロードに失敗しました");
          return;
        }
      }
      await refreshPhotos();
      setMessage(null);
    });

    // inputをリセット
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (photoId: string) => {
    if (!window.confirm("この写真を削除しますか？")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSummaryPhoto(photoId, siteId);
      if (!result.success) {
        setMessage(result.error || "削除に失敗しました");
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    });
  };

  if (photos.length === 0 && !editable) return null;

  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-gray-500 flex items-center gap-1.5">
        <ImageIcon size={12} />
        写真・動画
        {photos.length > 0 && (
          <span className="text-[10px] text-gray-400">({photos.length})</span>
        )}
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {photos.map((photo) => {
            const isVideo = photo.mediaType === "video";
            return (
              <div
                key={photo.id}
                className="relative rounded-xl overflow-hidden border border-gray-200 group"
              >
                {isVideo ? (
                  <video
                    src={photo.url}
                    controls
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo.url}
                    alt={photo.caption || "写真"}
                    className="w-full aspect-square object-cover"
                  />
                )}

                {/* ラベル */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/50 to-transparent">
                  <span className="text-[9px] text-white flex items-center gap-0.5">
                    {isVideo ? <Video size={9} /> : <Camera size={9} />}
                    {photo.isFromReport ? "2次報告" : "追加"}
                  </span>
                </div>

                {/* 削除ボタン */}
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleDelete(photo.id)}
                    disabled={isPending}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editable && summaryId && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            <Plus size={12} />
            {isPending ? "アップロード中..." : "写真・動画を追加"}
          </button>
        </>
      )}

      {!summaryId && editable && (
        <p className="text-[10px] text-gray-400 italic">
          下書き保存後に写真を追加できます
        </p>
      )}

      {message && (
        <p className="mt-1 text-[11px] text-red-500">{message}</p>
      )}
    </div>
  );
}
