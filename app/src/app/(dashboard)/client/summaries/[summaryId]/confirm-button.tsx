"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { confirmClientReportSummary } from "@/app/(dashboard)/sites/[siteId]/reports/actions";

export function ClientConfirmButton({ summaryId }: { summaryId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmClientReportSummary(summaryId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "確認に失敗しました");
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0EA5E9] px-5 text-[13px] font-bold text-white shadow-md shadow-sky-200 transition-all hover:bg-[#0284C7] hover:shadow-lg disabled:opacity-50"
      >
        <CheckCircle2 size={16} />
        {isPending ? "確認中..." : "内容を確認しました"}
      </button>
      {error && (
        <p className="mt-2 text-[12px] text-red-500 flex items-center gap-1">
          <AlertTriangle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
