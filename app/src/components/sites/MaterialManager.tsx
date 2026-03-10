"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Plus,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSiteMaterials,
  addSiteMaterial,
  deleteSiteMaterial,
} from "@/app/(dashboard)/sites/actions";

interface Material {
  id: string;
  material_name: string;
  product_number: string | null;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  note: string | null;
  created_at: string;
}

interface MaterialManagerProps {
  siteId: string;
}

export function MaterialManager({ siteId }: MaterialManagerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMaterials = async () => {
    setIsLoading(true);
    const result = await getSiteMaterials(siteId);
    if (result.success && result.materials) {
      setMaterials(result.materials);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMaterials();
  }, [siteId]);

  const handleDelete = async (materialId: string) => {
    if (!confirm("この材料を削除しますか？")) return;
    setDeletingId(materialId);
    await deleteSiteMaterial(materialId, siteId);
    await fetchMaterials();
    setDeletingId(null);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[#00D9FF]" />
          <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
            使用材料（{materials.length}件）
          </h2>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          材料を追加
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[#00D9FF]" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-white/30">
          <Package size={32} className="mb-2 text-white/15" />
          <p className="text-[13px]">使用材料が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((mat) => {
            const isDeleting = deletingId === mat.id;
            return (
              <div
                key={mat.id}
                className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 min-h-[52px] py-2.5"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#00D9FF]/10">
                  <Package size={16} className="text-[#00D9FF]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-white/80 truncate">
                      {mat.material_name}
                    </span>
                    {mat.product_number && (
                      <span className="text-[10px] font-medium text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {mat.product_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/35 flex-wrap">
                    {mat.quantity != null && (
                      <span>
                        {mat.quantity}{mat.unit || ""}
                      </span>
                    )}
                    {mat.supplier && (
                      <>
                        <span className="text-white/15">|</span>
                        <span>{mat.supplier}</span>
                      </>
                    )}
                    {mat.note && (
                      <>
                        <span className="text-white/15">|</span>
                        <span className="truncate">{mat.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(mat.id)}
                  disabled={isDeleting}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/30 hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-50"
                  title="削除"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddMaterialModal
          siteId={siteId}
          onClose={async () => {
            setShowAddModal(false);
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
  const [note, setNote] = useState("");
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
        note: note.trim() || undefined,
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#222222] p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-bold text-white/90">材料を追加</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
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
            label="仕入先（任意）"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="例：○○建材"
          />
          <Input
            label="備考（任意）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="メモ"
          />

          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5">
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
