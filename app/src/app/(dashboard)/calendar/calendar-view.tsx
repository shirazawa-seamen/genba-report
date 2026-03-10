"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";

interface CalendarDay {
  date: string;
  day: number;
  isToday: boolean;
  sites: { id: string; name: string; siteNumber: string | null; hasReport: boolean }[];
  reportCount: number;
}

interface CalendarViewProps {
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  startDayOfWeek: number;
  calendarDays: CalendarDay[];
  activeSites: { id: string; name: string; siteNumber: string | null }[];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarView({
  monthLabel,
  prevMonth,
  nextMonth,
  startDayOfWeek,
  calendarDays,
  activeSites,
}: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D9FF]">
            <Calendar size={24} className="text-[#0e0e0e]" />
          </div>
          <div className="flex-1">
            <h1 className="text-[22px] font-bold text-white/95 tracking-tight">
              現場カレンダー
            </h1>
            <p className="text-[13px] text-white/40">
              {activeSites.length}件の現場が稼働中
            </p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <h2 className="text-[18px] font-bold text-white/90">{monthLabel}</h2>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`py-2.5 text-center text-[11px] font-semibold tracking-wider ${
                  i === 0 ? "text-red-400/60" : i === 6 ? "text-blue-400/60" : "text-white/35"
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
                className="min-h-[72px] md:min-h-[90px] border-b border-r border-white/[0.04] bg-white/[0.01]"
              />
            ))}

            {calendarDays.map((day) => {
              const dayOfWeek = (startDayOfWeek + day.day - 1) % 7;
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;
              const hasSites = day.sites.length > 0;
              const allReported = hasSites && day.sites.every((s) => s.hasReport);
              const someReported = hasSites && day.sites.some((s) => s.hasReport);

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[72px] md:min-h-[90px] border-b border-r border-white/[0.04] p-1.5 md:p-2 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06] relative ${
                    day.isToday ? "bg-[#00D9FF]/[0.06]" : ""
                  } ${selectedDay?.date === day.date ? "ring-1 ring-inset ring-[#00D9FF]/40" : ""}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] md:text-[14px] font-semibold ${
                        day.isToday
                          ? "text-[#00D9FF]"
                          : isSunday
                            ? "text-red-400/70"
                            : isSaturday
                              ? "text-blue-400/70"
                              : "text-white/70"
                      }`}
                    >
                      {day.day}
                    </span>
                    {day.reportCount > 0 && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                        {day.reportCount}
                      </span>
                    )}
                  </div>

                  {/* Site indicators */}
                  <div className="flex flex-col gap-0.5">
                    {day.sites.slice(0, 3).map((site) => (
                      <div
                        key={site.id}
                        className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] md:text-[10px] truncate ${
                          site.hasReport
                            ? "bg-emerald-500/10 text-emerald-400/80"
                            : "bg-[#00D9FF]/[0.06] text-[#00D9FF]/60"
                        }`}
                      >
                        {site.hasReport ? (
                          <CheckCircle2 size={8} className="shrink-0" />
                        ) : (
                          <Circle size={8} className="shrink-0" />
                        )}
                        <span className="truncate hidden md:inline">
                          {site.siteNumber || site.name}
                        </span>
                      </div>
                    ))}
                    {day.sites.length > 3 && (
                      <span className="text-[9px] text-white/30 px-1">
                        +{day.sites.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Today indicator */}
                  {day.isToday && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00D9FF]" />
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
                className="min-h-[72px] md:min-h-[90px] border-b border-r border-white/[0.04] bg-white/[0.01]"
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-6 text-[11px] text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#00D9FF]/[0.06] border border-[#00D9FF]/20" />
            稼働予定
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/10 border border-emerald-500/20" />
            報告済み
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#00D9FF]/[0.06] border border-[#00D9FF]/40" />
            今日
          </span>
        </div>

        {/* Selected Day Detail */}
        {selectedDay && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#00D9FF]" />
                <h3 className="text-[14px] font-semibold text-white/80">
                  {new Date(selectedDay.date).toLocaleDateString("ja-JP", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </h3>
                {selectedDay.isToday && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#00D9FF]/10 text-[#00D9FF]">
                    今日
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {selectedDay.sites.length === 0 ? (
              <p className="text-[13px] text-white/30 text-center py-4">
                この日に稼働予定の現場はありません
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDay.sites.map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 min-h-[48px] py-2.5 hover:border-white/[0.1] transition-colors"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        site.hasReport
                          ? "bg-emerald-500/10"
                          : "bg-[#00D9FF]/10"
                      }`}
                    >
                      {site.hasReport ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <Building2 size={14} className="text-[#00D9FF]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/80 truncate">
                        {site.name}
                      </p>
                      {site.siteNumber && (
                        <p className="text-[11px] text-[#00D9FF]/50 font-mono">
                          {site.siteNumber}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        site.hasReport
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/[0.06] text-white/35"
                      }`}
                    >
                      {site.hasReport ? "報告済み" : "未報告"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Sites Summary */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-[#00D9FF]" />
            <h3 className="text-[13px] font-semibold text-white/70 tracking-wide">
              今月の稼働現場
            </h3>
          </div>
          {activeSites.length === 0 ? (
            <p className="text-[13px] text-white/30 text-center py-4">
              今月の稼働現場はありません
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00D9FF]/[0.06] border border-[#00D9FF]/10 px-3 py-1.5 text-[12px] text-[#00D9FF]/80 hover:bg-[#00D9FF]/[0.12] transition-colors"
                >
                  <Building2 size={12} />
                  {site.name}
                  {site.siteNumber && (
                    <span className="text-[10px] text-[#00D9FF]/40 font-mono">
                      ({site.siteNumber})
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
