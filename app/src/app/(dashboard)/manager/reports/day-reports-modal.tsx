"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react";
import { approveReport, rejectReport } from "@/app/(dashboard)/reports/[id]/actions";
import type { SiteReportDay } from "./page";

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; badge: string; Icon: React.ElementType }> = {
  submitted: { label: "承認待ち", badge: "bg-blue-50 text-blue-500", Icon: Clock },
  approved: { label: "承認済み", badge: "bg-emerald-50 text-emerald-500", Icon: CheckCircle2 },
  rejected: { label: "差戻し", badge: "bg-red-50 text-red-500", Icon: XCircle },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function DayReportsModal({
  day,
  onClose,
}: {
  day: SiteReportDay;
  onClose: () => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApprove = (reportId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await approveReport(reportId);
      if (result.success) {
        setMessage("承認しました");
      } else {
        setMessage(result.error || "承認に失敗しました");
      }
    });
  };

  const handleReject = (reportId: string) => {
    if (!rejectReason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await rejectReport(reportId, rejectReason.trim());
      if (result.success) {
        setMessage("差し戻しました");
        setRejectingId(null);
        setRejectReason("");
      } else {
        setMessage(result.error || "差し戻しに失敗しました");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-4 pt-[10vh] overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">{day.siteName}</h2>
            <p className="text-[12px] text-gray-400">{formatDate(day.reportDate)} / {day.reports.length}件の報告</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mx-5 mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-600">
            {message}
          </div>
        )}

        {/* Reports */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {day.reports.map((report) => {
            const statusConfig = APPROVAL_STATUS_CONFIG[report.approvalStatus] ?? APPROVAL_STATUS_CONFIG.submitted;
            const StatusIcon = statusConfig.Icon;

            return (
              <div key={report.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-gray-800">{report.processName}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConfig.badge}`}>
                        <StatusIcon size={10} />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      報告者: {report.reporterName} / 進捗: {report.progressRate}%
                    </p>
                  </div>
                  <Link
                    href={`/reports/${report.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors shrink-0"
                  >
                    <ExternalLink size={11} />
                    詳細
                  </Link>
                </div>

                <div className="rounded-xl bg-gray-50 px-3 py-2 mb-3">
                  <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {report.workContent || "（作業内容なし）"}
                  </p>
                </div>

                {report.approvalStatus === "submitted" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(report.id)}
                      disabled={isPending}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-emerald-500 px-3 text-[12px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                      承認
                    </button>
                    {rejectingId === report.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="差し戻し理由..."
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-[12px] focus:border-red-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleReject(report.id)}
                          disabled={isPending || !rejectReason.trim()}
                          className="inline-flex min-h-[32px] items-center rounded-xl bg-red-500 px-3 text-[12px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          差戻し
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="inline-flex min-h-[32px] items-center rounded-xl border border-gray-200 px-2 text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRejectingId(report.id)}
                        disabled={isPending}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-medium text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <XCircle size={12} />
                        差戻し
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
          <Link
            href={`/sites/${day.siteId}/reports`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0EA5E9] hover:underline"
          >
            <FileText size={13} />
            現場報告ページでサマリーを作成
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
