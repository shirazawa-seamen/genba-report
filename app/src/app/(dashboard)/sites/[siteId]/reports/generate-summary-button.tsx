"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateClientReportSummary } from "./actions";

export function GenerateSummaryButton({
  siteId,
  reportDate,
  hasSummary,
}: {
  siteId: string;
  reportDate: string;
  hasSummary: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await generateClientReportSummary(siteId, reportDate);
      if (!result.success) {
        setMessage(result.error || "下書き生成に失敗しました");
        return;
      }
      setMessage("下書きを生成しました");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-50"
      >
        {isPending ? "生成中..." : hasSummary ? "再生成" : "LLMで下書き生成"}
      </button>
      {message ? (
        <p className="text-[11px] text-gray-400">{message}</p>
      ) : null}
    </div>
  );
}
