"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Search,
  ChevronDown,
  Users,
} from "lucide-react";

interface ReportItem {
  id: string;
  siteName: string;
  processName: string;
  reportDate: string;
  formattedDate: string;
  status: string;
  statusLabel: string;
  progressRate: number;
  reporterName: string | null;
}

interface StatusTab {
  value: string;
  label: string;
  count: number;
}

function StatusIcon({ status }: { status: string }) {
  const map: Record<string, { color: string; Icon: React.ElementType }> = {
    submitted: { color: "text-blue-500", Icon: Clock },
    approved: { color: "text-emerald-500", Icon: CheckCircle2 },
    client_confirmed: { color: "text-[#0EA5E9]", Icon: CheckCircle2 },
    rejected: { color: "text-red-500", Icon: AlertTriangle },
    draft: { color: "text-gray-300", Icon: FileText },
  };
  const { color, Icon } = map[status] ?? map.draft;
  return <Icon size={16} className={`shrink-0 ${color}`} />;
}

export function ReportSearchList({
  reports,
  statusTabs,
  activeFilter,
  scope,
  currentPage,
  totalPages,
}: {
  reports: ReportItem[];
  statusTabs: StatusTab[];
  activeFilter: string | null;
  scope?: string | null;
  currentPage: number;
  totalPages: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const getReportsHref = (status: string | null, page?: number) => {
    const params = new URLSearchParams();
    if (status && status !== "all") {
      params.set("status", status);
    }
    if (scope && scope !== "all") {
      params.set("scope", scope);
    }
    if (page && page > 1) {
      params.set("page", String(page));
    }
    const query = params.toString();
    return query ? `/reports?${query}` : "/reports";
  };

  const filtered = searchQuery.trim()
    ? reports.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.siteName.toLowerCase().includes(q) ||
          r.processName.toLowerCase().includes(q) ||
          r.reportDate.includes(q) ||
          r.formattedDate.includes(q) ||
          (r.reporterName && r.reporterName.toLowerCase().includes(q))
        );
      })
    : reports;

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="現場名・工程・報告者で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
        />
      </div>

      {/* Status Filter - Desktop: tabs, Mobile: dropdown */}
      {/* Desktop tabs */}
      <div className="hidden md:flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide mb-5">
        {statusTabs.map((tab) => {
          const isActive = (activeFilter ?? "all") === tab.value || (!activeFilter && tab.value === "all");
          return (
            <Link
              key={tab.value}
              href={getReportsHref(tab.value, 1)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-cyan-100 text-[#0EA5E9] border border-cyan-200"
                  : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-500"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                isActive ? "bg-cyan-50 text-[#0EA5E9]" : "bg-gray-100 text-gray-400"
              }`}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Mobile dropdown */}
      <div className="md:hidden mb-5">
        <div className="relative">
          <select
            defaultValue={activeFilter ?? "all"}
            onChange={(e) => {
              const val = e.target.value;
              router.replace(getReportsHref(val, 1));
            }}
            className="w-full min-h-[44px] pl-4 pr-10 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-700 appearance-none focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
          >
            {statusTabs.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label} ({tab.count})
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Report list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <Search size={32} className="mb-3 text-gray-200" />
          <p className="text-[14px] text-gray-400">
            {searchQuery ? "検索結果がありません" : "報告がありません"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 shadow-sm">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className={`group flex items-center gap-3 px-4 py-4 transition-colors active:bg-gray-100 ${
                r.status === "rejected"
                  ? "bg-red-50/50 hover:bg-red-50 border-l-2 border-l-red-300"
                  : "hover:bg-gray-50"
              }`}
            >
              <StatusIcon status={r.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] text-gray-800 truncate font-medium">{r.siteName}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">{r.formattedDate}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] text-gray-400 truncate max-w-[180px]">{r.processName}</span>
                  <span className="text-[11px] text-gray-200">|</span>
                  <span className="text-[12px] text-[#0EA5E9]">平均 {r.progressRate}%</span>
                  {r.reporterName && (
                    <>
                      <span className="text-[11px] text-gray-200">|</span>
                      <span className="text-[12px] text-gray-400 flex items-center gap-1">
                        <Users size={10} />
                        {r.reporterName}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-gray-400">{r.statusLabel}</span>
                <ArrowRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href={getReportsHref(activeFilter, Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            className={`inline-flex items-center gap-1 text-[12px] font-medium ${
              currentPage <= 1 ? "pointer-events-none text-gray-300" : "text-gray-500 hover:text-[#0EA5E9]"
            }`}
          >
            前へ
          </Link>
          <span className="text-[12px] text-gray-400">
            {currentPage} / {totalPages}
          </span>
          <Link
            href={getReportsHref(activeFilter, Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            className={`inline-flex items-center gap-1 text-[12px] font-medium ${
              currentPage >= totalPages ? "pointer-events-none text-gray-300" : "text-gray-500 hover:text-[#0EA5E9]"
            }`}
          >
            次へ
          </Link>
        </div>
      )}
    </>
  );
}
