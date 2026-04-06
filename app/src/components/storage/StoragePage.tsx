"use client";

import React, { useState, useRef, useTransition, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Folder,
  ChevronRight,
  Home,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  Plus,
  X,
  Loader2,
  Eye,
  Building2,
  Globe,
  Lock,
  Users,
  Shield,
  Undo2,
  Trash,
  Pencil,
  MoreVertical,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createStorageFolder,
  getFolderContents,
  getRootFolders,
  updateFolderVisibility,
  trashDocument,
  renameDocument,
  restoreDocument,
  permanentDeleteDocument,
  getTrashItems,
  renameFolder,
  trashFolder,
  searchStorage,
} from "@/app/(dashboard)/storage/actions";
import {
  getUploadUrl,
  createSiteDocument,
  deleteSiteDocument,
  getDownloadUrl,
  getSiteMembers,
} from "@/app/(dashboard)/sites/actions";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTIONS, ROLE_LABELS } from "@/lib/constants";
import type { StorageFolder, UserRole, DocumentType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FolderWithSiteName extends StorageFolder {
  site_name?: string;
  client_name?: string | null;
}

interface DocumentItem {
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
  folder_id?: string | null;
}

interface StoragePageProps {
  folders: FolderWithSiteName[];
  documents: DocumentItem[];
  breadcrumbs: { id: string; name: string }[];
  currentFolder: StorageFolder | null;
  userRole: UserRole;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(fileName);
}

function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

function getFileIcon(fileName: string) {
  if (isImageFile(fileName)) return ImageIcon;
  if (isPdfFile(fileName)) return FileText;
  return File;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function StoragePage({
  folders: initialFolders,
  documents: initialDocuments,
  breadcrumbs,
  currentFolder,
  userRole,
  userId,
}: StoragePageProps) {
  const [isPending, startTransition] = useTransition();
  const [folders, setFolders] = useState(initialFolders);
  const [documents, setDocuments] = useState(initialDocuments);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [permissionFolder, setPermissionFolder] = useState<FolderWithSiteName | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderWithSiteName | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [renameDocName, setRenameDocName] = useState("");
  const [docMenuId, setDocMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<{
    folders: { id: string; name: string; path: string; site_name: string | null }[];
    documents: { id: string; title: string; file_name: string; storage_path: string; file_size: number | null; folder_id: string | null; site_name: string | null; created_at: string }[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRoot = !currentFolder;
  const isManager = userRole === "admin" || userRole === "manager";
  const canEdit = isManager || userRole === "worker_internal" || userRole === "worker_external";
  const canDeleteAll = isManager; // マネージャー: 全ファイル削除可
  const isWorker = userRole === "worker_internal" || userRole === "worker_external";
  const isClient = userRole === "client";

  // グローバル検索（デバウンス）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.trim().length < 2) {
      setGlobalSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchStorage(value.trim());
      setGlobalSearchResults(results);
      setIsSearching(false);
    }, 400);
  }, []);

  // グローバル検索モード: 2文字以上で発動（ローカルフィルタは廃止しガタつきを防止）
  const q = searchQuery.trim();
  const filteredFolders = folders;
  const filteredDocuments = documents;

  const isGlobalSearch = q.length >= 2 && (globalSearchResults !== null || isSearching);

  // ファイル削除可能判定: マネージャーは全て、ワーカーは自分のファイルのみ
  const canDeleteDoc = (doc: DocumentItem) => {
    if (canDeleteAll) return true;
    if (isWorker && userId && doc.uploaded_by === userId) return true;
    return false;
  };

  // リフレッシュ
  const refresh = useCallback(() => {
    startTransition(async () => {
      if (isRoot) {
        const result = await getRootFolders();
        if (result.success) setFolders(result.folders ?? []);
      } else {
        const result = await getFolderContents(currentFolder.id);
        if (result.success) {
          setFolders((result.childFolders ?? []) as FolderWithSiteName[]);
          setDocuments(result.documents ?? []);
        }
      }
    });
  }, [isRoot, currentFolder]);

  // ファイルプレビュー
  const handlePreview = async (doc: DocumentItem) => {
    const result = await getDownloadUrl(doc.storage_path);
    if (result.success && result.url) {
      setPreviewUrl(result.url);
      setPreviewFileName(doc.file_name);
    }
  };

  // ファイルダウンロード
  const handleDownload = async (doc: DocumentItem) => {
    const result = await getDownloadUrl(doc.storage_path);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    }
  };

  // ファイルリネーム
  const handleRenameDoc = async () => {
    if (!renameDoc || !renameDocName.trim()) return;
    startTransition(async () => {
      const result = await renameDocument(renameDoc.id, renameDocName.trim());
      if (result.success) {
        setRenameDoc(null);
        refresh();
      }
    });
  };

  // ファイルをゴミ箱に移動
  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`「${doc.title}」をゴミ箱に移動しますか？`)) return;
    startTransition(async () => {
      const result = await trashDocument(doc.id);
      if (result.success) refresh();
    });
  };

  // メニュー外クリックで閉じる（mousedownで検知、clickの前に発火）
  useEffect(() => {
    if (!docMenuId && !folderMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-menu-dropdown]") || target.closest("[data-menu-trigger]")) return;
      setDocMenuId(null);
      setFolderMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [docMenuId, folderMenuId]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {/* ── ヘッダー ── */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            {isRoot ? "ストレージ" : currentFolder.name}
          </h1>
          {isRoot && isManager && (
            <Button
              variant={showTrash ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowTrash(!showTrash)}
            >
              <Trash size={16} />
              ゴミ箱
            </Button>
          )}
          {!isRoot && canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewFolderModal(true)}
              >
                <Plus size={16} />
                フォルダ作成
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload size={16} />
                アップロード
              </Button>
            </div>
          )}
        </div>
        {isRoot && (
          <p className="text-sm text-gray-500 mt-1">全現場のファイルを管理</p>
        )}
      </div>

      {/* ── パンくず ── */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
        <Link
          href="/storage"
          className="flex items-center gap-1 hover:text-sky-600 transition-colors"
        >
          <Home size={14} />
          ストレージ
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <Link
              href={`/storage/${crumb.id}`}
              className="hover:text-sky-600 transition-colors"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
        {currentFolder && (
          <span className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-900 font-medium">{currentFolder.name}</span>
          </span>
        )}
      </nav>

      {/* ── 検索バー ── */}
      <div className="relative w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="フォルダ・ファイルを全体検索..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
        />
        {isSearching && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
      </div>

      {/* ── グローバル検索結果 ── */}
      {isGlobalSearch ? (
        <div className="space-y-4 min-h-[200px] w-full">
          {isSearching ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 size={16} className="text-gray-400 animate-spin" />
              <span className="text-[13px] text-gray-400">検索中...</span>
            </div>
          ) : !globalSearchResults ? null : (<>
          <p className="text-[13px] text-gray-400">
            「{searchQuery.trim()}」の検索結果 — フォルダ {globalSearchResults.folders.length}件 / ファイル {globalSearchResults.documents.length}件
          </p>

          {globalSearchResults.folders.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">フォルダ</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {globalSearchResults.folders.map((f) => (
                  <Link
                    key={f.id}
                    href={`/storage/${f.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-[#0EA5E9]/30 hover:bg-sky-50/50 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <Folder size={18} className="text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{f.name}</p>
                      {f.site_name && <p className="text-[11px] text-gray-400 truncate">{f.site_name}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {globalSearchResults.documents.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ファイル</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {globalSearchResults.documents.map((d) => {
                  const ext = d.file_name.split(".").pop()?.toLowerCase() ?? "";
                  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext);
                  return (
                    <div key={d.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        {isImage ? (
                          <ImageIcon size={32} className="text-gray-300" />
                        ) : (
                          <File size={32} className="text-gray-300" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[12px] font-medium text-gray-900 truncate">{d.title || d.file_name}</p>
                        {d.site_name && <p className="text-[10px] text-gray-400 truncate">{d.site_name}</p>}
                        {d.file_size && <p className="text-[10px] text-gray-300">{(d.file_size / 1024).toFixed(0)} KB</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {globalSearchResults.folders.length === 0 && globalSearchResults.documents.length === 0 && (
            <p className="text-[13px] text-gray-400 text-center py-8">該当する結果がありません</p>
          )}
          </>)}
        </div>
      ) : showTrash && isRoot ? (
        <TrashView onRestore={() => { refresh(); }} />
      ) : (
      <>
      {/* ── フォルダ一覧 ── */}
      {filteredFolders.length > 0 && (
        <section>
          {!isRoot && (
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              フォルダ
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-sm transition-all group"
              >
                <Link
                  href={`/storage/${folder.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors">
                    {folder.folder_type === "company" ? (
                      <Users size={20} className="text-violet-500" />
                    ) : folder.folder_type === "site_root" ? (
                      <Building2 size={20} className="text-sky-500" />
                    ) : folder.folder_type === "document" ? (
                      <FileText size={20} className="text-amber-500" />
                    ) : (
                      <Folder size={20} className="text-sky-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {folder.name}
                      </p>
                      {folder.visibility === "all" ? (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded-full">
                          <Globe size={10} />
                          公開
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">
                          <Lock size={10} />
                          社内
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {folder.folder_type === "company"
                        ? "クライアント"
                        : folder.folder_type === "site_root"
                          ? "現場フォルダ"
                          : folder.folder_type === "document"
                            ? "ドキュメント"
                            : "フォルダ"}
                    </p>
                  </div>
                </Link>
                {isManager && (
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderMenuId(folderMenuId === folder.id ? null : folder.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {folderMenuId === folder.id && (
                      <div
                        className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-gray-200 shadow-lg py-1 w-44"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setFolderMenuId(null); setPermissionFolder(folder); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Users size={14} /> アクセス権限
                        </button>
                        {folder.folder_type !== "site_root" && (
                          <>
                            <button
                              onClick={() => { setFolderMenuId(null); setRenameTarget(folder); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil size={14} /> 名前を変更
                            </button>
                            <button
                              onClick={() => {
                                setFolderMenuId(null);
                                if (!confirm(`「${folder.name}」をゴミ箱に移動しますか？`)) return;
                                startTransition(async () => {
                                  await trashFolder(folder.id);
                                  refresh();
                                });
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} /> 削除
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Link href={`/storage/${folder.id}`}>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-sky-400" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ファイル一覧 ── */}
      {filteredDocuments.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ファイル
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredDocuments.map((doc) => {
              const FileIcon = getFileIcon(doc.file_name);
              const hasThumb = isImageFile(doc.file_name) && doc.thumbnail_url;

              return (
                <div
                  key={doc.id}
                  className="relative rounded-xl border border-gray-200 bg-white overflow-hidden cursor-pointer hover:border-gray-300 transition-colors group"
                  onClick={() => handlePreview(doc)}
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
                      <FileIcon size={28} className="text-gray-300" />
                    )}
                    {/* メニューボタン */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDocMenuId(docMenuId === doc.id ? null : doc.id); }}
                      data-menu-trigger
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white"
                    >
                      <MoreVertical size={12} />
                    </button>
                    {/* ドロップダウンメニュー */}
                    {docMenuId === doc.id && (
                      <div
                        data-menu-dropdown
                        className="absolute top-8 right-1.5 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { handleDownload(doc); setDocMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Download size={12} /> ダウンロード
                        </button>
                        {canDeleteDoc(doc) && (
                          <button
                            onClick={() => { setRenameDoc(doc); setRenameDocName(doc.title); setDocMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil size={12} /> 名前を変更
                          </button>
                        )}
                        {canDeleteDoc(doc) && (
                          <button
                            onClick={() => { handleDelete(doc); setDocMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={12} /> ゴミ箱に移動
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* ラベル */}
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-medium text-gray-700 truncate">{doc.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
                    </p>
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
        </section>
      )}

      {/* ── 空状態 ── */}
      {filteredFolders.length === 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {isRoot
              ? "現場を作成するとフォルダが自動生成されます"
              : "このフォルダにはまだファイルがありません"}
          </p>
          {!isRoot && canEdit && (
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setShowUploadModal(true)}
            >
              <Upload size={16} />
              ファイルをアップロード
            </Button>
          )}
        </div>
      )}
      </>
      )}

      {/* ── ローディング ── */}
      {isPending && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 shadow-lg flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-sky-500" />
            <span className="text-sm text-gray-600">読み込み中...</span>
          </div>
        </div>
      )}

      {/* ── プレビューモーダル ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl max-h-[90vh] w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {previewFileName}
              </h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
              {isImageFile(previewFileName) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewFileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFileName}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 新規フォルダモーダル ── */}
      {showNewFolderModal && currentFolder && (
        <NewFolderModal
          parentFolderId={currentFolder.id}
          onClose={() => setShowNewFolderModal(false)}
          onCreated={refresh}
        />
      )}

      {/* ── アップロードモーダル ── */}
      {showUploadModal && currentFolder && (
        <UploadModal
          folderId={currentFolder.id}
          siteId={currentFolder.site_id ?? ""}
          onClose={() => setShowUploadModal(false)}
          onUploaded={refresh}
        />
      )}

      {/* ── ファイルリネームモーダル ── */}
      {renameDoc && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setRenameDoc(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">ファイル名を変更</h3>
            <Input
              value={renameDocName}
              onChange={(e) => setRenameDocName(e.target.value)}
              placeholder="新しいファイル名"
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameDoc(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRenameDoc(null)}>
                キャンセル
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRenameDoc}
                disabled={!renameDocName.trim() || renameDocName.trim() === renameDoc.title}
                loading={isPending}
              >
                変更
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 権限確認モーダル ── */}
      {permissionFolder && (
        <FolderPermissionModal
          folder={permissionFolder}
          onClose={() => setPermissionFolder(null)}
          onVisibilityChange={(newVisibility) => {
            startTransition(async () => {
              await updateFolderVisibility(permissionFolder.id, newVisibility);
              setPermissionFolder(null);
              refresh();
            });
          }}
        />
      )}

      {/* ── リネームモーダル ── */}
      {renameTarget && (
        <RenameFolderModal
          folder={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={refresh}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 新規フォルダモーダル
// ---------------------------------------------------------------------------
function NewFolderModal({
  parentFolderId,
  onClose,
  onCreated,
}: {
  parentFolderId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    const result = await createStorageFolder({
      name: name.trim(),
      parentFolderId,
    });
    setIsCreating(false);
    if (result.success) {
      onCreated();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">新規フォルダ</h3>
        <Input
          placeholder="フォルダ名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            loading={isCreating}
            disabled={!name.trim()}
          >
            作成
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// アップロードモーダル
// ---------------------------------------------------------------------------
function UploadModal({
  folderId,
  siteId,
  onClose,
  onUploaded,
}: {
  folderId: string;
  siteId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>("other");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const [uploadError, setUploadError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setUploadError("");
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError("");
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`${i + 1}/${files.length}: ${file.name}`);

      // 1. アップロードURL取得
      const urlResult = await getUploadUrl(siteId, file.name, documentType);
      if (!urlResult.success || !urlResult.uploadUrl || !urlResult.storagePath) {
        console.error(`[Upload] URL取得失敗: ${file.name}`, urlResult.error);
        setUploadError(`${file.name}: URL取得に失敗しました`);
        continue;
      }

      // 2. ファイルアップロード
      try {
        const res = await fetch(urlResult.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) {
          console.error(`[Upload] PUT失敗: ${file.name}`, res.status, res.statusText);
          setUploadError(`${file.name}: アップロードに失敗しました (${res.status})`);
          continue;
        }
      } catch (err) {
        console.error(`[Upload] ネットワークエラー: ${file.name}`, err);
        setUploadError(`${file.name}: ネットワークエラー`);
        continue;
      }

      // 3. DB レコード作成（folder_id 付き）
      await createSiteDocument({
        siteId,
        documentType,
        title: file.name,
        storagePath: urlResult.storagePath,
        fileName: file.name,
        fileSize: file.size,
        folderId,
      });
      successCount++;
    }

    setIsUploading(false);
    if (successCount > 0) {
      onUploaded();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">ファイルアップロード</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* ファイル選択 */}
        <label
          className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/30 transition-colors"
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            {files.length > 0
              ? `${files.length}件のファイルを選択済み`
              : "タップしてファイルを選択"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
        </label>

        {/* ファイル一覧 */}
        {files.length > 0 && (
          <div className="max-h-40 overflow-auto space-y-1">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-gray-600 py-1"
              >
                <File size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 種別選択 */}
        <Select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          options={DOCUMENT_TYPE_OPTIONS}
          label="ドキュメント種別"
        />

        {/* アップロード進捗 */}
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-sky-600">
            <Loader2 size={16} className="animate-spin" />
            <span>{progress}</span>
          </div>
        )}

        {/* エラーメッセージ */}
        {uploadError && (
          <p className="text-sm text-red-500">{uploadError}</p>
        )}

        {/* アクション */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isUploading}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpload}
            loading={isUploading}
            disabled={files.length === 0}
          >
            アップロード
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// フォルダ権限確認モーダル
// ---------------------------------------------------------------------------
function FolderPermissionModal({
  folder,
  onClose,
  onVisibilityChange,
}: {
  folder: FolderWithSiteName;
  onClose: () => void;
  onVisibilityChange: (visibility: "internal" | "all") => void;
}) {
  const [members, setMembers] = useState<{ name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!folder.site_id) {
      setLoading(false);
      return;
    }
    getSiteMembers(folder.site_id).then((res) => {
      if (res.success && res.members) {
        setMembers(res.members.map((m) => ({ name: m.name, role: m.role })));
      }
      setLoading(false);
    });
  }, [folder.site_id]);

  const isPublic = folder.visibility === "all";

  // ロール別にメンバーを分類
  const managers = members.filter((m) => m.role === "admin" || m.role === "manager");
  const workers = members.filter((m) => m.role === "worker_internal" || m.role === "worker_external");
  const clients = members.filter((m) => m.role === "client");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-sky-500" />
              <h3 className="text-base font-bold text-gray-900">アクセス権限</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{folder.name}</p>
        </div>

        {/* 公開設定 */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <Globe size={16} className="text-green-500" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Lock size={16} className="text-gray-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isPublic ? "現場関係者全員に公開" : "社内のみ"}
                </p>
                <p className="text-xs text-gray-400">
                  {isPublic
                    ? "クライアント・パートナーも閲覧可能"
                    : "マネージャー・ワーカーのみ閲覧可能"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVisibilityChange(isPublic ? "internal" : "all")}
            >
              {isPublic ? "社内のみに変更" : "公開に変更"}
            </Button>
          </div>
        </div>

        {/* メンバー一覧 */}
        <div className="px-5 py-4 max-h-80 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" />
              読み込み中...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 閲覧可能なユーザー */}
              <MemberGroup
                title="マネージャー・管理者"
                members={managers}
                canAccess={true}
                icon={<Shield size={14} className="text-sky-500" />}
              />
              <MemberGroup
                title="ワーカー"
                members={workers}
                canAccess={true}
                icon={<Users size={14} className="text-blue-500" />}
              />
              <MemberGroup
                title="クライアント・パートナー"
                members={clients}
                canAccess={isPublic}
                icon={<Globe size={14} className="text-green-500" />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberGroup({
  title,
  members,
  canAccess,
  icon,
}: {
  title: string;
  members: { name: string; role: string }[];
  canAccess: boolean;
  icon: React.ReactNode;
}) {
  if (members.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </span>
        {canAccess ? (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">
            閲覧可
          </span>
        ) : (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
            閲覧不可
          </span>
        )}
      </div>
      <div className="space-y-1">
        {members.map((member, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              canAccess ? "bg-white text-gray-900" : "bg-gray-50 text-gray-400"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              canAccess ? "bg-sky-100 text-sky-600" : "bg-gray-200 text-gray-400"
            }`}>
              {member.name.charAt(0)}
            </div>
            <span className={canAccess ? "" : "line-through"}>{member.name}</span>
            <span className="ml-auto text-xs text-gray-400">
              {ROLE_LABELS[member.role] ?? member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ゴミ箱ビュー
// ---------------------------------------------------------------------------
function TrashView({ onRestore }: { onRestore: () => void }) {
  const [items, setItems] = useState<{
    id: string;
    title: string;
    file_name: string;
    file_size: number | null;
    deleted_at: string;
    deleted_by_name: string | null;
    folder_path: string | null;
    site_name: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getTrashItems().then((res) => {
      if (res.success) setItems(res.documents ?? []);
      setLoading(false);
    });
  }, []);

  const handleRestore = (id: string) => {
    startTransition(async () => {
      const result = await restoreDocument(id);
      if (result.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        onRestore();
      }
    });
  };

  const handlePermanentDelete = (id: string, title: string) => {
    if (!confirm(`「${title}」を完全に削除しますか？この操作は取り消せません。`)) return;
    startTransition(async () => {
      const result = await permanentDeleteDocument(id);
      if (result.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const daysUntilAutoDelete = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const now = new Date();
    const diffMs = 30 * 24 * 60 * 60 * 1000 - (now.getTime() - deleted.getTime());
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
        <Loader2 size={16} className="animate-spin" />
        読み込み中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Trash size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">ゴミ箱は空です</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          ゴミ箱 ({items.length}件)
        </h2>
        <p className="text-xs text-gray-400">30日後に自動削除されます</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.map((item) => {
          const remaining = daysUntilAutoDelete(item.deleted_at);
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  {item.site_name && <span>{item.site_name}</span>}
                  {item.site_name && <span>·</span>}
                  <span>{formatFileSize(item.file_size)}</span>
                  <span>·</span>
                  <span className={remaining <= 7 ? "text-red-400 font-medium" : ""}>
                    残り{remaining}日
                  </span>
                  {item.deleted_by_name && (
                    <>
                      <span>·</span>
                      <span>{item.deleted_by_name}が削除</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRestore(item.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50"
                  title="復元"
                >
                  <Undo2 size={14} />
                  復元
                </button>
                <button
                  onClick={() => handlePermanentDelete(item.id, item.title)}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  title="完全削除"
                >
                  <X size={14} />
                  完全削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// フォルダリネームモーダル
// ---------------------------------------------------------------------------
function RenameFolderModal({
  folder,
  onClose,
  onRenamed,
}: {
  folder: FolderWithSiteName;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRename = async () => {
    if (!name.trim() || name.trim() === folder.name) {
      onClose();
      return;
    }
    setIsRenaming(true);
    const result = await renameFolder(folder.id, name.trim());
    setIsRenaming(false);
    if (result.success) {
      onRenamed();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">フォルダ名を変更</h3>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleRename}
            loading={isRenaming}
            disabled={!name.trim()}
          >
            変更
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ルートフォルダ一覧（クライアント別グルーピング）
// ---------------------------------------------------------------------------
function RootFolderList({
  folders,
  isManager,
  folderMenuId,
  setFolderMenuId,
  setPermissionFolder,
  setRenameTarget,
  startTransition,
  refresh,
}: {
  folders: FolderWithSiteName[];
  isManager: boolean;
  folderMenuId: string | null;
  setFolderMenuId: (id: string | null) => void;
  setPermissionFolder: (f: FolderWithSiteName) => void;
  setRenameTarget: (f: FolderWithSiteName) => void;
  startTransition: (cb: () => Promise<void>) => void;
  refresh: () => void;
}) {
  // クライアント別にグルーピング
  const grouped = new Map<string, FolderWithSiteName[]>();
  for (const folder of folders) {
    const clientName = folder.client_name || "その他";
    if (!grouped.has(clientName)) grouped.set(clientName, []);
    grouped.get(clientName)!.push(folder);
  }

  // クライアント名でソート
  const sortedClients = [...grouped.entries()].sort(([a], [b]) => {
    if (a === "その他") return 1;
    if (b === "その他") return -1;
    return a.localeCompare(b, "ja");
  });

  return (
    <div className="space-y-6">
      {sortedClients.map(([clientName, clientFolders]) => (
        <div key={clientName}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">
              {clientName}
            </h2>
            <span className="text-xs text-gray-400">{clientFolders.length}現場</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clientFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-sm transition-all group"
              >
                <Link
                  href={`/storage/${folder.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors">
                    <Building2 size={20} className="text-sky-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {folder.site_name ?? folder.name}
                      </p>
                      {folder.visibility === "all" ? (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded-full">
                          <Globe size={10} />
                          公開
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">
                          <Lock size={10} />
                          社内
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">現場フォルダ</p>
                  </div>
                </Link>
                {isManager && (
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderMenuId(folderMenuId === folder.id ? null : folder.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {folderMenuId === folder.id && (
                      <div
                        className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-gray-200 shadow-lg py-1 w-44"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setFolderMenuId(null); setPermissionFolder(folder); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Users size={14} /> アクセス権限
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <Link href={`/storage/${folder.id}`}>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-sky-400" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
