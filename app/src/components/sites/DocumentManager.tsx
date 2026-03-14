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
}

interface DocumentManagerProps {
  siteId: string;
  canManage?: boolean;
}

export function DocumentManager({ siteId, canManage = false }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const result = await getSiteDocuments(siteId);
    if (result.success && result.documents) {
      setDocuments(result.documents);
    }
    setIsLoading(false);
  }, [siteId]);

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

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-300">
          <File size={32} className="mb-2 text-gray-200" />
          <p className="text-[13px]">ドキュメントがありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = getDocumentIcon(doc.document_type);
            const isDownloading = downloadingId === doc.id;
            const isDeleting = uploadingDoc === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 min-h-[52px] py-2.5"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50">
                  <Icon size={16} className="text-[#0EA5E9]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-gray-700 truncate">
                      {doc.title}
                    </span>
                    <span className="text-[10px] font-medium text-[#0EA5E9] bg-cyan-50 px-1.5 py-0.5 rounded">
                      {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="truncate">{doc.file_name}</span>
                    <span className="text-gray-200">|</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="text-gray-200">|</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      setDownloadingId(doc.id);
                      const result = await getDownloadUrl(doc.storage_path);
                      if (result.success && result.url) {
                        window.open(result.url, "_blank");
                      }
                      setDownloadingId(null);
                    }}
                    disabled={isDownloading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                    title="ダウンロード"
                  >
                    {isDownloading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                  </button>
                  {canManage && (
                    <button
                      onClick={async () => {
                        if (confirm("このドキュメントを削除しますか？")) {
                          setIsLoading(true);
                          setUploadingDoc(doc.id);
                          await deleteSiteDocument(doc.id, siteId);
                          await fetchDocuments();
                          setUploadingDoc(null);
                        }
                      }}
                      disabled={isDeleting}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="削除"
                    >
                      {isDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
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
