import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_PROCESS_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";
import { Plus, FileText, Filter } from "lucide-react";
import { ReportSearchList } from "@/components/reports/ReportSearchList";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

interface DailyReportWithSite {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  created_at: string;
  approval_status: string;
  reporter_id: string | null;
  sites: { name: string } | null;
  processes: { name: string } | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: "all", label: "すべて" },
  { value: "submitted", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "client_confirmed", label: "確認済み" },
  { value: "rejected", label: "差戻し" },
] as const;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const { status: filterStatus, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const { role: userRole } = await requireUserContext();
  const isClient = userRole === "client";
  const activeFilter = filterStatus && filterStatus !== "all" ? filterStatus : null;
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, progress_rate, work_content, created_at, approval_status, reporter_id, sites(name), processes(name)",
      { count: "exact" }
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (activeFilter) {
    query = query.eq("approval_status", activeFilter);
  }

  const [
    { data: reports, error, count: filteredCount },
    { count: allCount },
    { count: submittedCount },
    { count: approvedCount },
    { count: confirmedCount },
    { count: rejectedCount },
  ] = await Promise.all([
    query,
    supabase.from("daily_reports").select("*", { count: "exact", head: true }),
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("approval_status", "submitted"),
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("approval_status", "approved"),
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("approval_status", "client_confirmed"),
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("approval_status", "rejected"),
  ]);
  const reportList = (reports as DailyReportWithSite[] | null) ?? [];

  const reporterIds = [...new Set(reportList.map((r) => r.reporter_id).filter(Boolean))] as string[];
  let reporterMap = new Map<string, string>();
  if (reporterIds.length > 0) {
    try {
      const adminClient = createAdminClient();
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds);
      reporterMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    } catch {
      // フォールバック: 通常クライアントで試行
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds);
      reporterMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    }
  }

  const reportItems = reportList.map((r) => {
    const status = r.approval_status ?? "draft";
    return {
      id: r.id,
      siteName: r.sites?.name ?? "不明な現場",
      processName: r.processes?.name ?? WORK_PROCESS_LABELS[r.work_process] ?? r.work_process,
      reportDate: r.report_date,
      formattedDate: formatDate(r.report_date),
      status,
      statusLabel: APPROVAL_STATUS_LABELS[status] ?? status,
      progressRate: r.progress_rate,
      reporterName: r.reporter_id ? (reporterMap.get(r.reporter_id) || null) : null,
    };
  });

  const statusTabsWithCounts = STATUS_TABS.map((tab) => ({
    ...tab,
    count:
      (
        {
          all: allCount,
          submitted: submittedCount,
          approved: approvedCount,
          client_confirmed: confirmedCount,
          rejected: rejectedCount,
        } as Record<(typeof STATUS_TABS)[number]["value"], number | null>
      )[tab.value] ?? 0,
  }));
  const totalCount = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">報告一覧</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {activeFilter ? `${APPROVAL_STATUS_LABELS[activeFilter] ?? activeFilter}: ` : ""}
            {totalCount}件の報告
          </p>
        </div>
        {!isClient && (
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0EA5E9] text-white text-[13px] font-semibold hover:bg-[#0284C7] transition-colors active:scale-[0.98]"
          >
            <Plus size={16} />
            新規報告
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-[13px] text-red-500">データの取得に失敗しました</p>
        </div>
      )}

      {totalCount === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <FileText size={36} className="mb-3 text-gray-200" />
          {activeFilter ? (
            <>
              <p className="text-[15px] text-gray-400 mb-3">
                {APPROVAL_STATUS_LABELS[activeFilter] ?? activeFilter}の報告はありません
              </p>
              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Filter size={14} />
                フィルターを解除
              </Link>
            </>
          ) : (
            <>
              <p className="text-[15px] text-gray-400 mb-5">報告がまだありません</p>
              {!isClient && (
                <Link
                  href="/reports/new"
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0EA5E9] text-white text-[13px] font-semibold hover:bg-[#0284C7] transition-colors"
                >
                  <Plus size={16} />
                  最初の報告を作成
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <ReportSearchList
          reports={reportItems}
          statusTabs={statusTabsWithCounts}
          activeFilter={activeFilter}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
