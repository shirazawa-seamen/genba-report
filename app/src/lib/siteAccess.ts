import { cache } from "react";
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

/**
 * Get the user's accessible site context.
 * Accepts optional knownRole/knownCompanyId to skip the redundant profiles query
 * (when already fetched via requireUserContext).
 * Wrapped with React cache() to deduplicate within a single request.
 */
export const getAccessibleSiteContext = cache(async (
  userId: string,
  knownRole?: string,
  knownCompanyId?: string | null,
): Promise<AccessibleSiteContext> => {
  const supabase = await createClient();

  const needsProfile = knownRole === undefined;

  // Parallelize: fetch profile (if needed) + site_members at the same time
  const [profileResult, memberResult] = await Promise.all([
    needsProfile
      ? supabase.from("profiles").select("role, company_id").eq("id", userId).single()
      : null,
    supabase.from("site_members").select("site_id").eq("user_id", userId),
  ]);

  const role = needsProfile
    ? (profileResult?.data?.role ?? "worker_internal")
    : (knownRole ?? "worker_internal");
  const companyId = needsProfile
    ? (profileResult?.data?.company_id ?? null)
    : (knownCompanyId ?? null);

  const assignedSiteIds = [...new Set((memberResult.data ?? []).map((row) => row.site_id))];

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
  };
});

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
