"use client";

import Link from "next/link";
import { ChevronRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export function ClientSummaryCard({
  summaryId,
  siteName,
  reportDate,
  summaryText,
  status,
}: {
  summaryId: string;
  siteName: string;
  reportDate: string;
  summaryText: string;
  status: string;
}) {
  return (
    <Link
      href={`/client/summaries/${summaryId}`}
      className="block rounded-xl border border-gray-200 bg-white px-4 py-4 transition-colors hover:bg-gray-50/50"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-gray-700">{siteName}</p>
          <p className="text-[11px] text-gray-400">{reportDate}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            status === "client_confirmed"
              ? "bg-emerald-50 text-emerald-500"
              : status === "revision_requested"
                ? "bg-orange-50 text-orange-500"
                : "bg-amber-50 text-amber-500"
          }`}
        >
          {status === "client_confirmed" ? (
            <span className="flex items-center gap-1"><CheckCircle2 size={10} /> 確認済み</span>
          ) : status === "revision_requested" ? (
            <span className="flex items-center gap-1"><AlertTriangle size={10} /> 修正依頼中</span>
          ) : (
            <span className="flex items-center gap-1"><Clock size={10} /> 確認待ち</span>
          )}
        </span>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap text-[12px] leading-6 text-gray-500">
        {summaryText}
      </p>
      <div className="mt-3 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0EA5E9]/70">
          詳細を見る
          <ChevronRight size={12} />
        </span>
      </div>
    </Link>
  );
}
