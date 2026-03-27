"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  X,
  Loader2,
  File,
  FileSpreadsheet,
  FileCheck,
  CalendarRange,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSiteDocuments,
  getUploadUrl,
  createSiteDocument,
  deleteSiteDocument,
  getDownloadUrl,
} from "@/app/(dashboard)/sites/actions";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTIONS } from "@/lib/constants";
import type { DocumentType } from "@/lib/types";

function getDocumentIcon(type: string) {
  switch (type) {
    case "blueprint":
      return FileSpreadsheet;
    case "specification":
      return FileText;
    case "purchase_order":
      return FileCheck;
    case "schedule":
      return CalendarRange;
    default:
      return Package;
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Document {
  id: string;
  document_type: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  version: number;
  created_at: string;
  thumbnail_url: string | null;
}

interface DocumentManagerProps {
  siteId: string;
  canManage?: boolean;
}

function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(fileName);
}

export function DocumentManager({ siteId, canManage = false }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setFetchError(null);
    const result = await getSiteDocuments(siteId);
    if (result.success && result.documents) {
      setDocuments(result.documents);
    } else {
      setFetchError(result.error || "ドキュメントの取得に失敗しました");
    }
    setIsLoading(false);
  }, [siteId]);

  const saveFile = useCallback(async (url: string, fileName: string) => {
    // モバイル: Web Share APIでOS共有シート（写真に保存/ファイルに保存 選択可能）
    if (navigator.share) {
      try {
        await navigator.share({ title: fileName, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    // フォールバック: blob経由で<a download>
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 最終フォールバック
      window.open(url, "_blank");
    }
  }, []);

  const triggerDownload = useCallback(async (storagePath: string, fileName: string) => {
    setActionError(null);
    const result = await getDownloadUrl(storagePath);
    if (!result.success || !result.url) {
      setActionError(result.error || "ダウンロードURLの取得に失敗しました");
      return;
    }
    await saveFile(result.url, fileName);
  }, [saveFile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[#0EA5E9]" />
          <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
            ドキュメント管理
          </h2>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={16} />
            アップロード
          </Button>
        )}
      </div>

      {actionError && (
        <p className="text-[13px] text-red-400 bg-red-50 rounded-xl px-4 py-2.5 mb-3">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-8 text-red-400">
          <p className="text-[13px] mb-2">{fetchError}</p>
          <Button size="sm" variant="outline" onClick={() => { setIsLoading(true); void fetchDocuments(); }}>
            再読み込み
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-300">
          <File size={32} className="mb-2 text-gray-200" />
          <p className="text-[13px]">ドキュメントがありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {documents.map((doc) => {
            const Icon = getDocumentIcon(doc.document_type);
            const isLoaded = previewLoading === doc.id;
            const hasThumb = isImageFile(doc.file_name) && doc.thumbnail_url;

            return (
              <div
                key={doc.id}
                className="relative rounded-xl border border-gray-200 bg-white overflow-hidden cursor-pointer hover:border-gray-300 transition-colors group"
                onClick={async () => {
                  if (previewLoading) return;
                  setActionError(null);
                  setPreviewLoading(doc.id);
                  const result = await getDownloadUrl(doc.storage_path);
                  if (result.success && result.url) {
                    setPreviewTitle(doc.title);
                    setPreviewFileName(doc.file_name);
                    setPreviewUrl(result.url);
                  } else {
                    setActionError(result.error || "プレビューの取得に失敗しました");
                  }
                  setPreviewLoading(null);
                }}
              >
                {/* サムネイル */}
                <div className="aspect-square flex items-center justify-center bg-gray-50 relative">
                  {hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.thumbnail_url!}
                      alt={doc.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon size={28} className="text-gray-300" />
                  )}
                  {isLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  {/* 削除ボタン（管理者のみ） */}
                  {canManage && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("このドキュメントを削除しますか？")) {
                          setIsLoading(true);
                          setUploadingDoc(doc.id);
                          await deleteSiteDocument(doc.id, siteId);
                          await fetchDocuments();
                          setUploadingDoc(null);
                        }
                      }}
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* ラベル */}
                <div className="px-2 py-1.5">
                  <p className="text-[11px] font-medium text-gray-700 truncate">{doc.title}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && showUploadModal && (
        <UploadModal
          siteId={siteId}
          onClose={async () => {
            setIsLoading(true);
            setShowUploadModal(false);
            await fetchDocuments();
          }}
        />
      )}

      {previewUrl && (
        <FilePreviewModal
          url={previewUrl}
          title={previewTitle}
          fileName={previewFileName}
          onClose={() => {
            setPreviewUrl(null);
            setPreviewTitle("");
            setPreviewFileName("");
          }}
          onDownload={async () => {
            await saveFile(previewUrl, previewFileName || previewTitle || "document");
          }}
        />
      )}
    </div>
  );
}

interface UploadModalProps {
  siteId: string;
  onClose: () => void;
}

function UploadModal({ siteId, onClose }: UploadModalProps) {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = () => {
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const uploadResult = await getUploadUrl(siteId, file.name, documentType);
        if (!uploadResult.success || !uploadResult.uploadUrl || !uploadResult.storagePath) {
          setError(uploadResult.error || "アップロードURLの取得に失敗しました");
          return;
        }

        const uploadResponse = await fetch(uploadResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          setError("ファイルのアップロードに失敗しました");
          return;
        }

        const createResult = await createSiteDocument({
          siteId,
          documentType,
          title: title.trim(),
          description: description.trim() || undefined,
          storagePath: uploadResult.storagePath,
          fileName: file.name,
          fileSize: file.size,
        });

        if (!createResult.success) {
          setError(createResult.error || "ドキュメントの登録に失敗しました");
          return;
        }

        onClose();
      } catch (err) {
        setError("アップロード中にエラーが発生しました");
      }
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-bold text-gray-900">ドキュメントをアップロード</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-gray-500 mb-1.5 block">
              ファイル
              <span className="ml-1 text-[#0EA5E9] text-xs">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={[
                "w-full min-h-[48px] px-4 py-3 rounded-xl border transition-all duration-200 text-left text-[14px]",
                file
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                  : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300",
              ].join(" ")}
            >
              {file ? file.name : "ファイルを選択"}
            </button>
          </div>

          <Select
            label="種別"
            options={DOCUMENT_TYPE_OPTIONS}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          />

          <Input
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ドキュメントのタイトル"
            required
          />

          <Textarea
            label="説明（任意）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ドキュメントの説明や備考"
            rows={2}
          />

          {error && (
            <p className="text-[13px] text-red-400 bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleUpload}
              loading={isPending}
              disabled={!file || !title.trim()}
            >
              アップロード
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

interface FilePreviewModalProps {
  url: string;
  title: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

function FilePreviewModal({ url, title, fileName, onClose, onDownload }: FilePreviewModalProps) {
  const isPdf = isPdfFile(fileName);
  const isImage = isImageFile(fileName);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/60"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {isImage ? (
        <>
          {/* 画像: 右上にオーバーレイボタン */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <button
              onClick={onDownload}
              className="flex h-9 items-center gap-1.5 rounded-full bg-black/50 px-3 text-[12px] font-medium text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
            >
              <Download size={14} />
              保存
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center justify-center w-full h-full p-4 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              className="object-contain rounded-lg"
              style={{ maxWidth: "90vw", maxHeight: "calc(100dvh - 60px)" }}
            />
          </div>
        </>
      ) : (
        <>
          {/* PDF/その他: ヘッダーバー */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} className="text-[#0EA5E9] shrink-0" />
              <span className="text-[14px] font-semibold text-gray-800 truncate">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onDownload}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-[12px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Download size={14} />
                ダウンロード
              </button>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {isPdf ? (
              <iframe
                src={`${url}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title={`プレビュー: ${title}`}
              />
            ) : (
              <iframe
                src={url}
                className="w-full h-full border-0 bg-white"
                title={`プレビュー: ${title}`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
