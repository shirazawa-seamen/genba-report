"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User, Camera, FileText, Clock, CheckCircle2, XCircle, Edit3, Image as ImageIcon, Video,
} from "lucide-react";
import { PhotoGallery, type PhotoItem } from "@/components/ui/PhotoGallery";

interface ReportItem {
  id: string;
  siteName: string;
  processNames: string;
  reportDate: string;
  status: string;
  statusLabel: string;
  progressRate: number;
}

interface PhotoData {
  id: string;
  url: string;
  photoType: string;
  photoTypeLabel: string;
  caption: string | null;
  mediaType: string;
  reportDate: string;
  siteName: string;
  reportId: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  submitted: "bg-blue-50 text-blue-500",
  approved: "bg-emerald-50 text-emerald-500",
  client_confirmed: "bg-cyan-50 text-[#0EA5E9]",
  rejected: "bg-red-50 text-red-400",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft: Edit3,
  submitted: Clock,
  approved: CheckCircle2,
  client_confirmed: CheckCircle2,
  rejected: XCircle,
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function MyPageContent({
  displayName,
  totalReports,
  totalPhotos,
  draftCount,
  reports,
  photos,
}: {
  displayName: string;
  totalReports: number;
  totalPhotos: number;
  draftCount: number;
  reports: ReportItem[];
  photos: PhotoData[];
}) {
  const [activeTab, setActiveTab] = useState<"photos" | "reports">("reports");

  const tabs = [
    { key: "photos" as const, label: "写真", count: totalPhotos, Icon: Camera },
    { key: "reports" as const, label: "報告一覧", count: totalReports, Icon: FileText },
  ];

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0EA5E9]/10">
            <User size={28} className="text-[#0EA5E9]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">{displayName}</h1>
            <p className="text-[13px] text-gray-400">マイページ</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-[22px] font-bold text-gray-900">{totalReports}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">報告数</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-[22px] font-bold text-gray-900">{totalPhotos}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">写真数</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-[22px] font-bold text-amber-500">{draftCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">下書き</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <tab.Icon size={14} />
            {tab.label}
            <span className={`ml-1 text-[11px] rounded-full px-1.5 py-0.5 ${
              activeTab === tab.key ? "bg-[#0EA5E9]/10 text-[#0EA5E9]" : "bg-gray-200 text-gray-400"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "photos" ? (
        <PhotosTab photos={photos} />
      ) : (
        <ReportsTab reports={reports} />
      )}
    </div>
  );
}

function PhotosTab({ photos }: { photos: PhotoData[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
          <ImageIcon size={28} className="text-gray-300" />
        </div>
        <p className="text-[15px] font-medium text-gray-400">写真がありません</p>
        <p className="text-[13px] text-gray-300 mt-1">報告に写真を添付すると、ここに表示されます</p>
      </div>
    );
  }

  // 現場ごとにグループ化
  const bySite = new Map<string, PhotoData[]>();
  for (const p of photos) {
    if (!bySite.has(p.siteName)) bySite.set(p.siteName, []);
    bySite.get(p.siteName)!.push(p);
  }

  return (
    <div className="space-y-8">
      {Array.from(bySite.entries()).map(([siteName, sitePhotos]) => (
        <div key={siteName}>
          <h3 className="text-[14px] font-semibold text-gray-700 mb-3">{siteName}</h3>
          <PhotoGallery
            photos={sitePhotos.map((p): PhotoItem => ({
              id: p.id,
              url: p.url,
              caption: p.caption,
              mediaType: p.mediaType,
              label: `${p.photoTypeLabel} - ${formatDate(p.reportDate)}`,
            }))}
            columns={3}
            aspect="square"
          />
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ reports }: { reports: ReportItem[] }) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
          <FileText size={28} className="text-gray-300" />
        </div>
        <p className="text-[15px] font-medium text-gray-400">報告がありません</p>
        <p className="text-[13px] text-gray-300 mt-1">
          <Link href="/reports/new" className="text-[#0EA5E9] hover:underline">新規報告を作成</Link>しましょう
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => {
        const StatusIcon = STATUS_ICONS[report.status] ?? Clock;
        return (
          <Link
            key={report.id}
            href={`/reports/${report.id}`}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-cyan-200 hover:bg-cyan-50/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold text-gray-800 truncate">
                  {report.siteName}
                </span>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  STATUS_STYLES[report.status] ?? "bg-gray-100 text-gray-400"
                }`}>
                  <StatusIcon size={10} />
                  {report.statusLabel}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 truncate">
                {report.processNames}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-medium text-gray-600">
                {formatDate(report.reportDate)}
              </p>
              <p className="text-[11px] text-gray-400">
                進捗 {report.progressRate}%
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
