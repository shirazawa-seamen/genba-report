"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReport, deleteReportPhoto, updatePhotoCaption, updatePhotoType, addReportPhoto } from "./actions";
import { submitDraftReport } from "@/app/(dashboard)/reports/new/actions";
import {
  Loader2, Save, Send, AlertTriangle, Camera, Trash2, ImagePlus, X, Video, Edit3, Check,
} from "lucide-react";

interface ExistingPhoto {
  id: string;
  url: string;
  storagePath: string;
  photoType: string;
  caption: string;
  mediaType: string;
  processId: string | null;
}

// ローカルで管理する写真の変更状態
interface PhotoState {
  id: string;
  url: string;           // 表示用URL（既存=signed URL、新規=blob URL）
  photoType: string;
  caption: string;
  mediaType: string;
  isNew: boolean;        // 新規追加か
  isDeleted: boolean;    // 削除フラグ
  file?: File;           // 新規追加の場合のファイル
  originalPhotoType?: string;  // 変更検出用
  originalCaption?: string;    // 変更検出用
}

const PHOTO_TYPE_OPTIONS = [
  { value: "before", label: "施工前" },
  { value: "during", label: "施工中" },
  { value: "after", label: "施工後" },
];

interface ReportEditFormProps {
  reportId: string;
  isDraft?: boolean;
  siblingIds?: string[];
  existingPhotos?: ExistingPhoto[];
  initialData: {
    work_content: string;
    workers: string;
    progress_rate: number;
    weather: string;
    arrival_time?: string;
    departure_time?: string;
    issues: string;
    admin_notes: string;
  };
}

export function ReportEditForm({ reportId, isDraft, siblingIds, existingPhotos = [], initialData }: ReportEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 写真をローカルステートで管理
  const [photos, setPhotos] = useState<PhotoState[]>(
    existingPhotos.map((p) => ({
      id: p.id,
      url: p.url,
      photoType: p.photoType,
      caption: p.caption,
      mediaType: p.mediaType,
      isNew: false,
      isDeleted: false,
      originalPhotoType: p.photoType,
      originalCaption: p.caption,
    }))
  );

  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  // 表示する写真（削除フラグがないもの）
  const visiblePhotos = photos.filter((p) => !p.isDeleted);

  // 写真の変更があるか
  const hasPhotoChanges = photos.some(
    (p) => p.isNew || p.isDeleted || p.photoType !== p.originalPhotoType || p.caption !== p.originalCaption
  );

  // 写真をローカルに追加（まだサーバーには送らない）
  const handleAddPhotos = (fileList: FileList) => {
    const newPhotos: PhotoState[] = Array.from(fileList).map((file) => ({
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: URL.createObjectURL(file),
      photoType: "during",
      caption: "",
      mediaType: file.type.startsWith("video/") ? "video" : "photo",
      isNew: true,
      isDeleted: false,
      file,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  // 写真を削除フラグで管理（まだサーバーには反映しない）
  const handleDeletePhoto = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, isDeleted: true } : p))
    );
  };

  // 種別変更（ローカルのみ）
  const handleTypeChange = (photoId: string, newType: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, photoType: newType } : p))
    );
  };

  // キャプション編集
  const startEditCaption = (photo: PhotoState) => {
    setEditingCaptionId(photo.id);
    setCaptionDraft(photo.caption);
  };

  const saveCaption = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption: captionDraft } : p))
    );
    setEditingCaptionId(null);
  };

  // 写真の変更をサーバーに一括反映
  const commitPhotoChanges = async (): Promise<boolean> => {
    // 1. 削除（既存写真のみ）
    const toDelete = photos.filter((p) => p.isDeleted && !p.isNew);
    for (const photo of toDelete) {
      const result = await deleteReportPhoto(photo.id);
      if (!result.success) {
        setError(`写真削除エラー: ${result.error}`);
        return false;
      }
    }

    // 2. 新規追加
    const toAdd = photos.filter((p) => p.isNew && !p.isDeleted && p.file);
    for (const photo of toAdd) {
      const formData = new FormData();
      formData.set("photo", photo.file!);
      formData.set("photoType", photo.photoType);
      formData.set("caption", photo.caption);
      const result = await addReportPhoto(reportId, formData);
      if (!result.success) {
        setError(`写真追加エラー: ${result.error}`);
        return false;
      }
    }

    // 3. 種別・キャプション変更（既存写真のみ）
    const toUpdate = photos.filter(
      (p) => !p.isNew && !p.isDeleted && (p.photoType !== p.originalPhotoType || p.caption !== p.originalCaption)
    );
    for (const photo of toUpdate) {
      if (photo.photoType !== photo.originalPhotoType) {
        const result = await updatePhotoType(photo.id, photo.photoType);
        if (!result.success) {
          setError(`種別更新エラー: ${result.error}`);
          return false;
        }
      }
      if (photo.caption !== photo.originalCaption) {
        const result = await updatePhotoCaption(photo.id, photo.caption);
        if (!result.success) {
          setError(`キャプション更新エラー: ${result.error}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateReport(reportId, formData);
      if (!result.success) {
        setError(result.error || "更新に失敗しました");
        return;
      }
      // 写真の変更を反映
      if (hasPhotoChanges) {
        const photoResult = await commitPhotoChanges();
        if (!photoResult) return;
      }
      router.push(`/reports/${reportId}`);
    });
  };

  const handleSaveAndSubmit = async (event: React.MouseEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const form = (event.target as HTMLElement).closest("form");
      if (!form) return;
      const formData = new FormData(form);
      const saveResult = await updateReport(reportId, formData);
      if (!saveResult.success) {
        setError(saveResult.error || "保存に失敗しました");
        return;
      }
      // 写真の変更を反映
      if (hasPhotoChanges) {
        const photoResult = await commitPhotoChanges();
        if (!photoResult) return;
      }
      const ids = siblingIds && siblingIds.length > 0 ? siblingIds : [reportId];
      const submitResult = await submitDraftReport(ids);
      if (submitResult.success) {
        router.push(`/reports/${reportId}`);
      } else {
        setError(submitResult.error || "提出に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}

      {/* Work Content */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-500">
          作業内容 <span className="text-[#0EA5E9] text-xs">*</span>
        </label>
        <textarea
          name="work_content"
          required
          defaultValue={initialData.work_content}
          rows={5}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20 resize-none"
        />
      </div>

      {/* Progress & Weather */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">担当者見込み進捗 (%)</label>
          <input name="progress_rate" type="number" min="0" max="100" defaultValue={initialData.progress_rate} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">天候</label>
          <input name="weather" type="text" defaultValue={initialData.weather} placeholder="晴れ" className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20" />
        </div>
      </div>

      {/* Arrival / Departure Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">現場到着時間</label>
          <input name="arrival_time" type="time" defaultValue={initialData.arrival_time ?? ""} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">現場退出時間</label>
          <input name="departure_time" type="time" defaultValue={initialData.departure_time ?? ""} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20" />
        </div>
      </div>

      {/* Issues */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-500">課題・懸念事項</label>
        <textarea name="issues" defaultValue={initialData.issues} rows={3} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20 resize-none" />
      </div>

      {/* Photos Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-gray-400" />
            <label className="text-[13px] font-medium text-gray-500">
              写真・動画 ({visiblePhotos.length})
            </label>
            {hasPhotoChanges && (
              <span className="text-[11px] text-amber-500 bg-amber-50 rounded-full px-2 py-0.5">未保存の変更あり</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleAddPhotos(e.target.files);
                e.target.value = "";
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 min-h-[36px] text-[13px] font-medium text-[#0EA5E9] hover:bg-cyan-50 transition-colors"
          >
            <ImagePlus size={14} />
            写真を追加
          </button>
        </div>

        {visiblePhotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {visiblePhotos.map((photo) => (
              <div key={photo.id} className={`relative rounded-xl border bg-white overflow-hidden ${photo.isNew ? "border-cyan-300" : "border-gray-200"}`}>
                <div className="relative aspect-[4/3] bg-gray-100">
                  {photo.mediaType === "video" ? (
                    <div className="flex h-full items-center justify-center">
                      <Video size={32} className="text-gray-300" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.caption || "報告写真"} className="h-full w-full object-cover" />
                  )}
                  {photo.isNew && (
                    <span className="absolute top-2 left-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white">新規</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-2.5 space-y-2">
                  <select
                    value={photo.photoType}
                    onChange={(e) => handleTypeChange(photo.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50"
                  >
                    {PHOTO_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {editingCaptionId === photo.id ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        placeholder="キャプションを入力"
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-700 focus:outline-none focus:border-[#0EA5E9]/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveCaption(photo.id); }
                          if (e.key === "Escape") setEditingCaptionId(null);
                        }}
                      />
                      <button type="button" onClick={() => saveCaption(photo.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0EA5E9] text-white"><Check size={12} /></button>
                      <button type="button" onClick={() => setEditingCaptionId(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400"><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditCaption(photo)}
                      className="w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-gray-400 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      <Edit3 size={10} />
                      {photo.caption || "キャプションを追加"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 hover:border-cyan-300 hover:bg-cyan-50/30 transition-colors"
          >
            <ImagePlus size={24} className="text-gray-300" />
            <p className="text-[13px] text-gray-400">写真・動画をタップして追加</p>
          </div>
        )}
      </div>

      {/* Admin Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-amber-400/80">管理者メモ</label>
        <textarea name="admin_notes" defaultValue={initialData.admin_notes} rows={3} placeholder="管理者のみ編集可能なメモ欄" className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 resize-none" />
      </div>

      {/* Submit */}
      <div className="flex flex-col gap-3 pt-2">
        {isDraft && (
          <button
            type="button"
            onClick={handleSaveAndSubmit}
            disabled={isPending || isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[48px] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16} />保存して提出</>}
          </button>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 min-h-[48px] px-4 text-[14px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isPending || isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[48px] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16} />{isDraft ? "下書き保存" : "保存する"}</>}
          </button>
        </div>
      </div>
    </form>
  );
}
