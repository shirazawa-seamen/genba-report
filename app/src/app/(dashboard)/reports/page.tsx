import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_PROCESS_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Filter } from "lucide-react";
import { ReportSearchList } from "@/components/reports/ReportSearchList";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { getAccessibleSiteContext } from "@/lib/siteAccess";

interface DailyReportWithSite {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  created_at: string;
  approval_status: string;
  rejection_comment: string | null;
  reporter_id: string | null;
  site_id: string;
  sites: { name: string } | null;
  processes: { name: string } | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string; scope?: string }>;
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
  const { status: filterStatus, page: pageParam, scope: scopeParam } = await searchParams;
  const supabase = await createClient();
  const { user, role: userRole, companyId } = await requireUserContext();

  // クライアントは個別の職人報告ではなく、マネージャーのサマリーのみ閲覧
  if (userRole === "client") redirect("/client");

  const accessContext = await getAccessibleSiteContext(user.id, userRole, companyId);
  const isClient = false;
  const isManager = userRole === "manager";
  const isWorker = userRole === "worker_internal" || userRole === "worker_external";
  const activeFilter = filterStatus && filterStatus !== "all" ? filterStatus : null;
  const activeScope = isManager && scopeParam === "mine" ? "mine" : "all";
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const scopedSiteIds =
    activeScope === "mine"
      ? accessContext.assignedSiteIds
      : accessContext.accessibleSiteIds;

  let query = supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, progress_rate, work_content, created_at, approval_status, rejection_comment, reporter_id, site_id, sites(name), processes(name)",
      { count: "exact" }
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  // ワーカーは自分の報告のみ表示
  if (isWorker) {
    query = query.eq("reporter_id", user.id);
  }

  if (activeFilter) {
    query = query.eq("approval_status", activeFilter);
  }
  if (scopedSiteIds) {
    if (scopedSiteIds.length === 0) {
      query = query.in("site_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("site_id", scopedSiteIds);
    }
  }

  // ステータス別カウントクエリ（head: true で件数のみ取得、データは取得しない）
  const buildCountQuery = (status?: string) => {
    let q = supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true });
    if (status) q = q.eq("approval_status", status);
    if (isWorker) q = q.eq("reporter_id", user.id);
    if (scopedSiteIds) {
      if (scopedSiteIds.length === 0) {
        q = q.in("site_id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        q = q.in("site_id", scopedSiteIds);
      }
    }
    return q;
  };

  const [
    { data: reports, error },
    { count: allCount },
    { count: submittedCount },
    { count: approvedCount },
    { count: confirmedCount },
    { count: rejectedCount },
  ] = await Promise.all([
    query,
    buildCountQuery(),
    buildCountQuery("submitted"),
    buildCountQuery("approved"),
    buildCountQuery("client_confirmed"),
    buildCountQuery("rejected"),
  ]);

  const filteredCount = activeFilter
    ? ({ submitted: submittedCount, approved: approvedCount, client_confirmed: confirmedCount, rejected: rejectedCount } as Record<string, number | null>)[activeFilter] ?? 0
    : allCount ?? 0;
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

  // 同じ報告者・同じ日付・同じ現場の報告をグループ化
  const groupKey = (r: DailyReportWithSite) =>
    `${r.site_id}_${r.reporter_id ?? "none"}_${r.report_date}`;

  const grouped = new Map<string, DailyReportWithSite[]>();
  for (const r of reportList) {
    const key = groupKey(r);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const reportItems = Array.from(grouped.values()).map((siblings) => {
    const first = siblings[0];
    const status = first.approval_status ?? "draft";
    const processNames = siblings
      .map((r) => r.processes?.name ?? WORK_PROCESS_LABELS[r.work_process] ?? r.work_process)
      .filter(Boolean);
    const avgProgress =
      siblings.length > 0
        ? Math.round(siblings.reduce((sum, r) => sum + (r.progress_rate ?? 0), 0) / siblings.length)
        : 0;

    return {
      id: first.id,
      siteName: first.sites?.name ?? "不明な現場",
      processName: processNames.join("、"),
      reportDate: first.report_date,
      formattedDate: formatDate(first.report_date),
      status,
      statusLabel: APPROVAL_STATUS_LABELS[status] ?? status,
      progressRate: avgProgress,
      reporterName: first.reporter_id ? (reporterMap.get(first.reporter_id) || null) : null,
      rejectionComment: first.rejection_comment ?? null,
      submittedAt: first.created_at,
    };
  });

  const statusTabsWithCounts = STATUS_TABS.map((tab) => ({
    ...tab,
    count:
      (
        {
          all: allCount ?? 0,
          submitted: submittedCount ?? 0,
          approved: approvedCount ?? 0,
          client_confirmed: confirmedCount ?? 0,
          rejected: rejectedCount ?? 0,
        } as Record<(typeof STATUS_TABS)[number]["value"], number>
      )[tab.value] ?? 0,
  }));
  const totalCount = (typeof filteredCount === 'number' ? filteredCount : 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">2次報告一覧</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {activeFilter ? `${APPROVAL_STATUS_LABELS[activeFilter] ?? activeFilter}: ` : ""}
            {isManager && activeScope === "mine" ? "自分の現場 / " : ""}
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
          scope={activeScope}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
