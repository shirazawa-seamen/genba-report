"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Folder,
  ChevronRight,
  Home,
  Check,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiteDocuments, getDownloadUrl } from "@/app/(dashboard)/sites/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StoragePhoto {
  id: string;
  storagePath: string;
  fileName: string;
  title: string;
  thumbnailUrl: string | null;
  folderPath: string | null;
}

export interface SelectedStoragePhoto {
  documentId: string;
  storagePath: string;
  fileName: string;
  url: string;
}

interface StorageBrowserModalProps {
  siteId: string;
  onSelect: (photos: SelectedStoragePhoto[]) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(fileName);
}

interface FolderNode {
  name: string;
  path: string;
  fileCount: number;
}

function computeFolders(photos: StoragePhoto[], currentPath: string): FolderNode[] {
  const prefix = currentPath ? currentPath + "/" : "";
  const folderMap = new Map<string, number>();

  for (const p of photos) {
    const fp = p.folderPath ?? "";
    if (!fp.startsWith(prefix)) continue;
    const rest = fp.slice(prefix.length);
    if (!rest) continue;
    const nextSegment = rest.split("/")[0];
    const fullPath = prefix + nextSegment;
    folderMap.set(fullPath, (folderMap.get(fullPath) ?? 0) + 1);
  }

  const result: FolderNode[] = [];
  for (const [path] of folderMap) {
    const name = path.split("/").pop() ?? path;
    const count = photos.filter((p) => (p.folderPath ?? "").startsWith(path)).length;
    result.push({ name, path, fileCount: count });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function getFilesInFolder(photos: StoragePhoto[], folderPath: string): StoragePhoto[] {
  return photos.filter((p) => (p.folderPath ?? "") === folderPath);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function StorageBrowserModal({ siteId, onSelect, onClose }: StorageBrowserModalProps) {
  const [photos, setPhotos] = useState<StoragePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    getSiteDocuments(siteId).then((result) => {
      if (result.success && result.documents) {
        const imageDocs = result.documents
          .filter((d) => isImageFile(d.file_name))
          .map((d) => ({
            id: d.id,
            storagePath: d.storage_path,
            fileName: d.file_name,
            title: d.title,
            thumbnailUrl: d.thumbnail_url,
            folderPath: d.folder_path,
          }));
        setPhotos(imageDocs);
      }
      setIsLoading(false);
    });
  }, [siteId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    const selected = photos.filter((p) => selectedIds.has(p.id));

    // signed URLを取得
    const results: SelectedStoragePhoto[] = [];
    for (const photo of selected) {
      const urlResult = await getDownloadUrl(photo.storagePath);
      if (urlResult.success && urlResult.url) {
        results.push({
          documentId: photo.id,
          storagePath: photo.storagePath,
          fileName: photo.fileName,
          url: urlResult.url,
        });
      }
    }

    onSelect(results);
    setIsConfirming(false);
  };

  const folders = computeFolders(photos, currentPath);
  const filesHere = getFilesInFolder(photos, currentPath);
  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[90dvh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-[#0EA5E9]" />
            <h3 className="text-[15px] font-bold text-gray-900">ストレージから選択</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* パンくず */}
        <div className="flex items-center gap-1 px-5 py-2 text-[11px] flex-wrap border-b border-gray-50">
          <button
            onClick={() => setCurrentPath("")}
            className="text-[#0EA5E9] hover:underline flex items-center gap-0.5"
          >
            <Home size={10} />
            ストレージ
          </button>
          {breadcrumbs.map((segment, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight size={10} className="text-gray-300" />
                {isLast ? (
                  <span className="text-gray-600 font-medium">{segment}</span>
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

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
            </div>
          ) : folders.length === 0 && filesHere.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-12">
              {currentPath ? "このフォルダに写真がありません" : "ストレージに写真がありません"}
            </p>
          ) : (
            <div className="space-y-3">
              {/* フォルダ */}
              {folders.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {folders.map((folder) => (
                    <button
                      key={folder.path}
                      onClick={() => setCurrentPath(folder.path)}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left hover:border-[#0EA5E9]/30 hover:bg-[#0EA5E9]/5 transition-colors"
                    >
                      <Folder size={16} className="text-[#0EA5E9]/60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-700 truncate">{folder.name}</p>
                        <p className="text-[9px] text-gray-400">{folder.fileCount}件</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* 写真グリッド */}
              {filesHere.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {filesHere.map((photo) => {
                    const isSelected = selectedIds.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        onClick={() => toggleSelect(photo.id)}
                        className={`relative rounded-lg overflow-hidden aspect-square bg-gray-100 ${
                          isSelected ? "ring-2 ring-[#0EA5E9] ring-offset-1" : ""
                        }`}
                      >
                        {photo.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.thumbnailUrl}
                            alt={photo.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                            {photo.title}
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#0EA5E9] flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-[12px] text-gray-400">
            {selectedIds.size > 0 ? `${selectedIds.size}枚選択中` : "写真を選択してください"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              loading={isConfirming}
              disabled={selectedIds.size === 0}
            >
              選択完了
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
