import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";

const CalendarView = dynamic(
  () => import("./calendar-view").then((m) => ({ default: m.CalendarView })),
  {
    loading: () => (
      <div className="p-5 space-y-4">
        <div className="h-10 w-56 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    ),
  }
);
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { getAccessibleSiteContext } from "@/lib/siteAccess";

interface PageProps {
  searchParams: Promise<{ month?: string; status?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { month, status } = await searchParams;
  const supabase = await createClient();
  const { user, role: userRole, companyId } = await requireUserContext();
  const siteContext = await getAccessibleSiteContext(user.id, userRole, companyId);
  const statusFilter =
    status === "completed" ? "completed" : status === "all" ? "all" : "active";

  // Determine month to display (JST基準)
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  // Calculate date range for the month
  const firstDay = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0);
  const firstDateStr = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const lastDateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  // Fetch all sites with their date ranges
  let sites:
    | { id: string; name: string; site_number: string | null; start_date: string | null; end_date: string | null; status?: string | null; site_color?: string | null; companies?: unknown }[]
    | null = null;
  {
    let primaryQuery = supabase
      .from("sites")
      .select("id, name, site_number, start_date, end_date, status, site_color, company_id, companies(name)")
      .or(`start_date.is.null,start_date.lte.${lastDateStr}`)
      .or(`end_date.is.null,end_date.gte.${firstDateStr}`);
    if (statusFilter !== "all") {
      primaryQuery = primaryQuery.eq("status", statusFilter);
    }
    const primary = await primaryQuery.order("name");
    if (primary.error?.message?.includes("site_color")) {
      let fallbackQuery = supabase
        .from("sites")
        .select("id, name, site_number, start_date, end_date, status")
        .or(`start_date.is.null,start_date.lte.${lastDateStr}`)
        .or(`end_date.is.null,end_date.gte.${firstDateStr}`);
      if (statusFilter !== "all") {
        fallbackQuery = fallbackQuery.eq("status", statusFilter);
      }
      const fallback = await fallbackQuery.order("name");
      sites = fallback.data;
    } else {
      sites = primary.data;
    }
  }

  // Filter sites that overlap with this month AND user has access to
  const activeSites = (sites ?? []).filter((site) => {
    // アクセス権チェック: worker_external / client は自分の現場のみ
    if (siteContext.accessibleSiteIds !== null && !siteContext.accessibleSiteIds.includes(site.id)) {
      return false;
    }
    // If no start_date, include if no end_date or end_date hasn't passed
    if (!site.start_date && !site.end_date) return true;
    if (!site.start_date) return !site.end_date || site.end_date >= firstDateStr;
    if (!site.end_date) return site.start_date <= lastDateStr;
    return site.start_date <= lastDateStr && site.end_date >= firstDateStr;
  });

  // Fetch work periods for all active sites
  const siteIdsForPeriods = activeSites.map(s => s.id);
  let allPeriods: { site_id: string; id: string; start_date: string; end_date: string }[] = [];
  if (siteIdsForPeriods.length > 0) {
    const { data: periodsData } = await supabase
      .from("site_work_periods")
      .select("id, site_id, start_date, end_date")
      .in("site_id", siteIdsForPeriods)
      .order("start_date");
    allPeriods = periodsData ?? [];
  }

  // Group periods by site
  const periodsBySite: Record<string, { id: string; startDate: string; endDate: string }[]> = {};
  for (const p of allPeriods) {
    if (!periodsBySite[p.site_id]) periodsBySite[p.site_id] = [];
    periodsBySite[p.site_id].push({ id: p.id, startDate: p.start_date, endDate: p.end_date });
  }

  // Fetch daily reports for the month
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, report_date, site_id")
    .gte("report_date", firstDateStr)
    .lte("report_date", lastDateStr)
    .order("report_date");

  const activeSiteMeta = new Map(
    activeSites.map((site) => [
      site.id,
      { id: site.id, name: site.name, siteNumber: site.site_number },
    ])
  );

  const activeSiteIdsByDate: Record<string, string[]> = {};
  for (const site of activeSites) {
    const periods = periodsBySite[site.id]?.length
      ? periodsBySite[site.id].map((period) => ({
          startDate: period.startDate,
          endDate: period.endDate,
        }))
      : [{
          startDate: site.start_date ?? firstDateStr,
          endDate: site.end_date ?? lastDateStr,
        }];

    for (const period of periods) {
      const clippedStart = period.startDate < firstDateStr ? firstDateStr : period.startDate;
      const clippedEnd = period.endDate > lastDateStr ? lastDateStr : period.endDate;
      if (clippedStart > clippedEnd) continue;

      const current = new Date(`${clippedStart}T00:00:00`);
      const end = new Date(`${clippedEnd}T00:00:00`);
      while (current <= end) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        if (!activeSiteIdsByDate[dateStr]) activeSiteIdsByDate[dateStr] = [];
        activeSiteIdsByDate[dateStr].push(site.id);
        current.setDate(current.getDate() + 1);
      }
    }
  }

  const reportsByDate: Record<string, Set<string>> = {};
  for (const r of reports ?? []) {
    const date = r.report_date;
    if (!reportsByDate[date]) reportsByDate[date] = new Set<string>();
    reportsByDate[date].add(r.site_id);
  }

  // Build calendar data
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const calendarDays: {
    date: string;
    day: number;
    isToday: boolean;
    sites: { id: string; hasReport: boolean }[];
    reportCount: number;
  }[] = [];

  const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const todayStr = `${jstNow.getFullYear()}-${String(jstNow.getMonth() + 1).padStart(2, "0")}-${String(jstNow.getDate()).padStart(2, "0")}`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const reportedSiteIds = reportsByDate[dateStr] ?? new Set<string>();
    const daySites = (activeSiteIdsByDate[dateStr] ?? [])
      .map((siteId) => activeSiteMeta.get(siteId))
      .filter(Boolean)
      .map((site) => ({
        id: site!.id,
        hasReport: reportedSiteIds.has(site!.id),
      }));

    calendarDays.push({
      date: dateStr,
      day: d,
      isToday: dateStr === todayStr,
      sites: daySites,
      reportCount: reportedSiteIds.size,
    });
  }

  // Month navigation
  const prevMonth = monthNum === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNum - 1).padStart(2, "0")}`;
  const nextMonth = monthNum === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNum + 1).padStart(2, "0")}`;

  const monthLabel = `${year}年${monthNum}月`;

  return (
    <CalendarView
      monthLabel={monthLabel}
      prevMonth={prevMonth}
      nextMonth={nextMonth}
      statusFilter={statusFilter}
      startDayOfWeek={startDayOfWeek}
      calendarDays={calendarDays}
      activeSites={activeSites.map((s) => ({
        id: s.id,
        name: s.name,
        siteNumber: s.site_number,
        startDate: s.start_date,
        endDate: s.end_date,
        siteColor: (s.site_color as string | null) ?? "#0EA5E9",
        companyName: (s.companies as { name: string } | null | undefined)?.name ?? null,
      }))}
      monthFirstDate={firstDateStr}
      monthLastDate={lastDateStr}
      userRole={userRole}
      periodsBySite={periodsBySite}
    />
  );
}
