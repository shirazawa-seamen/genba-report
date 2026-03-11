import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { month } = await searchParams;
  const supabase = await createClient();
  const { role: userRole } = await requireUserContext();

  // Determine month to display
  const now = new Date();
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
    | { id: string; name: string; site_number: string | null; start_date: string | null; end_date: string | null; site_color?: string | null }[]
    | null = null;
  {
    const primary = await supabase
      .from("sites")
      .select("id, name, site_number, start_date, end_date, site_color")
      .or(`start_date.is.null,start_date.lte.${lastDateStr}`)
      .or(`end_date.is.null,end_date.gte.${firstDateStr}`)
      .order("name");
    if (primary.error?.message?.includes("site_color")) {
      const fallback = await supabase
        .from("sites")
        .select("id, name, site_number, start_date, end_date")
        .or(`start_date.is.null,start_date.lte.${lastDateStr}`)
        .or(`end_date.is.null,end_date.gte.${firstDateStr}`)
        .order("name");
      sites = fallback.data;
    } else {
      sites = primary.data;
    }
  }

  // Filter sites that overlap with this month
  const activeSites = (sites ?? []).filter((site) => {
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

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
      startDayOfWeek={startDayOfWeek}
      calendarDays={calendarDays}
      activeSites={activeSites.map((s) => ({
        id: s.id,
        name: s.name,
        siteNumber: s.site_number,
        startDate: s.start_date,
        endDate: s.end_date,
        siteColor: (s.site_color as string | null) ?? "#0EA5E9",
      }))}
      monthFirstDate={firstDateStr}
      monthLastDate={lastDateStr}
      userRole={userRole}
      periodsBySite={periodsBySite}
    />
  );
}
