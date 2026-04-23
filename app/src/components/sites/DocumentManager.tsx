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
  Camera,
  FolderOpen,
  Folder,
  ChevronRight,
  Home,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  getSiteDocuments,
  getUploadUrl,
  createSiteDocument,
  deleteSiteDocument,
  getDownloadUrl,
} from "@/app/(dashboard)/sites/actions";
import { getSiteRootFolderId, getSiteDocumentFolderId } from "@/app/(dashboard)/storage/actions";
import { ZoomablePreview } from "@/components/storage/ZoomablePreview";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTIONS, PHOTO_TYPE_LABELS } from "@/lib/constants";
import type { DocumentType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Process 型（親子構造）
// ---------------------------------------------------------------------------
export interface ProcessInfo {
  id: string;
  name: string;
  parent_process_id: string | null;
  category: string;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------
function getDocumentIcon(type: string) {
  switch (type) {
    case "blueprint":
      return FileSpreadsheet;
    case "specification":
      return FileText;
    case "purchase_order":
    case "contract":
      return FileCheck;
    case "schedule":
      return CalendarRange;
    case "site_survey_photo":
      return Camera;
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

function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(fileName);
}

// ---------------------------------------------------------------------------
// Document型（サーバーから返る拡張版）
// ---------------------------------------------------------------------------
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
  folder_path: string | null;
  process_id: string | null;
  photo_type: string | null;
  uploaded_by: string;
  uploader_name: string | null;
}

// ---------------------------------------------------------------------------
// フォルダ構造を計算
// ---------------------------------------------------------------------------
interface FolderNode {
  name: string;
  path: string;
  fileCount: number;
}

function computeFolders(documents: Document[], currentPath: string): FolderNode[] {
  const prefix = currentPath ? currentPath + "/" : "";
  const folderMap = new Map<string, number>();

  for (const doc of documents) {
    const fp = doc.folder_path ?? "";
    if (!fp.startsWith(prefix)) continue;
    const rest = fp.slice(prefix.length);
    if (!rest) continue; // 現在のフォルダ直下のファイル
    const nextSegment = rest.split("/")[0];
    const fullPath = prefix + nextSegment;
    folderMap.set(fullPath, (folderMap.get(fullPath) ?? 0) + 1);
  }

  // 現在のパス直下にファイルがあるフォルダのみ表示（再帰的にカウント）
  const result: FolderNode[] = [];
  for (const [path, _] of folderMap) {
    const name = path.split("/").pop() ?? path;
    // このフォルダ配下の全ファイル数
    const count = documents.filter((d) => (d.folder_path ?? "").startsWith(path)).length;
    result.push({ name, path, fileCount: count });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function getFilesInFolder(documents: Document[], folderPath: string): Document[] {
  return documents.filter((d) => (d.folder_path ?? "") === folderPath);
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
interface DocumentManagerProps {
  siteId: string;
  canManage?: boolean;
  canDelete?: boolean;
  processes?: ProcessInfo[];
}

export function DocumentManager({
  siteId,
  canManage = false,
  canDelete = false,
  processes = [],
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [documentFolderId, setDocumentFolderId] = useState<string | undefined>(undefined);

  const fetchDocuments = useCallback(async () => {
    setFetchError(null);
    const result = await getSiteDocuments(siteId);
    if (result.success && result.documents) {
      setDocuments(result.documents as Document[]);
    } else {
      setFetchError(result.error || "ファイルの取得に失敗しました");
    }
    setIsLoading(false);
  }, [siteId]);

  const saveFile = useCallback(async (url: string, fileName: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: fileName, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
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
      window.open(url, "_blank");
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
    void getSiteRootFolderId(siteId).then((res) => {
      if (res.success && res.folderId) setRootFolderId(res.folderId);
    });
    void getSiteDocumentFolderId(siteId).then((res) => {
      if (res.success && res.folderId) setDocumentFolderId(res.folderId);
    });
  }, [fetchDocuments, siteId]);

  // フォルダ構造
  const folders = computeFolders(documents, currentPath);
  const filesHere = getFilesInFolder(documents, currentPath);
  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-[#0EA5E9]" />
          <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
            ストレージ
          </h2>
          {rootFolderId && (
            <Link
              href={`/storage/${rootFolderId}`}
              className="text-[12px] text-sky-500 hover:text-sky-600 hover:underline ml-2"
            >
              ストレージで開く →
            </Link>
          )}
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

      {/* パンくずリスト */}
      {currentPath && (
        <div className="flex items-center gap-1 mb-3 text-[12px] flex-wrap">
          <button
            onClick={() => setCurrentPath("")}
            className="text-[#0EA5E9] hover:underline flex items-center gap-0.5"
          >
            <Home size={12} />
            ストレージ
          </button>
          {breadcrumbs.map((segment, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-gray-300" />
                {isLast ? (
                  <span className="text-gray-700 font-medium">{segment}</span>
                ) : (
                  <button
                    onClick={() => setCurrentPath(path)}
                    className="text-[#0EA5E9] hover:underline"
                  >
                    {segment}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

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
      ) : folders.length === 0 && filesHere.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-300">
          <File size={32} className="mb-2 text-gray-200" />
          <p className="text-[13px]">
            {currentPath ? "このフォルダは空です" : "ファイルがありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* フォルダ一覧 */}
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => setCurrentPath(folder.path)}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left hover:border-[#0EA5E9]/30 hover:bg-[#0EA5E9]/5 transition-colors group"
                >
                  <Folder size={20} className="text-[#0EA5E9]/60 group-hover:text-[#0EA5E9] transition-colors shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-gray-700 truncate">{folder.name}</p>
                    <p className="text-[10px] text-gray-400">{folder.fileCount}件</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ファイル一覧 */}
          {filesHere.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {filesHere.map((doc) => {
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
                      {/* 削除ボタン */}
                      {canDelete && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("このファイルを削除しますか？")) {
                              setIsLoading(true);
                              await deleteSiteDocument(doc.id, siteId);
                              await fetchDocuments();
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
                      {/* アップロード者タグ */}
                      {doc.uploader_name && (
                        <span className="inline-block mt-0.5 text-[9px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 truncate max-w-full">
                          {doc.uploader_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canManage && showUploadModal && (
        <UploadModal
          siteId={siteId}
          currentPath={currentPath}
          processes={processes}
          documentFolderId={documentFolderId}
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

// ---------------------------------------------------------------------------
// アップロードモーダル
// ---------------------------------------------------------------------------
interface UploadModalProps {
  siteId: string;
  currentPath: string;
  processes: ProcessInfo[];
  documentFolderId?: string;
  onClose: () => void;
}

type UploadMode = "document" | "photo";

type FileEntry = {
  file: File;
  documentType: DocumentType;
  processId?: string;
  photoType?: string;
};

function UploadModal({ siteId, currentPath, processes, documentFolderId, onClose }: UploadModalProps) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [defaultType, setDefaultType] = useState<DocumentType>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // アップロードモード: 工程フォルダにいる場合はphoto、それ以外はdocument
  const isInProcessFolder = currentPath && !currentPath.startsWith("書類");
  const [uploadMode, setUploadMode] = useState<UploadMode>(isInProcessFolder ? "photo" : "document");

  // 工程写真用のデフォルト値
  const childProcesses = processes.filter((p) => p.parent_process_id);
  const [defaultProcessId, setDefaultProcessId] = useState<string>("");
  const [defaultPhotoType, setDefaultPhotoType] = useState<string>("during");

  // currentPathから工程とフェーズを推定
  useEffect(() => {
    if (!currentPath || currentPath.startsWith("書類")) return;
    const segments = currentPath.split("/");
    // パスが {親工程}/{小項目}/{フェーズ} の形式か確認
    if (segments.length >= 2) {
      const parentName = segments[0];
      const childName = segments[1];
      const matched = childProcesses.find((p) => {
        const parent = processes.find((pp) => pp.id === p.parent_process_id);
        return parent?.name === parentName && p.name === childName;
      });
      if (matched) setDefaultProcessId(matched.id);
    }
    if (segments.length >= 3) {
      const phaseName = segments[2];
      const phaseEntry = Object.entries(PHOTO_TYPE_LABELS).find(([, v]) => v === phaseName);
      if (phaseEntry) setDefaultPhotoType(phaseEntry[0]);
    }
  }, [currentPath, childProcesses, processes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > 0) {
      const newEntries = selectedFiles.map((file) => ({
        file,
        documentType: uploadMode === "photo" ? "site_survey_photo" as DocumentType : defaultType,
        processId: uploadMode === "photo" ? defaultProcessId : undefined,
        photoType: uploadMode === "photo" ? defaultPhotoType : undefined,
      }));
      setEntries((prev) => [...prev, ...newEntries]);
      if (!title && selectedFiles.length === 1 && entries.length === 0) {
        setTitle(selectedFiles[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
    e.target.value = "";
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntryType = (index: number, type: DocumentType) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, documentType: type } : e));
  };

  const computeFolderPath = (entry: FileEntry): string => {
    if (uploadMode === "photo" && entry.processId) {
      const proc = processes.find((p) => p.id === entry.processId);
      if (proc) {
        const parent = processes.find((p) => p.id === proc.parent_process_id);
        const parentName = parent?.name ?? proc.category;
        const phaseName = entry.photoType ? (PHOTO_TYPE_LABELS[entry.photoType] ?? entry.photoType) : "その他";
        return `${parentName}/${proc.name}/${phaseName}`;
      }
    }
    // 書類系
    const label = DOCUMENT_TYPE_LABELS[entry.documentType] || "その他";
    return `書類/${label}`;
  };

  const handleUpload = () => {
    if (entries.length === 0) {
      setError("ファイルを選択してください");
      return;
    }
    if (entries.length === 1 && uploadMode === "document" && !title.trim()) {
      setError("タイトルを入力してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        let uploadedCount = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const { file } = entry;
          setUploadProgress(`${i + 1}/${entries.length} アップロード中...`);

          const fileTitle = entries.length === 1 && uploadMode === "document"
            ? title.trim()
            : file.name.replace(/\.[^/.]+$/, "");

          const folderPath = computeFolderPath(entry);

          const uploadResult = await getUploadUrl(
            siteId,
            file.name,
            entry.documentType,
            entry.processId ? { processId: entry.processId, photoType: entry.photoType } : undefined
          );
          if (!uploadResult.success || !uploadResult.uploadUrl || !uploadResult.storagePath) {
            setError(`${file.name}: ${uploadResult.error || "URLの取得に失敗"}`);
            continue;
          }

          const uploadResponse = await fetch(uploadResult.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadResponse.ok) {
            setError(`${file.name}: アップロードに失敗`);
            continue;
          }

          const createResult = await createSiteDocument({
            siteId,
            documentType: entry.documentType,
            title: fileTitle,
            description: entries.length === 1 && uploadMode === "document" ? (description.trim() || undefined) : undefined,
            storagePath: uploadResult.storagePath,
            fileName: file.name,
            fileSize: file.size,
            folderPath,
            processId: entry.processId,
            photoType: entry.photoType,
            folderId: documentFolderId,
          });

          if (!createResult.success) {
            setError(`${file.name}: ${createResult.error || "登録に失敗"}`);
            continue;
          }

          uploadedCount++;
        }

        setUploadProgress("");
        if (uploadedCount > 0) {
          onClose();
        }
      } catch {
        setUploadProgress("");
        setError("アップロード中にエラーが発生しました");
      }
    });
  };

  // 工程グループ化（親 > 子）
  const groupedProcesses = (() => {
    const parents = processes.filter((p) => !p.parent_process_id);
    return parents.map((parent) => ({
      parent,
      children: processes.filter((p) => p.parent_process_id === parent.id),
    })).filter((g) => g.children.length > 0);
  })();

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-bold text-gray-900">ファイルをアップロード</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* アップロードモード切替 */}
          {childProcesses.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode("document")}
                className={`flex-1 rounded-xl px-3 py-2.5 text-[12px] font-medium border transition-colors ${
                  uploadMode === "document"
                    ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                }`}
              >
                <FileText size={14} className="inline mr-1" />
                書類
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("photo")}
                className={`flex-1 rounded-xl px-3 py-2.5 text-[12px] font-medium border transition-colors ${
                  uploadMode === "photo"
                    ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                }`}
              >
                <ImageIcon size={14} className="inline mr-1" />
                工程写真
              </button>
            </div>
          )}

          {/* 工程写真モードの場合: 工程+フェーズ選択 */}
          {uploadMode === "photo" && (
            <>
              <div>
                <label className="text-[13px] font-medium text-gray-500 mb-1.5 block">
                  工程（小項目）
                  <span className="ml-1 text-[#0EA5E9] text-xs">*</span>
                </label>
                <select
                  value={defaultProcessId}
                  onChange={(e) => {
                    setDefaultProcessId(e.target.value);
                    // 既存のエントリーも更新
                    setEntries((prev) => prev.map((entry) => ({ ...entry, processId: e.target.value })));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50"
                >
                  <option value="">工程を選択</option>
                  {groupedProcesses.map((group) => (
                    <optgroup key={group.parent.id} label={group.parent.name}>
                      {group.children.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-medium text-gray-500 mb-1.5 block">
                  施工フェーズ
                  <span className="ml-1 text-[#0EA5E9] text-xs">*</span>
                </label>
                <div className="flex gap-2">
                  {(["before", "during", "after"] as const).map((phase) => (
                    <button
                      key={phase}
                      type="button"
                      onClick={() => {
                        setDefaultPhotoType(phase);
                        setEntries((prev) => prev.map((entry) => ({ ...entry, photoType: phase })));
                      }}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-[12px] font-medium border transition-colors ${
                        defaultPhotoType === phase
                          ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]"
                          : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {PHOTO_TYPE_LABELS[phase]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ファイル選択 */}
          <div>
            <label className="text-[13px] font-medium text-gray-500 mb-1.5 block">
              ファイル
              <span className="ml-1 text-[#0EA5E9] text-xs">*</span>
              <span className="ml-2 text-[11px] text-gray-400 font-normal">複数選択可</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={uploadMode === "photo" ? "image/*,video/*" : undefined}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={[
                "w-full min-h-[48px] px-4 py-3 rounded-xl border transition-all duration-200 text-left text-[14px]",
                entries.length > 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                  : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300",
              ].join(" ")}
            >
              {entries.length > 0 ? `${entries.length}件のファイルを選択中` : "ファイルを選択（複数可）"}
            </button>
            {entries.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {entries.map((entry, i) => (
                  <div key={`${entry.file.name}-${i}`} className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-gray-600 truncate">{entry.file.name}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{formatFileSize(entry.file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeEntry(i)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {entries.length > 1 && uploadMode === "document" && (
                      <select
                        value={entry.documentType}
                        onChange={(e) => updateEntryType(i, e.target.value as DocumentType)}
                        className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50"
                      >
                        {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 書類モード: 種別・タイトル・説明 */}
          {uploadMode === "document" && (
            <>
              {entries.length <= 1 && (
                <Select
                  label="種別"
                  options={DOCUMENT_TYPE_OPTIONS}
                  value={entries.length === 1 ? entries[0].documentType : defaultType}
                  onChange={(e) => {
                    const type = e.target.value as DocumentType;
                    if (entries.length === 1) {
                      updateEntryType(0, type);
                    }
                    setDefaultType(type);
                  }}
                />
              )}

              {entries.length > 1 && (
                <div>
                  <label className="text-[11px] font-medium text-gray-400 mb-1 block">
                    次に追加するファイルのデフォルト種別
                  </label>
                  <select
                    value={defaultType}
                    onChange={(e) => setDefaultType(e.target.value as DocumentType)}
                    className="w-full min-h-[36px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50"
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {entries.length <= 1 && (
                <>
                  <Input
                    label="タイトル"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ファイルのタイトル"
                    required
                  />
                  <Textarea
                    label="説明（任意）"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="ファイルの説明や備考"
                    rows={2}
                  />
                </>
              )}

              {entries.length > 1 && (
                <p className="text-[11px] text-gray-400">
                  複数ファイルの場合、タイトルはファイル名から自動設定されます。
                </p>
              )}
            </>
          )}

          {error && (
            <p className="text-[13px] text-red-400 bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {uploadProgress && (
            <p className="text-[13px] text-[#0EA5E9] bg-cyan-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {uploadProgress}
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
              disabled={
                entries.length === 0 ||
                (entries.length === 1 && uploadMode === "document" && !title.trim()) ||
                (uploadMode === "photo" && !defaultProcessId)
              }
            >
              {entries.length > 1 ? `${entries.length}件アップロード` : "アップロード"}
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

// ---------------------------------------------------------------------------
// ファイルプレビューモーダル
// ---------------------------------------------------------------------------
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
  const kind = isPdf ? "pdf" : isImage ? "image" : "pdf";

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl max-h-[90vh] w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-[#0EA5E9] shrink-0" />
            <span className="text-sm font-semibold text-gray-900 truncate">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownload}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-[12px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <Download size={14} />
              ダウンロード
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4 bg-gray-50">
          <ZoomablePreview src={url} alt={title} kind={kind} />
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
