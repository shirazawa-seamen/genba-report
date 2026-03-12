import { createClient } from "@/lib/supabase/server";

export type SiteScopeFilter = "all" | "assigned" | "unassigned";
export type SiteStatusFilter = "all" | "active" | "completed";

export interface AccessibleSiteContext {
  role: string;
  companyId: string | null;
  assignedSiteIds: string[];
  companySiteIds: string[];
  accessibleSiteIds: string[] | null;
}

export async function getAccessibleSiteContext(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", userId)
    .single();

  const role = profile?.role ?? "worker_internal";
  const companyId = profile?.company_id ?? null;

  const { data: memberRows } = await supabase
    .from("site_members")
    .select("site_id")
    .eq("user_id", userId);
  const assignedSiteIds = [...new Set((memberRows ?? []).map((row) => row.site_id))];

  let companySiteIds: string[] = [];
  if (role === "client" && companyId) {
    const { data: companySites } = await supabase
      .from("sites")
      .select("id")
      .eq("company_id", companyId);
    companySiteIds = (companySites ?? []).map((site) => site.id);
  }

  let accessibleSiteIds: string[] | null = null;
  if (role === "worker_external") {
    accessibleSiteIds = assignedSiteIds;
  } else if (role === "client") {
    accessibleSiteIds = [...new Set([...assignedSiteIds, ...companySiteIds])];
  }

  return {
    role,
    companyId,
    assignedSiteIds,
    companySiteIds,
    accessibleSiteIds,
  } satisfies AccessibleSiteContext;
}

export function canCreateSites(role: string) {
  return role === "admin" || role === "manager";
}

export function getAllowedSiteScopeOptions(context: AccessibleSiteContext) {
  if (context.role === "worker_external") {
    return [{ value: "assigned", label: "自分の現場" }] as const;
  }

  if (context.role === "client") {
    return [
      { value: "all", label: "すべて" },
      { value: "assigned", label: "招待済み" },
      { value: "unassigned", label: "未招待" },
    ] as const;
  }

  if (context.role === "worker_internal") {
    return [
      { value: "all", label: "社内全体" },
      { value: "assigned", label: "自分の現場" },
    ] as const;
  }

  return [{ value: "all", label: "すべて" }] as const;
}

export function filterSiteByScope(
  siteId: string,
  scope: SiteScopeFilter,
  context: AccessibleSiteContext
) {
  if (context.role === "worker_external") {
    return context.assignedSiteIds.includes(siteId);
  }

  if (context.role === "client") {
    const isAssigned = context.assignedSiteIds.includes(siteId);
    const isCompanySite = context.companySiteIds.includes(siteId);
    if (!isAssigned && !isCompanySite) return false;
    if (scope === "assigned") return isAssigned;
    if (scope === "unassigned") return isCompanySite && !isAssigned;
    return true;
  }

  if (context.role === "worker_internal") {
    if (scope === "assigned") return context.assignedSiteIds.includes(siteId);
    return true;
  }

  return true;
}

export async function canAccessSite(userId: string, siteId: string) {
  const context = await getAccessibleSiteContext(userId);
  if (context.role === "admin" || context.role === "manager" || context.role === "worker_internal") {
    return true;
  }
  return (context.accessibleSiteIds ?? []).includes(siteId);
}

export async function canAccessReport(userId: string, reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", reportId)
    .single();
  if (!data?.site_id) return false;
  return canAccessSite(userId, data.site_id);
}
