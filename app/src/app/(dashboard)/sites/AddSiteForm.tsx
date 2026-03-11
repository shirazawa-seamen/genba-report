"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSite } from "./actions";

export function AddSiteForm({ onOpenChange }: { onOpenChange?: (isOpen: boolean) => void } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [siteNumber, setSiteNumber] = useState("");
  const [address, setAddress] = useState("");
const [clientName, setClientName] = useState("");
  const [siteColor, setSiteColor] = useState("#0EA5E9");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const setOpen = (next: boolean) => {
    setIsOpen(next);
    onOpenChange?.(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("現場名を入力してください"); return; }
    setError(null);
    startTransition(async () => {
      const result = await createSite({
        name: name.trim(),
        siteNumber: siteNumber.trim() || undefined,
        address: address.trim(),
        clientName: clientName.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        siteColor,
      });
      if (!result.success) { setError(result.error ?? "登録に失敗しました"); return; }
      setName(""); setSiteNumber(""); setAddress(""); setClientName(""); setStartDate(""); setEndDate(""); setSiteColor("#0EA5E9"); setOpen(false);
      router.refresh();
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 py-4 text-[13px] text-gray-400 hover:border-cyan-300 hover:text-[#0EA5E9]/70 hover:bg-cyan-50/50 transition-all min-h-[56px]"
      >
        <Plus size={16} />
        現場を追加
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-gray-600">新規現場を追加</h3>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-gray-400 hover:text-gray-500 transition-colors w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <Input label="現場名" placeholder="例：○○ビル新築工事" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} required autoFocus />
        <Input label="現場番号" placeholder="例：S-2026-001" value={siteNumber} onChange={(e) => setSiteNumber(e.target.value)} helperText="社内管理用の現場番号" />
        <Input label="住所" placeholder="例：東京都千代田区..." value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="クライアント名" placeholder="例：○○建設株式会社" value={clientName} onChange={(e) => setClientName(e.target.value)} helperText="この現場のクライアント会社名" />
        <Input label="現場カラー" type="color" value={siteColor} onChange={(e) => setSiteColor(e.target.value)} />
        <Input label="着工日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="完工予定日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        {error && <p className="text-[13px] text-red-400">{error}</p>}
        <Button type="submit" variant="primary" size="sm" loading={isPending}>
          {isPending ? "登録中..." : "登録"}
        </Button>
      </div>
    </form>
  );
}
