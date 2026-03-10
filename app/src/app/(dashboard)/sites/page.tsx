import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2,
  MapPin,
  FileText,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { AddSiteForm } from "./AddSiteForm";

interface SiteWithReportCount {
  id: string;
  name: string;
  address: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  report_count: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "未設定";
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function getPeriodLabel(startDate: string | null, endDate: string | null): { label: string; color: string; bg: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate) return { label: "未定", color: "text-white/35", bg: "bg-white/[0.06]" };
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (today < start) return { label: "着工前", color: "text-blue-400", bg: "bg-blue-500/10" };
  if (end && today > end) return { label: "完了", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  return { label: "施工中", color: "text-[#00D9FF]", bg: "bg-[#00D9FF]/10" };
}

export default async function SitesPage() {
  const supabase = await createClient();

  const { data: sites, error } = await supabase
    .from("sites")
    .select(`id, name, address, start_date, end_date, created_at, daily_reports(count)`)
    .order("created_at", { ascending: false });

  const siteList: SiteWithReportCount[] = (sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address,
    start_date: site.start_date,
    end_date: site.end_date,
    created_at: site.created_at,
    report_count: (site.daily_reports as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white/95">現場一覧</h1>
          <p className="text-[13px] text-white/35 mt-0.5">{siteList.length}件の現場</p>
        </div>
      </div>

      {/* 現場追加フォーム */}
      <AddSiteForm />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[13px] text-red-400">データの取得に失敗しました</p>
        </div>
      )}

      {siteList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/25 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <FolderOpen size={36} className="mb-3 text-white/15" />
          <p className="text-[15px]">現場がまだありません</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
          {siteList.map((site) => {
            const period = getPeriodLabel(site.start_date, site.end_date);
            return (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="group flex items-center gap-3.5 px-4 py-4 hover:bg-white/[0.03] transition-colors active:bg-white/[0.05]"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00D9FF]/10 shrink-0">
                  <Building2 size={18} className="text-[#00D9FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[14px] text-white/85 truncate font-medium">{site.name}</p>
                    <span className={`text-[11px] font-medium shrink-0 px-2 py-0.5 rounded-full ${period.bg} ${period.color}`}>
                      {period.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-white/35">
                    {site.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} className="shrink-0" />
                        {site.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1 shrink-0">
                      <FileText size={11} />
                      {site.report_count}件
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-white/15 group-hover:text-white/30 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
