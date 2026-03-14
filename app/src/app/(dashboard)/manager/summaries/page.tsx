import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Sparkles,
} from "lucide-react";
import { getAccessibleSiteContext } from "@/lib/siteAccess";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import dynamic from "next/dynamic";
import type { SummaryItem } from "./summary-list";

const SummaryList = dynamic(
  () => import("./summary-list").then((m) => ({ default: m.SummaryList })),
  {
    loading: () => (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    ),
  }
);

interface PageProps {
  searchParams: Promise<{ status?: string; site?: string }>;
}

export default async function ManagerSummariesPage({ searchParams }: PageProps) {
  const { status: statusFilter, site: siteFilter } = await searchParams;
  const { user, role: userRole, companyId } = await requireUserContext();

  if (userRole !== "admin" && userRole !== "manager") redirect("/");

  const supabase = await createClient();
  const accessContext = await getAccessibleSiteContext(user.id, userRole, companyId);
  const accessibleSiteIds = accessContext.accessibleSiteIds;

  const safeSiteIds =
    accessibleSiteIds && accessibleSiteIds.length === 0
      ? ["00000000-0000-0000-0000-000000000000"]
      : accessibleSiteIds;

  // 1) サマリー取得（revision_comment は migration_v22 で追加。未適用時フォールバック）
  const summarySelect = "id, site_id, report_date, summary_text, status, official_progress, revision_comment, sites(name)";
  const summarySelectFallback = "id, site_id, report_date, summary_text, status, official_progress, sites(name)";
  let useFallbackSelect = false;

  const buildSummaryQuery = (select: string) => {
    let q = supabase
      .from("client_report_summaries")
      .select(select)
      .order("report_date", { ascending: false })
      .limit(200);
    if (safeSiteIds) q = q.in("site_id", safeSiteIds);
    if (siteFilter) q = q.eq("site_id", siteFilter);
    if (statusFilter && statusFilter !== "all" && statusFilter !== "ungenerated") {
      q = q.eq("status", statusFilter);
    }
    return q;
  };

  const summaryQuery = buildSummaryQuery(summarySelect);

  // 2) 全報告日 (site_id, report_date) 取得 — 未生成のサマリーも表示するため
  let reportsQuery = supabase
    .from("daily_reports")
    .select("site_id, report_date, sites(name)")
    .in("approval_status", ["submitted", "approved"])
    .order("report_date", { ascending: false })
    .limit(500);
  if (safeSiteIds) reportsQuery = reportsQuery.in("site_id", safeSiteIds);
  if (siteFilter) reportsQuery = reportsQuery.eq("site_id", siteFilter);

  // 3) 工程情報取得
  let processesQuery = supabase
    .from("processes")
    .select("id, name, site_id")
    .order("order_index");
  if (safeSiteIds) processesQuery = processesQuery.in("site_id", safeSiteIds);
  if (siteFilter) processesQuery = processesQuery.eq("site_id", siteFilter);

  // 4) サイト一覧取得（フィルター用 + 空現場表示用）
  const sitesQuery = safeSiteIds
    ? supabase.from("sites").select("id, name").in("id", safeSiteIds).eq("status", "active").order("name")
    : supabase.from("sites").select("id, name").eq("status", "active").order("name");

  const [initialSummaryResult, reportsResult, processesResult, sitesResult] = await Promise.all([
    summaryQuery,
    reportsQuery,
    processesQuery,
    sitesQuery,
  ]);
  let summaryResult = initialSummaryResult;

  // revision_comment カラム未追加の場合フォールバック
  if (summaryResult.error && !useFallbackSelect) {
    useFallbackSelect = true;
    summaryResult = await buildSummaryQuery(summarySelectFallback);
  }
  const reports = reportsResult.data;
  const processes = processesResult.data;
  const allSites = sitesResult.data;
  const summaries = (summaryResult.data ?? []).map((s) => {
    const row = s as unknown as Record<string, unknown>;
    return {
      id: row.id as string,
      site_id: row.site_id as string,
      report_date: row.report_date as string,
      summary_text: row.summary_text as string,
      status: row.status as string,
      official_progress: row.official_progress,
      revision_comment: (row.revision_comment ?? null) as string | null,
      sites: row.sites as { name?: string } | null,
    };
  });

  // サマリーを (site_id, report_date) でマップ化
  type SummaryRow = (typeof summaries)[number];
  const summaryMap = new Map<string, SummaryRow>();
  for (const s of summaries) {
    summaryMap.set(`${s.site_id}_${s.report_date}`, s);
  }

  // 工程を site_id でマップ化
  const processMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const p of processes ?? []) {
    if (!processMap.has(p.site_id)) processMap.set(p.site_id, []);
    processMap.get(p.site_id)!.push({ id: p.id, name: p.name });
  }

  // サイト名マップ
  const siteNameMap = new Map<string, string>();
  for (const s of summaries) {
    const name = (s.sites as unknown as { name?: string } | null)?.name;
    if (name) siteNameMap.set(s.site_id, name);
  }
  for (const r of reports ?? []) {
    const name = (r.sites as unknown as { name?: string } | null)?.name;
    if (name && !siteNameMap.has(r.site_id as string)) siteNameMap.set(r.site_id as string, name);
  }

  // 全 (site_id, report_date) をユニーク収集
  const allDateKeys = new Set<string>();
  for (const s of summaries) {
    allDateKeys.add(`${s.site_id}_${s.report_date}`);
  }
  for (const r of reports ?? []) {
    allDateKeys.add(`${r.site_id}_${r.report_date}`);
  }

  // 1次報告も2次報告もない現場を「未生成」として今日の日付で追加
  const today = new Date().toISOString().split("T")[0];
  const sitesWithEntries = new Set<string>();
  for (const key of allDateKeys) {
    sitesWithEntries.add(key.split("_")[0]);
  }
  const targetSiteIds = siteFilter ? [siteFilter] : (safeSiteIds ?? (allSites ?? []).map((s) => s.id));
  for (const sid of targetSiteIds) {
    if (!sitesWithEntries.has(sid)) {
      allDateKeys.add(`${sid}_${today}`);
      // サイト名マップにも追加
      const siteName = (allSites ?? []).find((s) => s.id === sid)?.name;
      if (siteName && !siteNameMap.has(sid)) siteNameMap.set(sid, siteName);
    }
  }

  // SummaryItem に変換
  const allItems: SummaryItem[] = [];
  for (const key of allDateKeys) {
    const [siteId, reportDate] = key.split("_");
    const summary = summaryMap.get(key);
    const siteProcesses = processMap.get(siteId) ?? [];

    const officialProgress = summary?.official_progress
      ? (summary.official_progress as Array<{ processId?: string; processName?: string; progressRate?: number }>).map(
          (p) => ({
            processId: p.processId ?? p.processName ?? "",
            processName: p.processName ?? p.processId ?? "工程未設定",
            progressRate: p.progressRate ?? 0,
          })
        )
      : siteProcesses.map((p) => ({
          processId: p.id,
          processName: p.name,
          progressRate: 0,
        }));

    const status = summary?.status ?? "ungenerated";

    // ステータスフィルター適用
    if (statusFilter === "ungenerated" && status !== "ungenerated") continue;
    if (statusFilter && statusFilter !== "all" && statusFilter !== "ungenerated" && status !== statusFilter) continue;

    allItems.push({
      id: summary?.id ?? null,
      siteId,
      siteName: siteNameMap.get(siteId) ?? "不明な現場",
      reportDate,
      summaryText: summary?.summary_text ?? "",
      status,
      revisionComment: summary?.revision_comment ?? null,
      officialProgress,
    });
  }

  // 日付降順ソート
  allItems.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  // 現場別グループ化
  const groupMap = new Map<string, { siteId: string; siteName: string; items: SummaryItem[] }>();
  for (const item of allItems) {
    if (!groupMap.has(item.siteId)) {
      groupMap.set(item.siteId, { siteId: item.siteId, siteName: item.siteName, items: [] });
    }
    groupMap.get(item.siteId)!.items.push(item);
  }
  const groups = Array.from(groupMap.values());

  // ステータスカウント（空現場も含めた allDateKeys を使用）
  const countByStatus = { all: 0, ungenerated: 0, draft: 0, submitted: 0, client_confirmed: 0, revision_requested: 0 };
  for (const key of allDateKeys) {
    const summary = summaryMap.get(key);
    const s = summary?.status ?? "ungenerated";
    countByStatus.all++;
    if (s in countByStatus) countByStatus[s as keyof typeof countByStatus]++;
  }

  const sites = allSites ?? [];

  const activeStatus = statusFilter ?? "all";
  const activeSiteFilter = siteFilter ?? null;
  const activeSiteName = activeSiteFilter
    ? sites.find((s) => s.id === activeSiteFilter)?.name ?? null
    : null;

  const buildHref = (status?: string, site?: string | null) => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (site) params.set("site", site);
    const qs = params.toString();
    return `/manager/summaries${qs ? `?${qs}` : ""}`;
  };

  const STATUS_TABS = [
    { value: "all", label: "すべて", count: countByStatus.all },
    { value: "revision_requested", label: "修正依頼", count: countByStatus.revision_requested },
    { value: "ungenerated", label: "未生成", count: countByStatus.ungenerated },
    { value: "draft", label: "下書き", count: countByStatus.draft },
    { value: "submitted", label: "提出済み", count: countByStatus.submitted },
    { value: "client_confirmed", label: "確認済み", count: countByStatus.client_confirmed },
  ];

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> ホーム
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
            二次報告（クライアント向け）
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {activeSiteName ? `${activeSiteName} / ` : ""}
            {allItems.length}件
          </p>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildHref(tab.value, activeSiteFilter)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[12px] font-medium transition-colors whitespace-nowrap ${
                activeStatus === tab.value
                  ? "bg-[#0EA5E9] text-white shadow-md shadow-sky-200"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeStatus === tab.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Site Filter */}
        {sites.length > 1 && (
          <div className="mb-5">
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildHref(activeStatus, null)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  !activeSiteFilter
                    ? "bg-cyan-100 text-[#0EA5E9] border border-cyan-300"
                    : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                全現場
              </Link>
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={buildHref(activeStatus, site.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    activeSiteFilter === site.id
                      ? "bg-cyan-100 text-[#0EA5E9] border border-cyan-300"
                      : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Building2 size={11} />
                  {site.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* List or Empty */}
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Sparkles size={36} className="mb-3 text-gray-200" />
            <p className="text-[15px] text-gray-400">
              {activeStatus !== "all"
                ? `${STATUS_TABS.find((t) => t.value === activeStatus)?.label ?? activeStatus}の報告はありません`
                : "報告がまだありません"}
            </p>
          </div>
        ) : (
          <SummaryList groups={groups} />
        )}
      </div>
    </div>
  );
}
