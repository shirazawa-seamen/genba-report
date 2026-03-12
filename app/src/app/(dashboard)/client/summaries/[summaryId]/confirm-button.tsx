"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { confirmClientReportSummary } from "@/app/(dashboard)/sites/[siteId]/reports/actions";

export function ClientConfirmButton({ summaryId }: { summaryId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmClientReportSummary(summaryId);
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={isPending}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0EA5E9] px-5 text-[13px] font-bold text-white shadow-md shadow-sky-200 transition-all hover:bg-[#0284C7] hover:shadow-lg disabled:opacity-50"
    >
      <CheckCircle2 size={16} />
      {isPending ? "確認中..." : "内容を確認しました"}
    </button>
  );
}
