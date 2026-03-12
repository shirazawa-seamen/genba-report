"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from "lucide-react";
import type { SiteReportDay } from "./page";
import { DayReportsModal } from "./day-reports-modal";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ungenerated: { label: "未生成", badge: "bg-gray-100 text-gray-500" },
  draft: { label: "下書き", badge: "bg-amber-100 text-amber-600" },
  rejected: { label: "差戻し", badge: "bg-red-100 text-red-500" },
  submitted: { label: "提出済み", badge: "bg-emerald-100 text-emerald-600" },
  client_confirmed: { label: "確認済み", badge: "bg-blue-100 text-blue-600" },
};

function getSummaryStatus(day: SiteReportDay) {
  if (!day.summary) return "ungenerated";
  return day.summary.status;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

type FilterType = "all" | "actionRequired" | "submitted" | "confirmed";

export function ReportWorkflowDashboard({ days }: { days: SiteReportDay[] }) {
  const [filter, setFilter] = useState<FilterType>("actionRequired");
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [modalDay, setModalDay] = useState<SiteReportDay | null>(null);

  const actionRequiredDays = days.filter((d) => {
    const s = getSummaryStatus(d);
    return s === "ungenerated" || s === "draft" || s === "rejected";
  });
  const submittedDays = days.filter((d) => getSummaryStatus(d) === "submitted");
  const confirmedDays = days.filter((d) => getSummaryStatus(d) === "client_confirmed");

  const filteredDays =
    filter === "actionRequired"
      ? actionRequiredDays
      : filter === "submitted"
        ? submittedDays
        : filter === "confirmed"
          ? confirmedDays
          : days;

  // 現場でグループ化
  const siteGroups = new Map<string, { siteName: string; siteId: string; days: SiteReportDay[] }>();
  for (const day of filteredDays) {
    if (!siteGroups.has(day.siteId)) {
      siteGroups.set(day.siteId, { siteName: day.siteName, siteId: day.siteId, days: [] });
    }
    siteGroups.get(day.siteId)!.days.push(day);
  }

  const toggleSite = (siteId: string) => {
    setExpandedSites((current) => {
      const next = new Set(current);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const FILTERS: Array<{ key: FilterType; label: string; count: number }> = [
    { key: "actionRequired", label: "要対応", count: actionRequiredDays.length },
    { key: "submitted", label: "提出済み", count: submittedDays.length },
    { key: "confirmed", label: "確認済み", count: confirmedDays.length },
    { key: "all", label: "すべて", count: days.length },
  ];

  return (
    <>
      {/* フィルタータブ */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[12px] font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? "bg-[#0EA5E9] text-white shadow-md shadow-sky-200"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* 現場別グループ */}
      {siteGroups.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <FileText size={36} className="mb-3 text-gray-200" />
          <p className="text-[15px]">該当する日報はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(siteGroups.values()).map((group) => {
            const isExpanded = expandedSites.has(group.siteId) || siteGroups.size <= 3;
            return (
              <div key={group.siteId} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* 現場ヘッダー */}
                <button
                  type="button"
                  onClick={() => toggleSite(group.siteId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-50 shrink-0">
                    <Building2 size={16} className="text-[#0EA5E9]" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[14px] font-semibold text-gray-800 truncate">{group.siteName}</p>
                    <p className="text-[11px] text-gray-400">{group.days.length}日分</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                </button>

                {/* 日付一覧 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {group.days.map((day) => {
                      const summaryStatus = getSummaryStatus(day);
                      const config = STATUS_CONFIG[summaryStatus] ?? STATUS_CONFIG.ungenerated;
                      const submittedCount = day.reports.filter((r) => r.approvalStatus === "submitted").length;
                      const approvedCount = day.reports.filter((r) => r.approvalStatus === "approved").length;

                      return (
                        <div
                          key={day.reportDate}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <CalendarDays size={12} className="text-gray-300" />
                              <span className="text-[13px] font-medium text-gray-700">
                                {formatDate(day.reportDate)}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}>
                                {config.label}
                              </span>
                            </div>
                            <div className="flex gap-3 text-[11px] text-gray-400">
                              <span>{day.reports.length}件の報告</span>
                              {submittedCount > 0 && (
                                <span className="text-blue-400">{submittedCount}件 承認待ち</span>
                              )}
                              {approvedCount > 0 && (
                                <span className="text-emerald-400">{approvedCount}件 承認済み</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setModalDay(day)}
                              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
                            >
                              <FileText size={13} />
                              確認
                            </button>
                            <Link
                              href={`/sites/${day.siteId}/reports`}
                              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-cyan-50 px-3 text-[12px] font-medium text-[#0EA5E9] transition-colors hover:bg-cyan-100"
                            >
                              <Sparkles size={13} />
                              サマリー
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* モーダル */}
      {modalDay && (
        <DayReportsModal
          day={modalDay}
          onClose={() => setModalDay(null)}
        />
      )}
    </>
  );
}
