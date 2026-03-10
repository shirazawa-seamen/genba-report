import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarView } from "./calendar-view";

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { month } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, site_number, start_date, end_date")
    .or(`start_date.is.null,start_date.lte.${lastDateStr}`)
    .or(`end_date.is.null,end_date.gte.${firstDateStr}`)
    .order("name");

  // Filter sites that overlap with this month
  const activeSites = (sites ?? []).filter((site) => {
    // If no start_date, include if no end_date or end_date hasn't passed
    if (!site.start_date && !site.end_date) return true;
    if (!site.start_date) return !site.end_date || site.end_date >= firstDateStr;
    if (!site.end_date) return site.start_date <= lastDateStr;
    return site.start_date <= lastDateStr && site.end_date >= firstDateStr;
  });

  // Fetch daily reports for the month
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, report_date, site_id, sites(name)")
    .gte("report_date", firstDateStr)
    .lte("report_date", lastDateStr)
    .order("report_date");

  // Build report map: date -> site_ids
  const reportsByDate: Record<string, { siteId: string; siteName: string; reportId: string }[]> = {};
  for (const r of reports ?? []) {
    const date = r.report_date;
    if (!reportsByDate[date]) reportsByDate[date] = [];
    const siteName = (r.sites as { name?: string } | null)?.name ?? "不明";
    reportsByDate[date].push({ siteId: r.site_id, siteName, reportId: r.id });
  }

  // Build calendar data
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const calendarDays: {
    date: string;
    day: number;
    isToday: boolean;
    sites: { id: string; name: string; siteNumber: string | null; hasReport: boolean }[];
    reportCount: number;
  }[] = [];

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayReports = reportsByDate[dateStr] ?? [];
    const reportedSiteIds = new Set(dayReports.map((r) => r.siteId));

    // Sites active on this day
    const daySites = activeSites
      .filter((site) => {
        if (!site.start_date && !site.end_date) return true;
        const start = site.start_date ?? "0000-01-01";
        const end = site.end_date ?? "9999-12-31";
        return dateStr >= start && dateStr <= end;
      })
      .map((site) => ({
        id: site.id,
        name: site.name,
        siteNumber: site.site_number,
        hasReport: reportedSiteIds.has(site.id),
      }));

    calendarDays.push({
      date: dateStr,
      day: d,
      isToday: dateStr === todayStr,
      sites: daySites,
      reportCount: dayReports.length,
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
      }))}
    />
  );
}
