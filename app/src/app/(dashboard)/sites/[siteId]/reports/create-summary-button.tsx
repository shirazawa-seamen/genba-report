"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { generateClientReportSummary } from "./actions";

export function CreateSummaryButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!date) return;
    setMessage(null);
    startTransition(async () => {
      const result = await generateClientReportSummary(siteId, date);
      if (!result.success) {
        setMessage(result.error || "作成に失敗しました");
        return;
      }
      setMessage("1次報告を作成しました");
      setIsOpen(false);
      router.refresh();
    });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border border-cyan-200 bg-cyan-50 text-[12px] font-medium text-[#0EA5E9] transition-colors hover:bg-cyan-100"
      >
        <Plus size={14} />
        1次報告を作成
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="min-h-[36px] rounded-xl border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending || !date}
        className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-xl bg-[#0EA5E9] text-[12px] font-bold text-white transition-all hover:bg-[#0284C7] disabled:opacity-50"
      >
        {isPending ? "作成中..." : "作成（2次報告があればLLM自動生成）"}
      </button>
      <button
        type="button"
        onClick={() => { setIsOpen(false); setMessage(null); }}
        className="min-h-[36px] px-2 text-[12px] text-gray-400 hover:text-gray-600"
      >
        キャンセル
      </button>
      {message && <p className="w-full text-[11px] text-red-400">{message}</p>}
    </div>
  );
}
