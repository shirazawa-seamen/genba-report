import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileText,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import { WORK_PROCESS_LABELS } from "@/lib/constants";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClientPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
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

  if (profile?.role !== "client") redirect("/");

  const activeTab = tab === "confirmed" ? "confirmed" : "pending";

  // Fetch reports based on tab
  const { data: reports } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, approval_status, progress_rate, sites(name)"
    )
    .eq("approval_status", activeTab === "confirmed" ? "client_confirmed" : "approved")
    .order("report_date", { ascending: false })
    .limit(50);

  // Stats
  const { count: pendingConfirmCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "approved");

  const { count: confirmedCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "client_confirmed");

  // Active sites (use date range instead of status column)
  const today = new Date().toISOString().slice(0, 10);
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, start_date, end_date")
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("name");

  const activeSites = (sites ?? []).filter((s) => {
    if (!s.start_date && !s.end_date) return true;
    const start = s.start_date ?? "0000-01-01";
    const end = s.end_date ?? "9999-12-31";
    return today >= start && today <= end;
  });

  const TABS = [
    { value: "pending", label: "未確認", count: pendingConfirmCount ?? 0, icon: Clock, color: "amber" as const },
    { value: "confirmed", label: "確認済み", count: confirmedCount ?? 0, icon: CheckCircle2, color: "emerald" as const },
  ];

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              確認ダッシュボード
            </h1>
            <p className="text-[13px] text-gray-400">
              承認済み報告の確認・閲覧
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {TABS.map((t) => {
            const isActive = activeTab === t.value;
            const Icon = t.icon;
            const colorClasses = t.color === "amber"
              ? { bg: "bg-amber-50", icon: "text-amber-400", ring: isActive ? "ring-2 ring-amber-300" : "" }
              : { bg: "bg-emerald-50", icon: "text-emerald-400", ring: isActive ? "ring-2 ring-emerald-300" : "" };
            return (
              <Link
                key={t.value}
                href={t.value === "pending" ? "/client" : "/client?tab=confirmed"}
                className={`rounded-2xl border bg-white p-4 flex items-center gap-3.5 transition-all hover:bg-gray-50 shadow-sm ${
                  isActive ? `border-gray-300 ${colorClasses.ring}` : "border-gray-200"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses.bg}`}>
                  <Icon size={20} className={colorClasses.icon} />
                </div>
                <div>
                  <p className="text-[22px] font-bold text-gray-900 leading-tight">
                    {t.count}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t.label}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Active Sites */}
        {activeSites.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-[#0EA5E9]" />
              <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
                稼働中現場
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 border border-cyan-200 px-3 py-1.5 text-[12px] text-[#0EA5E9] hover:bg-cyan-100 transition-colors"
                >
                  <Building2 size={12} />
                  {site.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-[#0EA5E9]" />
            <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
              {activeTab === "confirmed" ? "確認済み報告" : "未確認報告（承認済み）"}
            </h2>
            <span className="text-[11px] text-gray-300">
              ({(reports ?? []).length}件)
            </span>
          </div>

          {!reports || reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <FileText size={32} className="mb-2 text-gray-200" />
              <p className="text-[13px]">
                {activeTab === "confirmed"
                  ? "確認済みの報告はまだありません"
                  : "確認待ちの報告はありません"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const siteName =
                  (report.sites as { name?: string } | null)?.name ?? "不明";
                const isConfirmed =
                  report.approval_status === "client_confirmed";
                const processLabel =
                  WORK_PROCESS_LABELS[report.work_process] ??
                  report.work_process;

                return (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 min-h-[56px] py-3 hover:border-gray-300 transition-colors"
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        isConfirmed
                          ? "bg-emerald-50"
                          : "bg-amber-50"
                      }`}
                    >
                      {isConfirmed ? (
                        <CheckCircle2
                          size={16}
                          className="text-emerald-400"
                        />
                      ) : (
                        <Eye size={16} className="text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-gray-700 truncate">
                        {siteName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={10} />
                          {report.report_date}
                        </span>
                        <span className="text-gray-200">|</span>
                        <span>{processLabel}</span>
                        <span className="text-gray-200">|</span>
                        <span>{report.progress_rate}%</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        isConfirmed
                          ? "text-emerald-400 bg-emerald-50"
                          : "text-amber-400 bg-amber-50"
                      }`}
                    >
                      {isConfirmed ? "確認済み" : "確認待ち"}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 shrink-0"
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
