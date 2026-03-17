"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Plus,
  Trash2,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSiteMaterials,
  addSiteMaterial,
  deleteSiteMaterial,
} from "@/app/(dashboard)/sites/actions";
import { getMaterialCatalog } from "@/app/(dashboard)/admin/materials/actions";

interface Material {
  id: string;
  material_name: string;
  product_number: string | null;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  note: string | null;
  spec_url: string | null;
  manufacturer: string | null;
  created_at: string;
}

interface MaterialManagerProps {
  siteId: string;
  canManage?: boolean;
}

export function MaterialManager({ siteId, canManage = false }: MaterialManagerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    const result = await getSiteMaterials(siteId);
    if (result.success && result.materials) {
      setMaterials(result.materials);
    }
    setIsLoading(false);
  }, [siteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMaterials();
  }, [fetchMaterials]);

  const handleDelete = async (materialId: string) => {
    if (!confirm("この材料を削除しますか？")) return;
    setIsLoading(true);
    setDeletingId(materialId);
    await deleteSiteMaterial(materialId, siteId);
    await fetchMaterials();
    setDeletingId(null);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[#0EA5E9]" />
          <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
            使用材料（{materials.length}件）
          </h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCatalogPicker(true)}
            >
              <Package size={14} />
              カタログから
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
              手入力
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-300">
          <Package size={32} className="mb-2 text-gray-200" />
          <p className="text-[13px]">使用材料が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((mat) => {
            const isDeleting = deletingId === mat.id;
            return (
              <div
                key={mat.id}
                className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 min-h-[52px] py-2.5"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50">
                  <Package size={16} className="text-[#0EA5E9]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-gray-700 truncate">
                      {mat.material_name}
                    </span>
                    {mat.product_number && (
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {mat.product_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                    {mat.quantity != null && (
                      <span>
                        {mat.quantity}{mat.unit || ""}
                      </span>
                    )}
                    {mat.manufacturer && (
                      <>
                        <span className="text-gray-200">|</span>
                        <span>{mat.manufacturer}</span>
                      </>
                    )}
                    {mat.supplier && (
                      <>
                        <span className="text-gray-200">|</span>
                        <span>{mat.supplier}</span>
                      </>
                    )}
                    {mat.note && (
                      <>
                        <span className="text-gray-200">|</span>
                        <span className="truncate">{mat.note}</span>
                      </>
                    )}
                    {mat.spec_url && (
                      <>
                        <span className="text-gray-200">|</span>
                        <a
                          href={mat.spec_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[#0EA5E9] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          仕様書 <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(mat.id)}
                    disabled={isDeleting}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-50"
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
            );
          })}
        </div>
      )}

      {canManage && showAddModal && (
        <AddMaterialModal
          siteId={siteId}
          onClose={async () => {
            setIsLoading(true);
            setShowAddModal(false);
            await fetchMaterials();
          }}
        />
      )}

      {canManage && showCatalogPicker && (
        <CatalogPickerModal
          siteId={siteId}
          onClose={async () => {
            setIsLoading(true);
            setShowCatalogPicker(false);
            await fetchMaterials();
          }}
        />
      )}
    </div>
  );
}

interface AddMaterialModalProps {
  siteId: string;
  onClose: () => void;
}

function AddMaterialModal({ siteId, onClose }: AddMaterialModalProps) {
  const [isPending, startTransition] = useTransition();
  const [materialName, setMaterialName] = useState("");
  const [productNumber, setProductNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [note, setNote] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim()) {
      setError("材料名を入力してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addSiteMaterial({
        siteId,
        materialName: materialName.trim(),
        productNumber: productNumber.trim() || undefined,
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: unit.trim() || undefined,
        supplier: supplier.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        note: note.trim() || undefined,
        specUrl: specUrl.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "追加に失敗しました");
        return;
      }
      onClose();
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-bold text-gray-900">材料を追加</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="材料名"
            value={materialName}
            onChange={(e) => { setMaterialName(e.target.value); setError(null); }}
            placeholder="例：鉄筋 D13"
            required
            autoFocus
          />
          <Input
            label="品番（任意）"
            value={productNumber}
            onChange={(e) => setProductNumber(e.target.value)}
            placeholder="例：SD345"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="数量（任意）"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="例：100"
            />
            <Input
              label="単位（任意）"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="例：本"
            />
          </div>
          <Input
            label="メーカー名（任意）"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="例：LIXIL"
          />
          <Input
            label="仕入先（任意）"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="例：○○建材"
          />
          <Input
            label="仕様書URL（任意）"
            type="url"
            value={specUrl}
            onChange={(e) => setSpecUrl(e.target.value)}
            placeholder="https://..."
          />
          <Input
            label="備考（任意）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="メモ"
          />

          {error && (
            <p className="text-[13px] text-red-400 bg-red-50 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              loading={isPending}
              disabled={!materialName.trim()}
            >
              追加
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

interface CatalogPickerModalProps {
  siteId: string;
  onClose: () => void;
}

function CatalogPickerModal({ siteId, onClose }: CatalogPickerModalProps) {
  const [isPending, startTransition] = useTransition();
  const [catalogItems, setCatalogItems] = useState<
    Array<{ id: string; material_name: string; product_number: string | null; unit: string | null; supplier: string | null; category: string | null }>
  >([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getMaterialCatalog();
      if (result.success && result.data) {
        setCatalogItems(result.data as Array<{ id: string; material_name: string; product_number: string | null; unit: string | null; supplier: string | null; category: string | null }>);
      }
      setIsLoadingCatalog(false);
    })();
  }, []);

  const filteredItems = catalogItems.filter(
    (item) =>
      !searchQuery ||
      item.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.product_number ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (item: typeof catalogItems[0]) => {
    setMessage(null);
    startTransition(async () => {
      const result = await addSiteMaterial({
        siteId,
        materialName: item.material_name,
        productNumber: item.product_number || undefined,
        unit: item.unit || undefined,
        supplier: item.supplier || undefined,
      });
      if (result.success) {
        setMessage(`「${item.material_name}」を追加しました`);
      } else {
        setMessage(result.error ?? "追加に失敗しました");
      }
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold text-gray-900">カタログから追加</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="材料名・品番で検索..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
            autoFocus
          />
        </div>

        {message && (
          <div className="mb-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-[12px] text-gray-600">
            {message}
          </div>
        )}

        {isLoadingCatalog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300">
            <Package size={32} className="mb-2 text-gray-200" />
            <p className="text-[13px]">
              {searchQuery ? "該当する材料はありません" : "カタログに材料が登録されていません"}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-cyan-50 hover:border-[#0EA5E9]/30 disabled:opacity-50"
              >
                <Package size={14} className="text-[#0EA5E9] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-700 truncate">{item.material_name}</p>
                  <div className="flex gap-2 text-[11px] text-gray-400">
                    {item.product_number && <span>{item.product_number}</span>}
                    {item.unit && <span>{item.unit}</span>}
                    {item.supplier && <span>{item.supplier}</span>}
                  </div>
                </div>
                <Plus size={14} className="text-[#0EA5E9] shrink-0" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="md" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
