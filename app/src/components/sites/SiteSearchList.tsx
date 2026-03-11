"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  FileText,
  ArrowRight,
  Search,
} from "lucide-react";

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

function getProgressColor(rate: number): { bar: string; text: string } {
  if (rate >= 80) return { bar: "bg-emerald-500", text: "text-emerald-500" };
  if (rate >= 50) return { bar: "bg-amber-500", text: "text-amber-500" };
  return { bar: "bg-red-400", text: "text-red-400" };
}

export function SiteSearchList({ sites }: { sites: SiteItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? sites.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.siteNumber && s.siteNumber.toLowerCase().includes(q)) ||
          s.address.toLowerCase().includes(q)
        );
      })
    : sites;

  return (
    <>
      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="現場名・番号・住所で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
        />
      </div>

      {/* Site list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <Search size={32} className="mb-3 text-gray-200" />
          <p className="text-[14px] text-gray-400">
            {searchQuery ? "検索結果がありません" : "現場がありません"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 shadow-sm">
          {filtered.map((site) => {
            const pc = site.progressRate !== null ? getProgressColor(site.progressRate) : null;
            return (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="group flex items-center gap-3.5 px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                {/* Icon with progress ring */}
                <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                  {site.progressRate !== null ? (
                    <>
                      <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="17" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                        <circle
                          cx="20" cy="20" r="17" fill="none"
                          stroke={site.progressRate >= 80 ? "#10b981" : site.progressRate >= 50 ? "#f59e0b" : "#f87171"}
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(site.progressRate / 100) * 106.8} 106.8`}
                        />
                      </svg>
                      <span className={`text-[10px] font-bold ${pc!.text}`}>{site.progressRate}%</span>
                    </>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-50">
                      <Building2 size={18} className="text-[#0EA5E9]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[14px] text-gray-800 truncate font-medium">{site.name}</p>
                    {site.siteNumber && (
                      <span className="text-[10px] font-mono text-[#0EA5E9]/50 shrink-0">{site.siteNumber}</span>
                    )}
                    <span className={`text-[11px] font-medium shrink-0 px-2 py-0.5 rounded-full ${site.periodBg} ${site.periodColor}`}>
                      {site.periodLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-gray-400">
                    {site.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} className="shrink-0" />
                        {site.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1 shrink-0">
                      <FileText size={11} />
                      {site.reportCount}件
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-200 group-hover:text-gray-400 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
