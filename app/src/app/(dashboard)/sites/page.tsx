import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { SitesPageClient } from "./SitesPageClient";

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

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const params = await searchParams;
  const showCompleted = params.show === "completed";
  const supabase = await createClient();
  const { user, role: userRole } = await requireUserContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sites: any[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null;

  const statusFilter = showCompleted ? "completed" : "active";

  if (userRole === "worker_external" && user) {
    const { data: memberRows, error: memberError } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", user.id);
    error = memberError;
    const siteIds = (memberRows ?? []).map((m) => m.site_id);
    if (siteIds.length > 0) {
      const result = await supabase
        .from("sites")
        .select(`id, name, site_number, address, start_date, end_date, status, created_at, daily_reports(count)`)
        .in("id", siteIds)
        .eq("status", statusFilter)
        .order("created_at", { ascending: false });
      sites = result.data;
      error = error || result.error;
    } else {
      sites = [];
    }
  } else {
    const result = await supabase
      .from("sites")
      .select(`id, name, site_number, address, start_date, end_date, status, created_at, daily_reports(count)`)
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });
    sites = result.data;
    error = result.error;
  }

  // 全サイトIDの工程データを一括取得して進捗率を計算
  const siteIds = (sites ?? []).map((s) => s.id);
  let processMap: Record<string, { total: number; avgProgress: number }> = {};
  if (siteIds.length > 0) {
    const { data: allProcesses } = await supabase
      .from("processes")
      .select("site_id, progress_rate")
      .in("site_id", siteIds);
    if (allProcesses) {
      const grouped: Record<string, number[]> = {};
      for (const p of allProcesses) {
        if (!grouped[p.site_id]) grouped[p.site_id] = [];
        grouped[p.site_id].push(p.progress_rate);
      }
      processMap = Object.fromEntries(
        Object.entries(grouped).map(([siteId, rates]) => [
          siteId,
          { total: rates.length, avgProgress: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) },
        ])
      );
    }
  }

  // 完了件数も取得
  const { count: completedCount } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");

  const { count: activeCount } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // クライアントコンポーネント用にデータ整形
  const siteItems = (sites ?? []).map((site) => {
    const period = getPeriodLabel(site.start_date, site.end_date, site.status ?? "active");
    const progress = processMap[site.id];
    return {
      id: site.id,
      name: site.name,
      siteNumber: site.site_number ?? null,
      address: site.address,
      reportCount: (site.daily_reports as { count: number }[])?.[0]?.count ?? 0,
      periodLabel: period.label,
      periodColor: period.color,
      periodBg: period.bg,
      progressRate: progress?.avgProgress ?? null,
      processCount: progress?.total ?? 0,
    };
  });

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">現場一覧</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{siteItems.length}件の現場</p>
        </div>
      </div>

      <SitesPageClient
        showCompleted={showCompleted}
        activeCount={activeCount ?? 0}
        completedCount={completedCount ?? 0}
        siteItems={siteItems}
        error={Boolean(error)}
      />
    </div>
  );
}
