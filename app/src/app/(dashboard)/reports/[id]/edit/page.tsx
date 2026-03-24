import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { WORK_PROCESS_LABELS } from "@/lib/constants";
import { ReportEditForm } from "./edit-form";
import { canAccessReport } from "@/lib/siteAccess";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Admin check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;
  const isAdminOrManager = userRole === "admin" || userRole === "manager";

  // サイトレベルの認可チェック
  const hasAccess = await canAccessReport(user.id, id);
  if (!hasAccess) notFound();

  // Fetch report
  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, workers, progress_rate, weather, work_hours, arrival_time, departure_time, issues, admin_notes, approval_status, rejection_comment, reporter_id, sites(name)"
    )
    .eq("id", id)
    .single();

  if (error || !report) {
    notFound();
  }

  // 権限チェック: 報告者本人のみ編集可能
  const isReporter = report.reporter_id === user.id;
  if (!isReporter) {
    redirect("/");
  }

  const sites = Array.isArray(report.sites)
    ? report.sites[0]
    : report.sites;
  const siteName = (sites as { name?: string } | null)?.name ?? "不明な現場";
  const processLabel =
    WORK_PROCESS_LABELS[report.work_process] ?? report.work_process;

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href={`/reports/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> 報告詳細
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              報告を編集
            </h1>
            <p className="text-[13px] text-gray-400">
              {siteName} / {report.report_date} / {processLabel}
            </p>
            <p className="mt-1 text-[12px] text-gray-300">
              ここで編集する進捗率は担当者見込みです。公式進捗は1次報告で確定します。
            </p>
          </div>
        </div>

        {/* 差戻し理由の表示 */}
        {report.approval_status === "rejected" && report.rejection_comment && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-[13px] font-semibold text-red-400">差戻し理由</span>
            </div>
            <p className="text-[14px] text-gray-600 whitespace-pre-wrap leading-relaxed">
              {report.rejection_comment as string}
            </p>
          </div>
        )}

        <ReportEditForm
          reportId={id}
          initialData={{
            work_content: report.work_content ?? "",
            workers: (report.workers as string[] | null)?.join("、") ?? "",
            progress_rate: report.progress_rate ?? 0,
            weather: report.weather ?? "",
            arrival_time: (report.arrival_time as string) ?? undefined,
            departure_time: (report.departure_time as string) ?? undefined,
            issues: report.issues ?? "",
            admin_notes: String(report.admin_notes ?? ""),
          }}
        />
      </div>
    </div>
  );
}
