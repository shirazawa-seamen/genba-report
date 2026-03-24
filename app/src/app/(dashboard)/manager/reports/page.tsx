import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReportWorkflowDashboard } from "./report-workflow-dashboard";

interface DailyReport {
  id: string;
  site_id: string;
  report_date: string;
  work_process: string;
  work_content: string;
  issues: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  created_at: string;
  progress_rate: number;
  approval_status: string;
  reporter_id: string | null;
  process_id: string | null;
  processes: { name: string } | null;
}

interface SummaryRecord {
  id: string;
  site_id: string;
  report_date: string;
  summary_text: string;
  status: string;
  official_progress: Array<{
    processId?: string;
    processName?: string;
    progressRate?: number;
  }> | null;
}

export interface SiteReportDay {
  siteId: string;
  siteName: string;
  siteNumber: string | null;
  reportDate: string;
  reports: Array<{
    id: string;
    processId: string | null;
    processName: string;
    progressRate: number;
    workContent: string;
    issues: string | null;
    arrivalTime: string | null;
    departureTime: string | null;
    approvalStatus: string;
    reporterName: string;
    createdAt: string;
  }>;
  summary: {
    id: string;
    summaryText: string;
    status: string;
    officialProgress: Array<{
      processId: string;
      processName: string;
      progressRate: number;
    }>;
  } | null;
}

interface PageProps {
  searchParams: Promise<{ filter?: string; site?: string }>;
}

export default async function ManagerReportsPage({ searchParams }: PageProps) {
  const { filter: initialFilter, site: siteFilter } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/");

  // 全現場の報告を取得（提出済み以上）
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, site_id, report_date, work_process, work_content, issues, arrival_time, departure_time, created_at, progress_rate, approval_status, reporter_id, process_id, processes(name)")
    .in("approval_status", ["submitted", "approved", "rejected"])
    .order("report_date", { ascending: false })
    .limit(500);

  const reportList = (reports as DailyReport[] | null) ?? [];

  // 報告者名を取得
  const reporterIds = [...new Set(reportList.map((r) => r.reporter_id).filter(Boolean))] as string[];
  const { data: reporters } = reporterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", reporterIds)
    : { data: [] };
  const reporterMap = new Map((reporters ?? []).map((r) => [r.id, r.full_name ?? "不明"]));

  // 現場名を取得
  const siteIds = [...new Set(reportList.map((r) => r.site_id))];
  const { data: sites } = siteIds.length
    ? await supabase.from("sites").select("id, name, site_number").in("id", siteIds)
    : { data: [] };
  const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const siteNumberMap = new Map((sites ?? []).map((s) => [s.id, s.site_number as string | null]));

  // サマリーを取得
  const { data: summaries } = siteIds.length
    ? await supabase
        .from("client_report_summaries")
        .select("id, site_id, report_date, summary_text, status, official_progress")
        .in("site_id", siteIds)
    : { data: [] };
  const summaryMap = new Map(
    ((summaries as SummaryRecord[] | null) ?? []).map((s) => [`${s.site_id}_${s.report_date}`, s])
  );

  // site_id + report_date でグループ化
  const dayMap = new Map<string, SiteReportDay>();
  for (const r of reportList) {
    const key = `${r.site_id}_${r.report_date}`;
    if (!dayMap.has(key)) {
      const summary = summaryMap.get(key);
      dayMap.set(key, {
        siteId: r.site_id,
        siteName: siteMap.get(r.site_id) ?? "不明な現場",
        siteNumber: siteNumberMap.get(r.site_id) ?? null,
        reportDate: r.report_date,
        reports: [],
        summary: summary
          ? {
              id: summary.id,
              summaryText: summary.summary_text,
              status: summary.status,
              officialProgress: (summary.official_progress ?? []).map((item) => ({
                processId: item.processId ?? item.processName ?? "",
                processName: item.processName ?? item.processId ?? "工程未設定",
                progressRate: item.progressRate ?? 0,
              })),
            }
          : null,
      });
    }
    dayMap.get(key)!.reports.push({
      id: r.id,
      processId: r.process_id ?? null,
      processName: r.processes?.name ?? r.work_process,
      progressRate: r.progress_rate ?? 0,
      workContent: r.work_content ?? "",
      issues: r.issues ?? null,
      arrivalTime: r.arrival_time ?? null,
      departureTime: r.departure_time ?? null,
      approvalStatus: r.approval_status,
      reporterName: r.reporter_id ? reporterMap.get(r.reporter_id) ?? "不明" : "不明",
      createdAt: r.created_at,
    });
  }

  // 未処理優先でソート
  const allDays = Array.from(dayMap.values()).sort((a, b) => {
    const priority = (day: SiteReportDay) => {
      if (!day.summary) return 0; // サマリー未生成
      if (day.summary.status === "draft") return 1;
      if (day.summary.status === "rejected") return 1;
      if (day.summary.status === "submitted") return 2;
      return 3; // confirmed
    };
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return b.reportDate.localeCompare(a.reportDate);
  });

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> ホーム
        </Link>

        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
            1次報告
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            2次報告の確認・承認 → 1次報告の作成・提出
          </p>
        </div>

        <ReportWorkflowDashboard days={allDays} initialFilter={initialFilter} initialSiteId={siteFilter} />
      </div>
    </div>
  );
}
