import { createClient } from "@/lib/supabase/server";
import { WORK_PROCESS_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
} from "lucide-react";

interface DailyReportWithSite {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  created_at: string;
  approval_status: string;
  sites: { name: string } | null;
  processes: { name: string } | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
}

function StatusIcon({ status }: { status: string }) {
  const map: Record<string, { color: string; Icon: React.ElementType }> = {
    submitted: { color: "text-blue-400", Icon: Clock },
    admin_approved: { color: "text-emerald-400", Icon: CheckCircle2 },
    orderer_confirmed: { color: "text-[#00D9FF]", Icon: CheckCircle2 },
    rejected: { color: "text-red-400", Icon: AlertTriangle },
    draft: { color: "text-white/25", Icon: FileText },
  };
  const { color, Icon } = map[status] ?? map.draft;
  return <Icon size={16} className={`shrink-0 ${color}`} />;
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select(`id, report_date, work_process, progress_rate, work_content, created_at, approval_status, sites(name), processes(name)`)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  const reportList = (reports as DailyReportWithSite[] | null) ?? [];

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white/95">報告一覧</h1>
          <p className="text-[13px] text-white/35 mt-0.5">{reportList.length}件の報告</p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#00D9FF] text-[#0e0e0e] text-[13px] font-semibold hover:bg-[#00c4e6] transition-colors active:scale-[0.98]"
        >
          <Plus size={16} />
          新規報告
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[13px] text-red-400">データの取得に失敗しました</p>
        </div>
      )}

      {reportList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/25 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <FileText size={36} className="mb-3 text-white/15" />
          <p className="text-[15px] mb-5">報告がまだありません</p>
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#00D9FF] text-[#0e0e0e] text-[13px] font-semibold hover:bg-[#00c4e6] transition-colors"
          >
            <Plus size={16} />
            最初の報告を作成
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
          {reportList.map((r) => {
            const siteName = r.sites?.name ?? "不明な現場";
            const processName = r.processes?.name ?? WORK_PROCESS_LABELS[r.work_process] ?? r.work_process;
            const status = r.approval_status ?? "draft";
            const statusLabel = APPROVAL_STATUS_LABELS[status] ?? status;

            return (
              <Link
                key={r.id}
                href={`/reports/${r.id}`}
                className="group flex items-center gap-3 px-4 py-4 hover:bg-white/[0.03] transition-colors active:bg-white/[0.05]"
              >
                <StatusIcon status={status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] text-white/85 truncate font-medium">{siteName}</p>
                    <span className="text-[11px] text-white/30 shrink-0">{formatDate(r.report_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] text-white/35">{processName}</span>
                    <span className="text-[11px] text-white/15">|</span>
                    <span className="text-[12px] text-[#00D9FF]/70">{r.progress_rate}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-white/30">{statusLabel}</span>
                  <ArrowRight size={14} className="text-white/15 group-hover:text-white/30 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
