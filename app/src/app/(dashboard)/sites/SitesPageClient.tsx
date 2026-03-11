"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { AddSiteForm } from "./AddSiteForm";
import { SiteSearchList } from "@/components/sites/SiteSearchList";

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

export function SitesPageClient({
  showCompleted,
  activeCount,
  completedCount,
  siteItems,
  error,
}: {
  showCompleted: boolean;
  activeCount: number;
  completedCount: number;
  siteItems: SiteItem[];
  error: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <>
      {!isAdding ? (
        <div className="flex gap-1.5 mb-5">
          <Link
            href="/sites"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
              !showCompleted
                ? "bg-cyan-100 text-[#0EA5E9] border border-cyan-200"
                : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-500"
            }`}
          >
            稼働中
            <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
              !showCompleted ? "bg-cyan-50 text-[#0EA5E9]" : "bg-gray-100 text-gray-400"
            }`}>{activeCount}</span>
          </Link>
          <Link
            href="/sites?show=completed"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
              showCompleted
                ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-500"
            }`}
          >
            完了
            <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
              showCompleted ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
            }`}>{completedCount}</span>
          </Link>
        </div>
      ) : null}

      {!showCompleted && <AddSiteForm onOpenChange={setIsAdding} />}

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
              {showCompleted ? "完了した現場はありません" : "現場がまだありません"}
            </p>
          </div>
        ) : (
          <SiteSearchList sites={siteItems} />
        )
      ) : null}
    </>
  );
}
