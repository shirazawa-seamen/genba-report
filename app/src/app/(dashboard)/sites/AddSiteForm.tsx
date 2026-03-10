"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSite } from "./actions";

export function AddSiteForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [siteNumber, setSiteNumber] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("現場名を入力してください"); return; }
    setError(null);
    startTransition(async () => {
      const result = await createSite({
        name: name.trim(),
        siteNumber: siteNumber.trim() || undefined,
        address: address.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (!result.success) { setError(result.error ?? "登録に失敗しました"); return; }
      setName(""); setSiteNumber(""); setAddress(""); setStartDate(""); setEndDate(""); setIsOpen(false);
      router.refresh();
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mb-6 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] py-4 text-[13px] text-white/40 hover:border-[#00D9FF]/30 hover:text-[#00D9FF]/70 hover:bg-[#00D9FF]/[0.03] transition-all min-h-[56px]"
      >
        <Plus size={16} />
        現場を追加
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-white/75">新規現場を追加</h3>
        <button type="button" onClick={() => { setIsOpen(false); setError(null); }} className="text-white/30 hover:text-white/50 transition-colors w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <Input label="現場名" placeholder="例：○○ビル新築工事" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} required autoFocus />
        <Input label="現場番号" placeholder="例：S-2026-001" value={siteNumber} onChange={(e) => setSiteNumber(e.target.value)} helperText="社内管理用の現場番号" />
        <Input label="住所" placeholder="例：東京都千代田区..." value={address} onChange={(e) => setAddress(e.target.value)} />
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
