import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WORK_PROCESS_LABELS } from "@/lib/constants";
import { ReportEditForm } from "./edit-form";

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

  if (profile?.role !== "admin" && profile?.role !== "manager") redirect("/");

  // Fetch report
  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, workers, progress_rate, weather, work_hours, issues, admin_notes, approval_status, sites(name)"
    )
    .eq("id", id)
    .single();

  if (error || !report) {
    notFound();
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
          </div>
        </div>

        <ReportEditForm
          reportId={id}
          initialData={{
            work_content: report.work_content ?? "",
            workers: (report.workers as string[] | null)?.join("、") ?? "",
            progress_rate: report.progress_rate ?? 0,
            weather: report.weather ?? "",
            work_hours: report.work_hours ?? undefined,
            issues: report.issues ?? "",
            admin_notes: String(report.admin_notes ?? ""),
          }}
        />
      </div>
    </div>
  );
}
