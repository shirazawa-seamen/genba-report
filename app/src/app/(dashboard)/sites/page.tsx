import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { listCompanies } from "@/lib/companies";
import { SitesPageClient } from "./SitesPageClient";
import {
  canCreateSites,
  getAccessibleSiteContext,
  getAllowedSiteScopeOptions,
  type SiteScopeFilter,
  type SiteStatusFilter,
} from "@/lib/siteAccess";

interface SiteRow {
  id: string;
  name: string;
  site_number: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  daily_reports: Array<{ count: number }> | null;
}

interface ProcessRow {
  site_id: string;
  progress_rate: number;
}

const EMPTY_SITE_ID = "00000000-0000-0000-0000-000000000000";

function getPeriodLabel(startDate: string | null, endDate: string | null, siteStatus: string): { label: string; color: string; bg: string } {
  if (siteStatus === "completed") return { label: "完了", color: "text-emerald-500", bg: "bg-emerald-50" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate) return { label: "未定", color: "text-gray-400", bg: "bg-gray-100" };
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (today < start) return { label: "着工前", color: "text-blue-500", bg: "bg-blue-50" };
  if (end && today > end) return { label: "完了", color: "text-emerald-500", bg: "bg-emerald-50" };
  return { label: "施工中", color: "text-[#0EA5E9]", bg: "bg-cyan-50" };
}

function getScopedSiteIds(scope: SiteScopeFilter, context: Awaited<ReturnType<typeof getAccessibleSiteContext>>) {
  const assignedSiteIds = [...new Set(context.assignedSiteIds)];

  if (context.role === "worker_external") {
    return assignedSiteIds;
  }

  if (context.role === "client") {
    const companyOnlySiteIds = context.companySiteIds.filter((siteId) => !assignedSiteIds.includes(siteId));
    if (scope === "assigned") return assignedSiteIds;
    if (scope === "unassigned") return companyOnlySiteIds;
    return [...new Set([...(context.accessibleSiteIds ?? []), ...assignedSiteIds])];
  }

  if (context.role === "worker_internal" && scope === "assigned") {
    return assignedSiteIds;
  }

  return null;
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; status?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = (
    params.status ?? (params.show === "completed" ? "completed" : "active")
  ) as SiteStatusFilter;
  const supabase = await createClient();
  const { user, role: userRole, companyId } = await requireUserContext();
  const accessContext = await getAccessibleSiteContext(user.id, userRole, companyId);
  const scopeOptions = getAllowedSiteScopeOptions(accessContext);
  const requestedScope = (params.scope as SiteScopeFilter | undefined) ?? scopeOptions[0].value;
  const activeScope = scopeOptions.some((option) => option.value === requestedScope)
    ? requestedScope
    : scopeOptions[0].value;
  const canCreateSite = canCreateSites(userRole);

  const buildSiteCountQuery = (scope: SiteScopeFilter, status?: Exclude<SiteStatusFilter, "all">) => {
    let query = supabase.from("sites").select("id", { count: "exact", head: true });
    const scopedSiteIds = getScopedSiteIds(scope, accessContext);

    if (status) {
      query = query.eq("status", status);
    }

    if (scopedSiteIds) {
      query = query.in("id", scopedSiteIds.length > 0 ? scopedSiteIds : [EMPTY_SITE_ID]);
    }

    return query;
  };

  let visibleSitesQuery = supabase
    .from("sites")
    .select("id, name, site_number, address, start_date, end_date, status, daily_reports(count)")
    .order("created_at", { ascending: false });
  const visibleSiteIds = getScopedSiteIds(activeScope, accessContext);

  if (activeStatus !== "all") {
    visibleSitesQuery = visibleSitesQuery.eq("status", activeStatus);
  }

  if (visibleSiteIds) {
    visibleSitesQuery = visibleSitesQuery.in("id", visibleSiteIds.length > 0 ? visibleSiteIds : [EMPTY_SITE_ID]);
  }

  const companiesPromise = canCreateSite ? listCompanies() : Promise.resolve([]);
  const scopeCountQueries = scopeOptions.map((option) => buildSiteCountQuery(option.value));

  const [
    siteResult,
    { count: allCount },
    { count: activeCount },
    { count: completedCount },
    scopeCountResults,
    companies,
  ] = await Promise.all([
    visibleSitesQuery,
    buildSiteCountQuery(activeScope),
    buildSiteCountQuery(activeScope, "active"),
    buildSiteCountQuery(activeScope, "completed"),
    Promise.all(scopeCountQueries),
    companiesPromise,
  ]);
  const scopeCounts = Object.fromEntries(
    scopeOptions.map((option, index) => [option.value, scopeCountResults[index]?.count ?? 0])
  ) as Partial<Record<SiteScopeFilter, number>>;

  const visibleSites = (siteResult.data as SiteRow[] | null) ?? [];
  const error = siteResult.error;

  let processMap: Record<string, { total: number; avgProgress: number }> = {};
  if (visibleSites.length > 0) {
    const { data: processRows } = await supabase
      .from("processes")
      .select("site_id, progress_rate")
      .in("site_id", visibleSites.map((site) => site.id));

    if (processRows) {
      const grouped: Record<string, { total: number; sum: number }> = {};
      for (const process of processRows as ProcessRow[]) {
        const current = grouped[process.site_id] ?? { total: 0, sum: 0 };
        current.total += 1;
        current.sum += process.progress_rate ?? 0;
        grouped[process.site_id] = current;
      }

      processMap = Object.fromEntries(
        Object.entries(grouped).map(([siteId, stats]) => [
          siteId,
          { total: stats.total, avgProgress: Math.round(stats.sum / stats.total) },
        ])
      );
    }
  }

  const siteItems = visibleSites.map((site) => {
    const period = getPeriodLabel(site.start_date, site.end_date, site.status ?? "active");
    const progress = processMap[site.id];

    return {
      id: site.id,
      name: site.name,
      siteNumber: site.site_number ?? null,
      address: site.address ?? "",
      reportCount: site.daily_reports?.[0]?.count ?? 0,
      periodLabel: period.label,
      periodColor: period.color,
      periodBg: period.bg,
      progressRate: progress?.avgProgress ?? null,
      processCount: progress?.total ?? 0,
    };
  });

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">現場一覧</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{siteItems.length}件の現場</p>
        </div>
      </div>

      <SitesPageClient
        userRole={userRole}
        activeScope={activeScope}
        activeStatus={activeStatus}
        statusCounts={{
          all: allCount ?? 0,
          active: activeCount ?? 0,
          completed: completedCount ?? 0,
        }}
        scopeCounts={scopeCounts}
        activeCount={activeCount ?? 0}
        completedCount={completedCount ?? 0}
        siteItems={siteItems}
        companies={companies}
        canCreateSite={canCreateSite}
        scopeOptions={scopeOptions.map((option) => ({ value: option.value, label: option.label }))}
        error={Boolean(error)}
      />
    </div>
  );
}
