"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Building2,
  CheckCircle2,
  X,
  BarChart3,
  GripHorizontal,
  Loader2,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  updateSiteWorkPeriod,
  addSiteWorkPeriod,
  deleteSiteWorkPeriod,
} from "@/app/(dashboard)/sites/actions";
import {
  registerDayOff,
  removeDayOff,
  getStaffList,
} from "./day-off-actions";

interface CalendarDay {
  date: string;
  day: number;
  isToday: boolean;
  sites: { id: string; hasReport: boolean }[];
  reportCount: number;
}

interface ActiveSite {
  id: string;
  name: string;
  siteNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  siteColor?: string | null;
  companyName?: string | null;
}

interface WorkPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

interface DayOffItem {
  id: string;
  user_id: string;
  user_name: string;
  date: string;
  reason: string | null;
}

interface CalendarViewProps {
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  statusFilter: "active" | "completed" | "all";
  startDayOfWeek: number;
  calendarDays: CalendarDay[];
  activeSites: ActiveSite[];
  monthFirstDate: string;
  monthLastDate: string;
  userRole: string;
  periodsBySite: Record<string, WorkPeriod[]>;
  daysOff?: DayOffItem[];
  currentUserId?: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ---------------------------------------------------------------------------
// Color palette for Gantt bars
// ---------------------------------------------------------------------------
const GANTT_COLORS = ["#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function getSiteColor(site: ActiveSite, index: number) {
  return site.siteColor || GANTT_COLORS[index % GANTT_COLORS.length];
}

export function CalendarView({
  monthLabel,
  prevMonth,
  nextMonth,
  statusFilter,
  startDayOfWeek,
  calendarDays,
  activeSites,
  monthFirstDate,
  monthLastDate,
  userRole,
  periodsBySite,
  daysOff = [],
  currentUserId,
}: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "gantt">("calendar");
  const [showDayOffModal, setShowDayOffModal] = useState(false);
  const [dayOffDate, setDayOffDate] = useState<string>("");
  const [dayOffStaffList, setDayOffStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [dayOffUserId, setDayOffUserId] = useState<string>("");
  const [dayOffReason, setDayOffReason] = useState<string>("");
  const [localDaysOff, setLocalDaysOff] = useState(daysOff);
  const isManager = userRole === "admin" || userRole === "manager";
  const activeSiteMap = Object.fromEntries(
    activeSites.map((site) => [site.id, site])
  ) as Record<string, ActiveSite>;

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex-1">
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              現場カレンダー
            </h1>
            <p className="text-[13px] text-gray-400">
              {activeSites.length}件の現場が
              {statusFilter === "completed"
                ? "完了済み"
                : statusFilter === "all"
                  ? "表示中"
                  : "稼働中"}
            </p>
          </div>
        </div>

        {/* Month Navigation Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${prevMonth}&status=${statusFilter}`}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </Link>
            <h2 className="text-[18px] font-bold text-gray-900">{monthLabel}</h2>
            <Link
              href={`/calendar?month=${nextMonth}&status=${statusFilter}`}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {/* Status filter dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  const url = `/calendar?month=${monthFirstDate.slice(0, 7)}&status=${e.target.value}`;
                  window.location.href = url;
                }}
                className="appearance-none min-h-[36px] rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-[12px] font-medium text-gray-600 focus:outline-none focus:border-[#0EA5E9]/50"
              >
                <option value="active">稼働中</option>
                <option value="completed">完了済み</option>
                <option value="all">すべて</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            </div>
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-cyan-100 text-[#0EA5E9]"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Calendar size={12} />
              </button>
              <button
                onClick={() => setViewMode("gantt")}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors border-l border-gray-200 ${
                  viewMode === "gantt"
                    ? "bg-cyan-100 text-[#0EA5E9]"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <BarChart3 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ===== Gantt Chart View ===== */}
        {viewMode === "gantt" && (
          <GanttChart
            activeSites={activeSites}
            monthFirstDate={monthFirstDate}
            monthLastDate={monthLastDate}
            calendarDays={calendarDays}
            userRole={userRole}
            periodsBySite={periodsBySite}
          />
        )}

        {/* ===== Calendar Grid View ===== */}
        {viewMode === "calendar" && <>
        {/* Calendar Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden mb-6 shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`py-2.5 text-center text-[11px] font-semibold tracking-wider ${
                  i === 0 ? "text-red-400/60" : i === 6 ? "text-blue-400/60" : "text-gray-400"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar body */}
          <div className="grid grid-cols-7">
            {/* Empty cells for start offset */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[72px] md:min-h-[90px] border-b border-r border-gray-100 bg-gray-50/50"
              />
            ))}

            {calendarDays.map((day) => {
              const dayOfWeek = (startDayOfWeek + day.day - 1) % 7;
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[72px] md:min-h-[90px] border-b border-r border-gray-100 p-1.5 md:p-2 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 relative ${
                    day.isToday ? "bg-cyan-50/50" : isSunday ? "bg-red-50/50" : isSaturday ? "bg-blue-50/50" : ""
                  } ${selectedDay?.date === day.date ? "ring-1 ring-inset ring-[#0EA5E9]/40" : ""}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] md:text-[14px] font-semibold ${
                        day.isToday
                          ? "text-[#0EA5E9]"
                          : isSunday
                            ? "text-red-400/70"
                            : isSaturday
                              ? "text-blue-400/70"
                              : "text-gray-600"
                      }`}
                    >
                      {day.day}
                    </span>
                  </div>

                  {/* Site indicators */}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {day.sites.slice(0, 3).map((site) => {
                      const meta = activeSiteMap[site.id];
                      if (!meta) return null;

                      return (
                          <div
                            key={site.id}
                            className="truncate rounded px-1 py-0.5 text-[8px] md:text-[10px] leading-tight"
                            style={{
                              backgroundColor: `${(meta.siteColor || "#0EA5E9")}1A`,
                              color: meta.siteColor || "#0EA5E9",
                            }}
                          >
                          {meta.name}
                        </div>
                      );
                    })}
                    {day.sites.length > 3 && (
                      <span className="text-[8px] text-gray-300 px-1">
                        +{day.sites.length - 3}
                      </span>
                    )}
                  </div>

                  {/* 休みスタッフ表示 */}
                  {(() => {
                    const dayOff = localDaysOff.filter((d) => d.date === day.date);
                    if (dayOff.length === 0) return null;
                    return (
                      <div className="mt-0.5">
                        {dayOff.slice(0, 2).map((d) => (
                          <div key={d.id} className="truncate rounded px-1 py-0.5 text-[8px] md:text-[9px] leading-tight bg-orange-100 text-orange-600">
                            休 {d.user_name}
                          </div>
                        ))}
                        {dayOff.length > 2 && (
                          <span className="text-[8px] text-orange-400 px-1">+{dayOff.length - 2}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Today indicator */}
                  {day.isToday && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
                  )}
                </button>
              );
            })}

            {/* Fill remaining cells */}
            {Array.from({
              length: (7 - ((startDayOfWeek + calendarDays.length) % 7)) % 7,
            }).map((_, i) => (
              <div
                key={`fill-${i}`}
                className="min-h-[72px] md:min-h-[90px] border-b border-r border-gray-100 bg-gray-50/50"
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-6 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-50 border border-cyan-200" />
            稼働予定
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
            報告済み
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-50 border border-[#0EA5E9]/40" />
            今日
          </span>
        </div>

        {/* Selected Day Detail */}
        {selectedDay && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#0EA5E9]" />
                <h3 className="text-[14px] font-semibold text-gray-700">
                  {new Date(selectedDay.date).toLocaleDateString("ja-JP", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </h3>
                {selectedDay.isToday && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-[#0EA5E9]">
                    今日
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {selectedDay.sites.length === 0 ? (
              <p className="text-[13px] text-gray-300 text-center py-4">
                この日に稼働予定の現場はありません
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDay.sites.map((site) => {
                  const meta = activeSiteMap[site.id];
                  if (!meta) return null;

                  return (
                    <Link
                      key={site.id}
                      href={`/sites/${site.id}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 min-h-[48px] py-2.5 hover:border-gray-300 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-700 truncate">
                          {meta.name}
                        </p>
                        {meta.companyName && (
                          <p className="text-[11px] text-gray-400 truncate">
                            {meta.companyName}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          site.hasReport
                            ? "bg-emerald-50 text-emerald-400"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {site.hasReport ? "報告済み" : "未報告"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 休みスタッフ */}
            {(() => {
              const dayOff = localDaysOff.filter((d) => d.date === selectedDay.date);
              return (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[12px] font-semibold text-orange-500">休みスタッフ</h4>
                    <button
                      type="button"
                      onClick={async () => {
                        setDayOffDate(selectedDay.date);
                        setDayOffUserId(currentUserId ?? "");
                        setDayOffReason("");
                        if (isManager) {
                          const result = await getStaffList();
                          if (result.success) setDayOffStaffList(result.staff ?? []);
                        }
                        setShowDayOffModal(true);
                      }}
                      className="text-[11px] text-orange-500 hover:text-orange-600 font-medium"
                    >
                      + 休み登録
                    </button>
                  </div>
                  {dayOff.length === 0 ? (
                    <p className="text-[11px] text-gray-300">休みの登録はありません</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dayOff.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2">
                          <div>
                            <span className="text-[12px] font-medium text-orange-700">{d.user_name}</span>
                            {d.reason && <span className="text-[10px] text-orange-400 ml-2">{d.reason}</span>}
                          </div>
                          {(isManager || d.user_id === currentUserId) && (
                            <button
                              type="button"
                              onClick={async () => {
                                await removeDayOff({ userId: d.user_id, date: d.date });
                                setLocalDaysOff((prev) => prev.filter((x) => x.id !== d.id));
                              }}
                              className="text-orange-300 hover:text-orange-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* 休み登録モーダル */}
        {showDayOffModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDayOffModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900">休み登録</h3>
              <p className="text-[13px] text-gray-500">
                {new Date(dayOffDate).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
              </p>
              {isManager && dayOffStaffList.length > 0 && (
                <div>
                  <label className="text-[13px] font-medium text-gray-500 block mb-1.5">スタッフ</label>
                  <select
                    value={dayOffUserId}
                    onChange={(e) => setDayOffUserId(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px]"
                  >
                    <option value="">選択してください</option>
                    {dayOffStaffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[13px] font-medium text-gray-500 block mb-1.5">理由（任意）</label>
                <input
                  type="text"
                  value={dayOffReason}
                  onChange={(e) => setDayOffReason(e.target.value)}
                  placeholder="有給、私用、体調不良など"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] placeholder-gray-400 focus:outline-none focus:border-[#0EA5E9]/50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowDayOffModal(false)}
                  className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[12px] font-medium text-gray-600 hover:bg-gray-100">
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={!dayOffUserId}
                  onClick={async () => {
                    if (!dayOffUserId) return;
                    const result = await registerDayOff({
                      userId: dayOffUserId,
                      date: dayOffDate,
                      reason: dayOffReason || undefined,
                    });
                    if (result.success) {
                      const staffName = dayOffStaffList.find((s) => s.id === dayOffUserId)?.name ?? "自分";
                      setLocalDaysOff((prev) => [...prev, {
                        id: `temp-${Date.now()}`,
                        user_id: dayOffUserId,
                        user_name: staffName,
                        date: dayOffDate,
                        reason: dayOffReason || null,
                      }]);
                      setShowDayOffModal(false);
                    }
                  }}
                  className="inline-flex min-h-[36px] items-center rounded-xl bg-orange-500 px-4 text-[12px] font-medium text-white hover:bg-orange-600 disabled:opacity-40"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Sites Summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-[#0EA5E9]" />
            <h3 className="text-[13px] font-semibold text-gray-600 tracking-wide">
              今月の稼働現場
            </h3>
          </div>
          {activeSites.length === 0 ? (
            <p className="text-[13px] text-gray-300 text-center py-4">
              今月の稼働現場はありません
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="inline-flex flex-col rounded-lg border px-3 py-1.5 text-[12px] transition-colors"
                  style={{
                    backgroundColor: `${(site.siteColor || "#0EA5E9")}14`,
                    borderColor: `${site.siteColor || "#0EA5E9"}55`,
                    color: site.siteColor || "#0EA5E9",
                  }}
                >
                  <span>{site.siteNumber && <span className="opacity-60 mr-1">{site.siteNumber}</span>}{site.name}</span>
                  {site.companyName && (
                    <span className="text-[10px] text-gray-400">
                      {site.companyName}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
        </>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gantt Chart Component with Multi-Bar Periods + Drag & Drop
// ---------------------------------------------------------------------------
type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  siteId: string;
  periodId: string;
  mode: DragMode;
  initialMouseX: number;
  initialStartDay: number;
  initialEndDay: number;
  containerLeft: number;
  containerWidth: number;
}

function GanttChart({
  activeSites,
  monthFirstDate,
  monthLastDate,
  calendarDays,
  userRole,
  periodsBySite,
}: {
  activeSites: ActiveSite[];
  monthFirstDate: string;
  monthLastDate: string;
  calendarDays: CalendarDay[];
  userRole: string;
  periodsBySite: Record<string, WorkPeriod[]>;
}) {
  const canEdit = userRole === "admin" || userRole === "manager";
  const daysInMonth = calendarDays.length;
  const monthYear = parseInt(monthFirstDate.split("-")[0], 10);
  const monthNum = parseInt(monthFirstDate.split("-")[1], 10);

  // Mobile: collapsible site column
  const [siteColCollapsed, setSiteColCollapsed] = useState(false);

  // Today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayDay = todayStr >= monthFirstDate && todayStr <= monthLastDate
    ? parseInt(todayStr.split("-")[2], 10)
    : null;

  // Drag state
  const [dragKey, setDragKey] = useState<string | null>(null); // "siteId:periodId"
  const [dragPreview, setDragPreview] = useState<{ startDay: number; endDay: number } | null>(null);
  const dragPreviewRef = useRef<{ startDay: number; endDay: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const barAreaRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Saving state
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Local overrides for optimistic updates on periods: key = periodId
  const [localPeriodOverrides, setLocalPeriodOverrides] = useState<Map<string, { startDate: string; endDate: string }>>(new Map());

  // Build report set for quick lookup
  const reportDatesPerSite = new Map<string, Set<string>>();
  for (const day of calendarDays) {
    for (const site of day.sites) {
      if (site.hasReport) {
        if (!reportDatesPerSite.has(site.id)) reportDatesPerSite.set(site.id, new Set());
        reportDatesPerSite.get(site.id)!.add(day.date);
      }
    }
  }

  // Helper: day number -> date string
  const dayToDate = useCallback((d: number) => {
    return `${monthYear}-${String(monthNum).padStart(2, "0")}-${String(Math.max(1, Math.min(d, daysInMonth))).padStart(2, "0")}`;
  }, [monthYear, monthNum, daysInMonth]);

  // Helper: x position -> day number
  const xToDay = useCallback((x: number, containerLeft: number, containerWidth: number) => {
    const pct = (x - containerLeft) / containerWidth;
    const day = Math.round(pct * daysInMonth) + 1;
    return Math.max(1, Math.min(day, daysInMonth));
  }, [daysInMonth]);

  // Helper: add days to a date string
  const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Drag handlers for individual period bars
  const handleDragStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    siteId: string,
    periodId: string,
    mode: DragMode,
    startDay: number,
    endDay: number,
  ) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();

    const barArea = barAreaRefs.current.get(siteId);
    if (!barArea) return;

    const rect = barArea.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

    dragRef.current = {
      siteId,
      periodId,
      mode,
      initialMouseX: clientX,
      initialStartDay: startDay,
      initialEndDay: endDay,
      containerLeft: rect.left,
      containerWidth: rect.width,
    };
    setDragKey(`${siteId}:${periodId}`);
    setDragPreview({ startDay, endDay });
    dragPreviewRef.current = { startDay, endDay };
    document.body.style.touchAction = "none";
    document.body.style.overflow = "hidden";

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if ("touches" in ev) ev.preventDefault();
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const deltaDays = xToDay(cx, drag.containerLeft, drag.containerWidth) - xToDay(drag.initialMouseX, drag.containerLeft, drag.containerWidth);

      let newStart = drag.initialStartDay;
      let newEnd = drag.initialEndDay;

      if (drag.mode === "move") {
        newStart = drag.initialStartDay + deltaDays;
        newEnd = drag.initialEndDay + deltaDays;
        if (newStart < 1) { newEnd += (1 - newStart); newStart = 1; }
        if (newEnd > daysInMonth) { newStart -= (newEnd - daysInMonth); newEnd = daysInMonth; }
        newStart = Math.max(1, newStart);
      } else if (drag.mode === "resize-start") {
        newStart = Math.max(1, Math.min(drag.initialStartDay + deltaDays, newEnd));
      } else if (drag.mode === "resize-end") {
        newEnd = Math.min(daysInMonth, Math.max(drag.initialEndDay + deltaDays, newStart));
      }

      const preview = { startDay: newStart, endDay: newEnd };
      setDragPreview(preview);
      dragPreviewRef.current = preview;
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);
      document.body.style.touchAction = "";
      document.body.style.overflow = "";

      const drag = dragRef.current;
      if (!drag) {
        setDragPreview(null);
        setDragKey(null);
        return;
      }

      // Read the current preview before clearing
      const finalPreview = dragPreviewRef.current;

      // Clear drag UI state first
      setDragPreview(null);
      dragPreviewRef.current = null;
      setDragKey(null);
      dragRef.current = null;

      if (!finalPreview) return;

      const newStartDate = dayToDate(finalPreview.startDay);
      const newEndDate = dayToDate(finalPreview.endDay);

      // Only save if changed
      if (finalPreview.startDay === drag.initialStartDay && finalPreview.endDay === drag.initialEndDay) return;

      const isVirtualPeriod = drag.periodId.startsWith("virtual-");

      if (isVirtualPeriod) {
        // Virtual bar: create a new real period
        startTransition(async () => {
          const result = await addSiteWorkPeriod({
            siteId: drag.siteId,
            startDate: newStartDate,
            endDate: newEndDate,
          });
          if (result.success) {
            setSaveMessage({ type: "success", text: "稼働期間を作成しました" });
            // Reload to get the new period ID
            window.location.reload();
          } else {
            setSaveMessage({ type: "error", text: result.error || "作成に失敗しました" });
          }
          setTimeout(() => setSaveMessage(null), 2000);
        });
      } else {
        // Real bar: update existing period
        // Optimistic update
        setLocalPeriodOverrides((m) => {
          const next = new Map(m);
          next.set(drag.periodId, { startDate: newStartDate, endDate: newEndDate });
          return next;
        });

        startTransition(async () => {
          const result = await updateSiteWorkPeriod({
            periodId: drag.periodId,
            siteId: drag.siteId,
            startDate: newStartDate,
            endDate: newEndDate,
          });
          if (result.success) {
            setSaveMessage({ type: "success", text: "稼働期間を更新しました" });
          } else {
            setSaveMessage({ type: "error", text: result.error || "更新に失敗しました" });
            setLocalPeriodOverrides((m) => {
              const next = new Map(m);
              next.delete(drag.periodId);
              return next;
            });
          }
          setTimeout(() => setSaveMessage(null), 2000);
        });
      }
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("touchcancel", handleEnd);
  }, [canEdit, daysInMonth, xToDay, dayToDate]);

  // Add period handler
  const handleAddPeriod = useCallback((siteId: string, periods: WorkPeriod[]) => {
    let newStart: string;
    let newEnd: string;
    if (periods.length > 0) {
      // Start from the day after the last period ends, default 7 days
      const lastEnd = periods[periods.length - 1].endDate;
      const override = localPeriodOverrides.get(periods[periods.length - 1].id);
      const effectiveLastEnd = override?.endDate ?? lastEnd;
      newStart = addDaysToDate(effectiveLastEnd, 1);
      newEnd = addDaysToDate(effectiveLastEnd, 7);
    } else {
      // No periods yet: start from the 1st of the month, 7 days
      newStart = monthFirstDate;
      newEnd = addDaysToDate(monthFirstDate, 6);
    }

    startTransition(async () => {
      const result = await addSiteWorkPeriod({
        siteId,
        startDate: newStart,
        endDate: newEnd,
      });
      if (result.success) {
        setSaveMessage({ type: "success", text: "稼働期間を追加しました" });
      } else {
        setSaveMessage({ type: "error", text: result.error || "追加に失敗しました" });
      }
      setTimeout(() => setSaveMessage(null), 2000);
    });
  }, [monthFirstDate, localPeriodOverrides]);

  // Delete period handler
  const handleDeletePeriod = useCallback((periodId: string, siteId: string) => {
    if (!confirm("この稼働期間を削除しますか？")) return;
    startTransition(async () => {
      const result = await deleteSiteWorkPeriod(periodId, siteId);
      if (result.success) {
        setSaveMessage({ type: "success", text: "稼働期間を削除しました" });
      } else {
        setSaveMessage({ type: "error", text: result.error || "削除に失敗しました" });
      }
      setTimeout(() => setSaveMessage(null), 2000);
    });
  }, []);

  // Week markers (Saturdays & Sundays)
  const sundays: number[] = [];
  const saturdays: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(monthYear, monthNum - 1, d).getDay();
    if (dayOfWeek === 0) sundays.push(d);
    if (dayOfWeek === 6) saturdays.push(d);
  }

  // Build rows: for each site, resolve its periods
  const siteRows = activeSites.map((site, idx) => {
    const color = getSiteColor(site, idx);
    const rawPeriods = periodsBySite[site.id];
    const hasPeriods = rawPeriods && rawPeriods.length > 0;

    // If site has work_periods, use them; otherwise use site start/end as a single virtual period
    let periods: (WorkPeriod & { isVirtual?: boolean })[];
    if (hasPeriods) {
      periods = rawPeriods.map((p) => {
        const override = localPeriodOverrides.get(p.id);
        return {
          id: p.id,
          startDate: override?.startDate ?? p.startDate,
          endDate: override?.endDate ?? p.endDate,
          isVirtual: false,
        };
      });
    } else {
      // Backward compatible: use site dates as a single virtual period
      const sd = site.startDate ?? monthFirstDate;
      const ed = site.endDate ?? monthLastDate;
      periods = [{ id: `virtual-${site.id}`, startDate: sd, endDate: ed, isVirtual: true }];
    }

    // Calculate bar positions for each period
    const bars = periods.map((period) => {
      const barStart = period.startDate < monthFirstDate ? monthFirstDate : period.startDate;
      const barEnd = period.endDate > monthLastDate ? monthLastDate : period.endDate;

      // Skip periods outside the month
      if (barStart > monthLastDate || barEnd < monthFirstDate) return null;

      const startDay = parseInt(barStart.split("-")[2], 10);
      const endDay = parseInt(barEnd.split("-")[2], 10);

      const isDragging = dragKey === `${site.id}:${period.id}`;
      const displayStart = isDragging && dragPreview ? dragPreview.startDay : startDay;
      const displayEnd = isDragging && dragPreview ? dragPreview.endDay : endDay;

      const leftPct = ((displayStart - 1) / daysInMonth) * 100;
      const widthPct = ((displayEnd - displayStart + 1) / daysInMonth) * 100;

      const reportDates = reportDatesPerSite.get(site.id);
      const totalDays = displayEnd - displayStart + 1;
      const reportedDays = reportDates ? [...reportDates].filter(d => d >= barStart && d <= barEnd).length : 0;

      return {
        period,
        startDay: displayStart,
        endDay: displayEnd,
        leftPct,
        widthPct,
        totalDays,
        reportedDays,
        isDragging,
        isVirtual: period.isVirtual ?? false,
      };
    }).filter(Boolean) as {
      period: WorkPeriod & { isVirtual?: boolean };
      startDay: number;
      endDay: number;
      leftPct: number;
      widthPct: number;
      totalDays: number;
      reportedDays: number;
      isDragging: boolean;
      isVirtual: boolean;
    }[];

    return { site, color, bars, hasPeriods, periods: hasPeriods ? rawPeriods : [] };
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden mb-6 shadow-sm">
      {/* Save message toast */}
      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-2 text-[12px] border-b ${
          saveMessage.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
            : "bg-red-50 border-red-200 text-red-400"
        }`}>
          {isPending && <Loader2 size={12} className="animate-spin" />}
          {saveMessage.text}
        </div>
      )}

      {/* Mobile collapse toggle */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
        <button
          onClick={() => setSiteColCollapsed(!siteColCollapsed)}
          className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#0EA5E9] transition-colors"
        >
          {siteColCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          {siteColCollapsed ? "現場名を表示" : "現場名を畳む"}
        </button>
        <span className="text-[10px] text-gray-400">← 横スクロールで全日表示</span>
      </div>

      {/* Scrollable container for mobile */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: "640px" }}>

      {/* Header / day numbers */}
      <div className="flex border-b border-gray-200">
        {/* Site name column */}
        <div className={`${siteColCollapsed ? "w-[40px]" : "w-[120px]"} md:w-[160px] shrink-0 border-r border-gray-200 px-1.5 md:px-3 py-2.5 flex items-center justify-center md:justify-start transition-all sticky left-0 z-10 bg-white`}>
          {siteColCollapsed ? (
            <Building2 size={14} className="text-gray-400" />
          ) : (
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">現場</span>
          )}
        </div>
        {/* Day columns */}
        <div className="flex-1 flex relative">
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dayOfWeek = new Date(monthYear, monthNum - 1, d).getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isToday = d === todayDay;
            return (
              <div
                key={d}
                className={`flex-1 text-center py-2 text-[9px] md:text-[10px] font-medium border-r border-gray-100 ${
                  isToday ? "bg-cyan-50 text-[#0EA5E9] font-bold" :
                  isSunday ? "bg-red-50/50 text-red-400/50" :
                  isSaturday ? "bg-blue-50/50 text-blue-400/50" :
                  "text-gray-400"
                }`}
              >
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {/* Site rows */}
      {siteRows.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-300">
          <p className="text-[13px]">今月の稼働現場はありません</p>
        </div>
      ) : (
        siteRows.map(({ site, color, bars, periods }, idx) => {
          const anyDragging = bars.some(b => b.isDragging);
          return (
            <div
              key={site.id}
              className={`flex border-b border-gray-100 transition-colors ${
                anyDragging ? "bg-gray-50" : idx % 2 === 0 ? "hover:bg-gray-50/50" : "bg-gray-50/30 hover:bg-gray-50"
              }`}
            >
              {/* Site name */}
              <Link
                href={`/sites/${site.id}`}
                className={`${siteColCollapsed ? "w-[40px]" : "w-[120px]"} md:w-[160px] shrink-0 border-r border-gray-200 px-1.5 md:px-3 py-3 flex flex-col justify-center items-center md:items-start gap-0.5 hover:bg-gray-50 transition-all sticky left-0 z-10 bg-white`}
                title={site.name}
              >
                {siteColCollapsed ? (
                      <span className="w-full truncate text-[10px] font-bold text-center" style={{ color }}>
                    {site.name.slice(0, 2)}
                  </span>
                ) : (
                  <>
                      <span className="w-full truncate text-[11px] md:text-[12px] font-medium" style={{ color }}>
                      {site.siteNumber && <span className="opacity-50 mr-0.5 text-[9px]">{site.siteNumber}</span>}{site.name}
                    </span>
                  </>
                )}
              </Link>

              {/* Gantt bar area */}
              <div
                className="flex-1 relative py-2 px-0.5"
                style={{ minHeight: "36px" }}
                ref={(el) => { if (el) barAreaRefs.current.set(site.id, el); }}
              >
                {/* Weekend background stripes */}
                {saturdays.map(d => (
                  <div
                    key={`sat-${d}`}
                    className="absolute top-0 bottom-0 bg-blue-50/40"
                    style={{ left: `${((d - 1) / daysInMonth) * 100}%`, width: `${(1 / daysInMonth) * 100}%` }}
                  />
                ))}
                {sundays.map(d => (
                  <div
                    key={`sun-${d}`}
                    className="absolute top-0 bottom-0 bg-red-50/40"
                    style={{ left: `${((d - 1) / daysInMonth) * 100}%`, width: `${(1 / daysInMonth) * 100}%` }}
                  />
                ))}

                {/* Today line */}
                {todayDay && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-[#0EA5E9]/30 z-10"
                    style={{ left: `${((todayDay - 0.5) / daysInMonth) * 100}%` }}
                  />
                )}

                {/* Render bars */}
                {bars.length === 0 && canEdit ? (
                  /* No periods and no virtual bar visible this month: show add button */
                  <button
                    onClick={() => handleAddPeriod(site.id, periods)}
                    disabled={isPending}
                    className="absolute top-2 bottom-2 left-1 flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-[#0EA5E9] hover:text-[#0EA5E9] transition-colors"
                  >
                    <Plus size={10} />
                    稼働期間を追加
                  </button>
                ) : (
                  bars.map((bar) => (
                    <div
                      key={bar.period.id}
                      className={`absolute top-2 bottom-2 rounded-md border flex items-center overflow-hidden touch-none ${
                        canEdit && !bar.isVirtual ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                      } ${bar.isDragging ? "ring-2 ring-gray-300 shadow-lg z-20" : ""} group`}
                      style={{
                        left: `${bar.leftPct}%`,
                        width: `${bar.widthPct}%`,
                        minWidth: "4px",
                        backgroundColor: `${color}26`,
                        borderColor: `${color}66`,
                      }}
                      title={
                        canEdit
                          ? `${site.name}: ドラッグで移動、端をドラッグでリサイズ`
                          : `${site.name}: ${bar.totalDays}日間 / 報告${bar.reportedDays}件`
                      }
                      onMouseDown={(e) => {
                        if (!canEdit) return;
                        handleDragStart(e, site.id, bar.period.id, "move", bar.startDay, bar.endDay);
                      }}
                      onTouchStart={(e) => {
                        if (!canEdit) return;
                        handleDragStart(e, site.id, bar.period.id, "move", bar.startDay, bar.endDay);
                      }}
                    >
                      {/* Progress fill */}
                      {bar.totalDays > 0 && bar.reportedDays > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-l-md opacity-30"
                          style={{
                            width: `${(bar.reportedDays / bar.totalDays) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      )}

                      {/* Left resize handle */}
                      {canEdit && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, site.id, bar.period.id, "resize-start", bar.startDay, bar.endDay); }}
                          onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, site.id, bar.period.id, "resize-start", bar.startDay, bar.endDay); }}
                        >
                          <div className="w-0.5 h-3 rounded-full bg-gray-500/40" />
                        </div>
                      )}

                      {/* Label */}
                      <span className="relative z-10 truncate whitespace-nowrap select-none px-1.5 text-[9px] md:text-[10px] font-medium" style={{ color }}>
                        {site.name}
                        {bar.reportedDays > 0 && (
                          <span className="ml-1 opacity-60">({bar.reportedDays}/{bar.totalDays})</span>
                        )}
                      </span>

                      {/* Delete button on hover (for real periods only) */}
                      {canEdit && !bar.isVirtual && (
                        <button
                          className="absolute right-4 top-0 bottom-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleDeletePeriod(bar.period.id, site.id); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="この稼働期間を削除"
                        >
                          <Trash2 size={10} className="text-red-400 hover:text-red-500" />
                        </button>
                      )}

                      {/* Right resize handle */}
                      {canEdit && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, site.id, bar.period.id, "resize-end", bar.startDay, bar.endDay); }}
                          onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, site.id, bar.period.id, "resize-end", bar.startDay, bar.endDay); }}
                        >
                          <div className="w-0.5 h-3 rounded-full bg-gray-500/40" />
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* "+" button to add new period */}
                {canEdit && bars.length > 0 && (
                  <button
                    onClick={() => handleAddPeriod(site.id, periods)}
                    disabled={isPending}
                    className="absolute top-2 bottom-2 z-10 flex items-center justify-center w-5 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-[#0EA5E9] hover:text-[#0EA5E9] hover:bg-cyan-50 transition-colors"
                    style={{
                      // Position after the last bar
                      left: `${Math.min(
                        bars.reduce((max, b) => Math.max(max, b.leftPct + b.widthPct), 0) + 0.5,
                        98
                      )}%`,
                    }}
                    title="稼働期間を追加"
                  >
                    <Plus size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

        </div>{/* end minWidth */}
      </div>{/* end overflow-x-auto */}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-2.5 rounded-sm bg-cyan-100 border border-cyan-300" />
          工期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-cyan-200" />
          報告済み
        </span>
        {todayDay && (
          <span className="flex items-center gap-1.5">
            <span className="w-px h-3 bg-[#0EA5E9]/50" />
            今日
          </span>
        )}
        {canEdit && (
          <span className="flex items-center gap-1.5 ml-auto">
            <GripHorizontal size={10} />
            ドラッグで日程変更
          </span>
        )}
      </div>
    </div>
  );
}
