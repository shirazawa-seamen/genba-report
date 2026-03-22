"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Search, Package } from "lucide-react";
import {
  addMaterialCatalogItem,
  deleteMaterialCatalogItem,
} from "./actions";

interface MaterialItem {
  id: string;
  materialName: string;
  productNumber: string;
  unit: string;
  supplier: string;
  category: string;
  note: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
}

export function MaterialCatalogManager({
  initialMaterials,
  companies,
}: {
  initialMaterials: MaterialItem[];
  companies: Company[];
}) {
  const [materials] = useState(initialMaterials);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // フォーム state
  const [newMaterial, setNewMaterial] = useState({
    materialName: "",
    productNumber: "",
    unit: "",
    supplier: "",
    category: "",
    note: "",
    companyIds: [] as string[],
  });

  const categories = [...new Set(materials.map((m) => m.category).filter(Boolean))].sort();

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.productNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAdd = () => {
    if (!newMaterial.materialName.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const { companyIds, ...rest } = newMaterial;
      // 会社未選択の場合は全社共通（companyId なし）で1件登録
      const targetCompanyIds = companyIds.length === 0 ? [""] : companyIds;
      let hasError = false;
      for (const cid of targetCompanyIds) {
        const result = await addMaterialCatalogItem({ ...rest, companyId: cid || undefined });
        if (!result.success) {
          setMessage(result.error || "追加に失敗しました");
          hasError = true;
          break;
        }
      }
      if (!hasError) {
        setMessage(targetCompanyIds.length > 1 ? `${targetCompanyIds.length}社に材料を追加しました` : "材料を追加しました");
        setNewMaterial({ materialName: "", productNumber: "", unit: "", supplier: "", category: "", note: "", companyIds: [] });
        setShowAddModal(false);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteMaterialCatalogItem(id);
      if (result.success) {
        setMessage("削除しました");
      } else {
        setMessage(result.error || "削除に失敗しました");
      }
    });
  };

  return (
    <div>
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="材料名・品番・仕入先で検索..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
          >
            <option value="">すべてのカテゴリ</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#0EA5E9] px-4 text-[13px] font-semibold text-white hover:bg-[#0284C7] transition-colors"
        >
          <Plus size={16} />
          材料を追加
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-600">
          {message}
        </div>
      )}

      {/* 一覧 */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package size={14} className="text-[#0EA5E9]" />
          <span className="text-[13px] font-semibold text-gray-600">
            {filteredMaterials.length}件の材料
          </span>
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <Package size={32} className="mb-2 text-gray-200" />
            <p className="text-[13px]">
              {searchQuery || categoryFilter ? "該当する材料はありません" : "材料が登録されていません"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredMaterials.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{m.materialName}</p>
                    {m.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 font-medium shrink-0">
                        {m.category}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-400">
                    {m.productNumber && <span>品番: {m.productNumber}</span>}
                    {m.unit && <span>単位: {m.unit}</span>}
                    {m.supplier && <span>仕入先: {m.supplier}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id, m.materialName)}
                  disabled={isPending}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="削除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-[16px] font-bold text-gray-900">材料を追加</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1">
                  材料名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newMaterial.materialName}
                  onChange={(e) => setNewMaterial({ ...newMaterial, materialName: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                  placeholder="例: コンクリート"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1">品番</label>
                  <input
                    type="text"
                    value={newMaterial.productNumber}
                    onChange={(e) => setNewMaterial({ ...newMaterial, productNumber: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1">単位</label>
                  <input
                    type="text"
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                    placeholder="例: m³, kg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1">カテゴリ</label>
                  <input
                    type="text"
                    value={newMaterial.category}
                    onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                    placeholder="例: 躯体材, 仕上材"
                    list="category-suggestions"
                  />
                  {categories.length > 0 && (
                    <datalist id="category-suggestions">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1">仕入先</label>
                  <input
                    type="text"
                    value={newMaterial.supplier}
                    onChange={(e) => setNewMaterial({ ...newMaterial, supplier: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                  />
                </div>
              </div>
              {companies.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-1.5">会社</label>
                  <div className="rounded-xl border border-gray-200 px-3 py-2 space-y-1.5 max-h-40 overflow-y-auto">
                    <label className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={newMaterial.companyIds.length === 0}
                        onChange={() => setNewMaterial({ ...newMaterial, companyIds: [] })}
                        className="rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9]/30 w-4 h-4"
                      />
                      <span className="text-[13px] text-gray-600">全社共通</span>
                    </label>
                    <div className="border-t border-gray-100" />
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={newMaterial.companyIds.includes(c.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewMaterial((prev) => ({
                              ...prev,
                              companyIds: checked
                                ? [...prev.companyIds, c.id]
                                : prev.companyIds.filter((id) => id !== c.id),
                            }));
                          }}
                          className="rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9]/30 w-4 h-4"
                        />
                        <span className="text-[13px] text-gray-700">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  {newMaterial.companyIds.length === 0 && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      未選択の場合、全社共通の材料として登録されます
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-gray-500 mb-1">備考</label>
                <textarea
                  value={newMaterial.note}
                  onChange={(e) => setNewMaterial({ ...newMaterial, note: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] focus:border-[#0EA5E9]/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[12px] font-medium text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending || !newMaterial.materialName.trim()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[12px] font-semibold text-white hover:bg-[#0284C7] disabled:opacity-50"
              >
                <Plus size={14} />
                {isPending ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
