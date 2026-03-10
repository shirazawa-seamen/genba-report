import { createClient } from "@/lib/supabase/server";
import { WORK_PROCESS_LABELS } from "@/lib/constants";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft, ArrowRight, FileText } from "lucide-react";

interface DailyReport {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  processes: { name: string } | null;
}

interface PageProps { params: Promise<{ siteId: string }> }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
}

function progressText(r: number) {
  if (r >= 80) return "text-emerald-400";
  if (r >= 50) return "text-[#00D9FF]";
  return "text-red-400";
}

export default async function SiteReportsPage({ params }: PageProps) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site, error: siteError } = await supabase
    .from("sites").select("id, name").eq("id", siteId).single();

  if (siteError || !site) notFound();

  const { data: reports } = await supabase
    .from("daily_reports")
    .select(`id, report_date, work_process, progress_rate, work_content, processes(name)`)
    .eq("site_id", siteId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  const reportList = (reports as DailyReport[] | null) ?? [];

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      <Link href={`/sites/${siteId}`} className="inline-flex items-center gap-1.5 text-[13px] text-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors mb-6 w-fit min-h-[44px]">
        <ArrowLeft size={14} /> {site.name}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-white/95">報告一覧</h1>
          <p className="text-[13px] text-white/35 mt-0.5">{site.name} / {reportList.length}件</p>
        </div>
        <Link
          href={`/reports/new?siteId=${siteId}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#00D9FF] text-[#0e0e0e] text-[13px] font-semibold hover:bg-[#00c4e6] transition-colors active:scale-[0.98]"
        >
          <Plus size={16} /> 新規報告
        </Link>
      </div>

      {reportList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/25 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <FileText size={36} className="mb-3 text-white/15" />
          <p className="text-[15px] mb-5">報告がまだありません</p>
          <Link
            href={`/reports/new?siteId=${siteId}`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#00D9FF] text-[#0e0e0e] text-[13px] font-semibold hover:bg-[#00c4e6] transition-colors"
          >
            <Plus size={16} /> 最初の報告を作成
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
          {reportList.map((r) => {
            const processName = r.processes?.name ?? WORK_PROCESS_LABELS[r.work_process] ?? r.work_process;
            const rate = r.progress_rate ?? 0;
            return (
              <Link key={r.id} href={`/reports/${r.id}`} className="group flex items-center gap-3 px-4 py-4 hover:bg-white/[0.03] transition-colors active:bg-white/[0.05]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] text-white/85 font-medium">{formatDate(r.report_date)}</p>
                    <span className={`text-[12px] font-semibold ${progressText(rate)}`}>{rate}%</span>
                  </div>
                  <p className="text-[12px] text-white/35 mt-0.5">{processName}</p>
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
