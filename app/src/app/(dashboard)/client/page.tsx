import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ClientSummaryCard } from "./summary-card";
import { getAccessibleSiteContext } from "@/lib/siteAccess";

interface PageProps {
  searchParams: Promise<{ tab?: string; site?: string }>;
}

export default async function ClientPage({ searchParams }: PageProps) {
  const { tab, site: siteFilter } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") redirect("/");
  const accessContext = await getAccessibleSiteContext(user.id);
  const accessibleSiteIds = accessContext.accessibleSiteIds ?? [];

  const activeTab = tab === "confirmed" ? "confirmed" : "pending";

  // pending タブ: submitted + revision_requested を表示
  const summaryStatuses = activeTab === "confirmed"
    ? ["client_confirmed"]
    : ["submitted", "revision_requested"];
  // サイトフィルター: 指定がなければアクセス可能な全現場
  const filteredSiteIds =
    siteFilter && accessibleSiteIds.includes(siteFilter)
      ? [siteFilter]
      : accessibleSiteIds;

  const { data: summaries } = filteredSiteIds.length
    ? await supabase
        .from("client_report_summaries")
        .select("id, report_date, summary_text, status, site_id, sites(name)")
        .in("site_id", filteredSiteIds)
        .in("status", summaryStatuses)
        .order("report_date", { ascending: false })
        .limit(50)
    : { data: [] };

  // Stats（フィルター適用後の件数）
  const [{ count: pendingConfirmCount }, { count: confirmedCount }] = filteredSiteIds.length
    ? await Promise.all([
        supabase
          .from("client_report_summaries")
          .select("*", { count: "exact", head: true })
          .in("site_id", filteredSiteIds)
          .in("status", ["submitted", "revision_requested"]),
        supabase
          .from("client_report_summaries")
          .select("*", { count: "exact", head: true })
          .in("site_id", filteredSiteIds)
          .eq("status", "client_confirmed"),
      ])
    : [{ count: 0 }, { count: 0 }];

  const today = new Date().toISOString().slice(0, 10);
  const { data: sites } = accessibleSiteIds.length
    ? await supabase
        .from("sites")
        .select("id, name, start_date, end_date")
        .in("id", accessibleSiteIds)
        .order("name")
    : { data: [] };

  const activeSites = (sites ?? []).filter((site) => {
    if (site.end_date && site.end_date < today) return false;
    return true;
  });

  const activeSiteFilter = siteFilter && accessibleSiteIds.includes(siteFilter) ? siteFilter : null;
  const activeSiteFilterName = activeSiteFilter
    ? activeSites.find((s) => s.id === activeSiteFilter)?.name ?? null
    : null;

  // タブリンクにサイトフィルターを引き継ぐヘルパー
  const buildHref = (tab?: string, site?: string | null) => {
    const params = new URLSearchParams();
    if (tab === "confirmed") params.set("tab", "confirmed");
    if (site) params.set("site", site);
    const qs = params.toString();
    return `/client${qs ? `?${qs}` : ""}`;
  };

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
              {activeSiteFilterName
                ? `${activeSiteFilterName} の報告`
                : "承認済み報告の確認・閲覧"}
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
                href={buildHref(t.value, activeSiteFilter)}
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

        {/* Site Filter */}
        {activeSites.length > 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-[#0EA5E9]" />
              <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
                現場で絞り込み
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildHref(activeTab === "confirmed" ? "confirmed" : undefined, null)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  !activeSiteFilter
                    ? "bg-[#0EA5E9] text-white shadow-md shadow-sky-200"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                すべて
              </Link>
              {activeSites.map((site) => (
                <Link
                  key={site.id}
                  href={buildHref(activeTab === "confirmed" ? "confirmed" : undefined, site.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    activeSiteFilter === site.id
                      ? "bg-[#0EA5E9] text-white shadow-md shadow-sky-200"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
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
              ({(summaries ?? []).length}件)
            </span>
          </div>

          {!summaries || summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <FileText size={32} className="mb-2 text-gray-200" />
              <p className="text-[13px]">
                {activeTab === "confirmed"
                  ? "確認済みの報告はまだありません"
                  : "確認待ちの報告はありません"}
              </p>
              {accessibleSiteIds.length === 0 && (
                <p className="text-[12px] text-amber-400 mt-3">
                  表示可能な現場がありません。管理者にお問い合わせください。
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {summaries.map((summary) => (
                <ClientSummaryCard
                  key={summary.id}
                  summaryId={summary.id}
                  siteName={(summary.sites as { name?: string } | null)?.name ?? "不明"}
                  reportDate={summary.report_date}
                  summaryText={summary.summary_text}
                  status={summary.status}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
