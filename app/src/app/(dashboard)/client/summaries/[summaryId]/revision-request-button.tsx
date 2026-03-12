"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, Send } from "lucide-react";
import { requestRevisionClientReportSummary } from "@/app/(dashboard)/sites/[siteId]/reports/actions";

export function ClientRevisionRequestButton({ summaryId }: { summaryId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = () => {
    if (!comment.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await requestRevisionClientReportSummary(summaryId, comment.trim());
      if (result.success) {
        setShowForm(false);
        setComment("");
        router.refresh();
      } else {
        setMessage(result.error || "修正依頼に失敗しました");
      }
    });
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-[13px] font-medium text-amber-600 transition-colors hover:bg-amber-100"
      >
        <MessageSquare size={16} />
        修正を依頼
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={14} className="text-amber-500" />
          <span className="text-[13px] font-semibold text-amber-600">修正依頼</span>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(false); setComment(""); setMessage(null); }}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <X size={14} className="text-amber-400" />
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="修正してほしい内容を入力してください..."
        className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-[12px] leading-6 text-gray-700 focus:border-amber-300 focus:outline-none placeholder:text-gray-400"
      />
      {message && (
        <p className="mt-2 text-[12px] text-red-500">{message}</p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !comment.trim()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-[13px] font-bold text-white transition-all hover:bg-amber-600 disabled:opacity-50"
        >
          <Send size={14} />
          {isPending ? "送信中..." : "修正依頼を送信"}
        </button>
      </div>
    </div>
  );
}
