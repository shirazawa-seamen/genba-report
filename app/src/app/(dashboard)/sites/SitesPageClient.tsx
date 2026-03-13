"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { AddSiteForm } from "./AddSiteForm";
import { SiteSearchList } from "@/components/sites/SiteSearchList";
import type { SiteScopeFilter, SiteStatusFilter } from "@/lib/siteAccess";

interface SiteItem {
  id: string;
  name: string;
  siteNumber: string | null;
  address: string;
  reportCount: number;
  periodLabel: string;
  periodColor: string;
  periodBg: string;
  progressRate: number | null;
  processCount: number;
}

interface CompanyOption {
  id: string;
  name: string;
}

export function SitesPageClient({
  userRole,
  activeScope,
  activeStatus,
  statusCounts,
  scopeCounts,
  completedCount,
  activeCount,
  siteItems,
  companies,
  canCreateSite,
  scopeOptions,
  error,
}: {
  userRole: string;
  activeScope: SiteScopeFilter;
  activeStatus: SiteStatusFilter;
  statusCounts: { all: number; active: number; completed: number };
  scopeCounts: Partial<Record<SiteScopeFilter, number>>;
  activeCount: number;
  completedCount: number;
  siteItems: SiteItem[];
  companies: CompanyOption[];
  canCreateSite: boolean;
  scopeOptions: { value: SiteScopeFilter; label: string }[];
  error: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const showScopeFilters =
    userRole === "worker_internal" || userRole === "worker_external" || userRole === "client";

  return (
    <>
      {!isAdding ? (
        <div className="mb-5 space-y-2">
          <div className="flex gap-1.5">
            {[
              { value: "all", label: "すべて", count: statusCounts.all, href: `/sites?scope=${activeScope}` },
              { value: "active", label: "未完了", count: activeCount, href: `/sites?status=active&scope=${activeScope}` },
              { value: "completed", label: "完了", count: completedCount, href: `/sites?status=completed&scope=${activeScope}` },
            ].map((tab) => {
              const isActive = activeStatus === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
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
          {showScopeFilters ? (
            <div className="flex gap-1.5">
              {scopeOptions.map((option) => {
                const isActive = activeScope === option.value;
                const href =
                  option.value === "all"
                    ? `/sites?status=${activeStatus}`
                    : `/sites?status=${activeStatus}&scope=${option.value}`;
                return (
                  <Link
                    key={option.value}
                    href={href}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                      isActive
                        ? "bg-gray-900 text-white border border-gray-900"
                        : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-500"
                    }`}
                  >
                    {option.label}
                    <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                      isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {scopeCounts[option.value] ?? 0}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {canCreateSite && activeStatus !== "completed" ? (
        <AddSiteForm companies={companies} onOpenChange={setIsAdding} />
      ) : null}

      {!isAdding && error ? (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-[13px] text-red-500">データの取得に失敗しました</p>
        </div>
      ) : null}

      {!isAdding ? (
        siteItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <FolderOpen size={36} className="mb-3 text-gray-200" />
            <p className="text-[15px] text-gray-400">
              {activeStatus === "completed" ? "完了した現場はありません" : "現場がまだありません"}
            </p>
          </div>
        ) : (
          <SiteSearchList sites={siteItems} />
        )
      ) : null}
    </>
  );
}
