import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Building2,
  FileText,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { APPROVAL_STATUS_LABELS, WORK_PROCESS_LABELS } from "@/lib/constants";

export default async function OrdererPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "orderer") redirect("/");

  // Fetch approved and confirmed reports
  const { data: reports } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, approval_status, progress_rate, site:sites(name)"
    )
    .in("approval_status", ["admin_approved", "orderer_confirmed"])
    .order("report_date", { ascending: false })
    .limit(50);

  // Stats
  const { count: pendingConfirmCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "admin_approved");

  const { count: confirmedCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "orderer_confirmed");

  // Active sites
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, status")
    .eq("status", "active")
    .order("name");

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D9FF]">
            <CheckSquare size={24} className="text-[#0e0e0e]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white/95 tracking-tight">
              確認ダッシュボード
            </h1>
            <p className="text-[13px] text-white/40">
              承認済み報告の確認・閲覧
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[22px] font-bold text-white/90 leading-tight">
                {pendingConfirmCount ?? 0}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">未確認報告</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[22px] font-bold text-white/90 leading-tight">
                {confirmedCount ?? 0}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">確認済み</p>
            </div>
          </div>
        </div>

        {/* Active Sites */}
        {sites && sites.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-[#00D9FF]" />
              <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
                稼働中現場
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00D9FF]/[0.06] border border-[#00D9FF]/10 px-3 py-1.5 text-[12px] text-[#00D9FF]/80 hover:bg-[#00D9FF]/[0.12] transition-colors"
                >
                  <Building2 size={12} />
                  {site.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-[#00D9FF]" />
            <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
              承認済み報告
            </h2>
          </div>

          {!reports || reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-white/30">
              <FileText size={32} className="mb-2 text-white/15" />
              <p className="text-[13px]">承認済みの報告はまだありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const siteName =
                  (report.site as { name?: string } | null)?.name ?? "不明";
                const isConfirmed =
                  report.approval_status === "orderer_confirmed";
                const processLabel =
                  WORK_PROCESS_LABELS[report.work_process] ??
                  report.work_process;

                return (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 min-h-[56px] py-3 hover:border-white/[0.1] transition-colors"
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        isConfirmed
                          ? "bg-emerald-500/10"
                          : "bg-amber-500/10"
                      }`}
                    >
                      {isConfirmed ? (
                        <CheckCircle2
                          size={16}
                          className="text-emerald-400"
                        />
                      ) : (
                        <Clock size={16} className="text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/80 truncate">
                        {siteName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-white/35">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={10} />
                          {report.report_date}
                        </span>
                        <span className="text-white/15">|</span>
                        <span>{processLabel}</span>
                        <span className="text-white/15">|</span>
                        <span>{report.progress_rate}%</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        isConfirmed
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {APPROVAL_STATUS_LABELS[report.approval_status] ??
                        report.approval_status}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-white/20 shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
