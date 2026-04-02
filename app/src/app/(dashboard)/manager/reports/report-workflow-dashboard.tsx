"use client";

import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  X,
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

type FilterType = "all" | "actionRequired" | "submitted";

export function ReportWorkflowDashboard({ days, initialFilter, initialSiteId, mySiteIds }: { days: SiteReportDay[]; initialFilter?: string; initialSiteId?: string; mySiteIds?: string[] }) {
  const [filter, setFilter] = useState<FilterType>(
    (initialFilter === "all" || initialFilter === "actionRequired" || initialFilter === "submitted")
      ? initialFilter : "actionRequired"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [siteIdFilter, setSiteIdFilter] = useState<string | null>(initialSiteId ?? null);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(() => initialSiteId ? new Set([initialSiteId]) : new Set());
  const [modalDay, setModalDay] = useState<SiteReportDay | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine">("all");

  const mySiteIdSet = new Set(mySiteIds ?? []);

  // まずスコープフィルタ、サイトIDフィルタとキーワード検索を適用
  let baseDays = scopeFilter === "mine" && mySiteIdSet.size > 0
    ? days.filter((d) => mySiteIdSet.has(d.siteId))
    : days;

  if (siteIdFilter) {
    baseDays = baseDays.filter((d) => d.siteId === siteIdFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    baseDays = baseDays.filter((d) =>
      d.siteName.toLowerCase().includes(q) ||
      (d.siteNumber && d.siteNumber.toLowerCase().includes(q)) ||
      d.reports.some((r) => r.reporterName.toLowerCase().includes(q) || r.workContent.toLowerCase().includes(q))
    );
  }

  // フィルタ後の件数を計算
  const actionRequiredDays = baseDays.filter((d) => {
    const s = getSummaryStatus(d);
    return s === "ungenerated" || s === "draft" || s === "rejected";
  });
  const submittedDays = baseDays.filter((d) => {
    const s = getSummaryStatus(d);
    return s === "submitted" || s === "client_confirmed";
  });

  const filteredDays =
    filter === "actionRequired"
      ? actionRequiredDays
      : filter === "submitted"
        ? submittedDays
        : baseDays;

  // 現場でグループ化
  const siteGroups = new Map<string, { siteName: string; siteNumber: string | null; siteId: string; days: SiteReportDay[] }>();
  for (const day of filteredDays) {
    if (!siteGroups.has(day.siteId)) {
      siteGroups.set(day.siteId, { siteName: day.siteName, siteNumber: day.siteNumber, siteId: day.siteId, days: [] });
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
    { key: "all", label: "すべて", count: baseDays.length },
  ];

  const activeSite = siteIdFilter ? days.find((d) => d.siteId === siteIdFilter) : null;
  const activeSiteName = activeSite?.siteName ?? null;
  const activeSiteNumber = activeSite?.siteNumber ?? null;

  return (
    <>
      {/* スコープフィルタ（自分の現場 / すべて） */}
      {mySiteIds && mySiteIds.length > 0 && (
        <div className="flex gap-2 mb-3">
          {([["mine", "自分の現場"], ["all", "すべて"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScopeFilter(key)}
              className={`inline-flex min-h-[32px] items-center rounded-lg px-3 text-[12px] font-medium transition-colors ${
                scopeFilter === key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 検索バー */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="現場名・報告者名・作業内容で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
        />
      </div>

      {/* サイトフィルタ表示 */}
      {siteIdFilter && activeSiteName && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-3 py-1.5 text-[12px] font-medium text-[#0EA5E9]">
            <Building2 size={12} />
            {activeSiteNumber && <span className="text-[10px] text-cyan-500">{activeSiteNumber}</span>}
            {activeSiteName}
          </span>
          <button type="button" onClick={() => { setSiteIdFilter(null); setExpandedSites(new Set()); }}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors">
            <X size={11} /> 解除
          </button>
        </div>
      )}

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
            const isExpanded = expandedSites.has(group.siteId);
            return (
              <div key={group.siteId} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* 現場ヘッダー */}
                <button
                  type="button"
                  onClick={() => toggleSite(group.siteId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[14px] font-semibold text-gray-800 truncate">
                      {group.siteNumber && <span className="text-[11px] text-gray-400 mr-1.5">{group.siteNumber}</span>}
                      {group.siteName}
                    </p>
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
                      const submittedReporters = new Set(day.reports.filter((r) => r.approvalStatus === "submitted").map((r) => r.reporterName));
                      const approvedReporters = new Set(day.reports.filter((r) => r.approvalStatus === "approved").map((r) => r.reporterName));

                      return (
                        <button
                          type="button"
                          key={day.reportDate}
                          onClick={() => setModalDay(day)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left active:bg-gray-100"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[13px] font-medium text-gray-700">
                                {formatDate(day.reportDate)}
                              </span>
                            </div>
                            <div className="flex gap-3 text-[11px] text-gray-400">
                              <span>{new Set(day.reports.map((r) => r.reporterName)).size}名の報告</span>
                              {submittedReporters.size > 0 && (
                                <span className="text-blue-400">{submittedReporters.size}名 承認待ち</span>
                              )}
                              {approvedReporters.size > 0 && (
                                <span className="text-emerald-400">{approvedReporters.size}名 承認済み</span>
                              )}
                            </div>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${config.badge}`}>
                            {config.label}
                          </span>
                        </button>
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
