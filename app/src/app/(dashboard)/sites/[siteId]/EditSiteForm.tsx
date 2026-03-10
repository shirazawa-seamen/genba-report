"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSite, deleteSite } from "../actions";

interface EditSiteFormProps {
  site: { id: string; name: string; address: string; start_date: string | null; end_date: string | null };
}

export function EditSiteForm({ site }: EditSiteFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address);
  const [startDate, setStartDate] = useState(site.start_date ?? "");
  const [endDate, setEndDate] = useState(site.end_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("現場名を入力してください"); return; }
    setError(null);
    startTransition(async () => {
      const result = await updateSite({ siteId: site.id, name: name.trim(), address: address.trim(), startDate: startDate || undefined, endDate: endDate || undefined });
      if (!result.success) { setError(result.error ?? "更新に失敗しました"); return; }
      setIsEditing(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteSite(site.id);
      if (!result.success) { setError(result.error ?? "削除に失敗しました"); setShowDeleteConfirm(false); return; }
      router.push("/sites");
      router.refresh();
    });
  };

  const handleCancel = () => {
    setName(site.name); setAddress(site.address); setStartDate(site.start_date ?? ""); setEndDate(site.end_date ?? "");
    setError(null); setIsEditing(false); setShowDeleteConfirm(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.1] hover:bg-white/[0.06] hover:text-white/70 transition-all"
        >
          <Pencil size={14} /> 編集
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.1] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
        >
          <Trash2 size={14} /> 削除
        </button>

        {showDeleteConfirm && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="rounded-2xl border border-white/[0.08] bg-[#222222] p-6 max-w-sm w-full">
              <h3 className="text-[16px] font-bold text-white/90 mb-2">現場を削除しますか？</h3>
              <p className="text-[13px] text-white/40 mb-6">
                「{site.name}」を削除します。この操作は取り消せません。
              </p>
              {error && <p className="text-[13px] text-red-400 mb-4">{error}</p>}
              <div className="flex gap-2.5">
                <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); setError(null); }} disabled={isDeleting} className="flex-1">
                  キャンセル
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting} loading={isDeleting} className="flex-1">
                  {isDeleting ? "削除中..." : "削除する"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-white/75">現場情報を編集</h3>
        <button type="button" onClick={handleCancel} className="text-white/30 hover:text-white/50 transition-colors w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <Input label="現場名" placeholder="例：○○ビル新築工事" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} required autoFocus />
        <Input label="住所" placeholder="例：東京都千代田区..." value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="着工日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="完工予定日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {error && <p className="text-[13px] text-red-400">{error}</p>}
        <div className="flex gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="flex-1">キャンセル</Button>
          <Button type="submit" variant="primary" size="sm" loading={isPending} className="flex-1">{isPending ? "保存中..." : "保存"}</Button>
        </div>
      </div>
    </form>
  );
}
