import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  AlertTriangle,
  Users,
  FileText,
  Building2,
  Clock,
  ChevronRight,
  Settings,
  TrendingUp,
} from "lucide-react";
import { APPROVAL_STATUS_LABELS } from "@/lib/constants";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "cyan",
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: "cyan" | "amber" | "emerald" | "red";
  href?: string;
}) {
  const colorMap = {
    cyan: "bg-[#00D9FF]/10 text-[#00D9FF]",
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    red: "bg-red-500/10 text-red-400",
  };

  const content = (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3.5 hover:border-white/[0.1] transition-colors">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-white/90 leading-tight">
          {value}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminPage() {
  const supabase = await createClient();

  // 未確認報告数
  const { count: pendingCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "submitted");

  // 本日の報告数
  const today = new Date().toISOString().split("T")[0];
  const { count: todayCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("report_date", today);

  // 稼働中現場数
  const { count: activeSitesCount } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // ユーザー数
  const { count: usersCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // 未確認報告一覧（最新10件）
  const { data: pendingReports } = await supabase
    .from("daily_reports")
    .select("id, report_date, work_process, approval_status, site:sites(name), reporter:profiles!daily_reports_reporter_id_fkey(id)")
    .eq("approval_status", "submitted")
    .order("created_at", { ascending: false })
    .limit(10);

  // 現場別活動状況
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, status")
    .eq("status", "active")
    .order("name");

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D9FF]">
            <Settings size={24} className="text-[#0e0e0e]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white/95 tracking-tight">
              管理者ダッシュボード
            </h1>
            <p className="text-[13px] text-white/40">
              システム全体の状況を管理
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="未確認報告"
            value={pendingCount ?? 0}
            icon={AlertTriangle}
            color={pendingCount && pendingCount > 0 ? "red" : "cyan"}
            href="/admin#pending"
          />
          <StatCard
            label="本日の報告"
            value={todayCount ?? 0}
            icon={FileText}
            color="emerald"
          />
          <StatCard
            label="稼働中現場"
            value={activeSitesCount ?? 0}
            icon={Building2}
            color="cyan"
          />
          <StatCard
            label="ユーザー数"
            value={usersCount ?? 0}
            icon={Users}
            color="amber"
            href="/admin/users"
          />
        </div>

        {/* Pending Reports */}
        <div
          id="pending"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#00D9FF]" />
              <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
                未確認報告
              </h2>
            </div>
            <Link
              href="/reports"
              className="text-[12px] text-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors"
            >
              すべて見る →
            </Link>
          </div>

          {!pendingReports || pendingReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-white/30">
              <FileText size={32} className="mb-2 text-white/15" />
              <p className="text-[13px]">未確認の報告はありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReports.map((report) => {
                const siteName =
                  (report.site as { name?: string } | null)?.name ?? "不明";
                return (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 min-h-[52px] py-2.5 hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                      <FileText size={16} className="text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/80 truncate">
                        {siteName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-white/35">
                        <span>{report.report_date}</span>
                        <span className="text-white/15">|</span>
                        <span>{report.work_process}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {APPROVAL_STATUS_LABELS["submitted"]}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-white/20 shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Link
            href="/admin/users"
            className="flex items-center gap-3 rounded-2xl border border-[#00D9FF]/15 bg-[#00D9FF]/[0.04] p-4 hover:bg-[#00D9FF]/[0.08] transition-colors active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/15">
              <Users size={18} className="text-[#00D9FF]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/80">
                ユーザー管理
              </p>
              <p className="text-[11px] text-white/35">招待・ロール変更</p>
            </div>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-3 rounded-2xl border border-[#00D9FF]/15 bg-[#00D9FF]/[0.04] p-4 hover:bg-[#00D9FF]/[0.08] transition-colors active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/15">
              <FileText size={18} className="text-[#00D9FF]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/80">
                全報告一覧
              </p>
              <p className="text-[11px] text-white/35">閲覧・承認・差戻し</p>
            </div>
          </Link>
          <Link
            href="/sites"
            className="flex items-center gap-3 rounded-2xl border border-[#00D9FF]/15 bg-[#00D9FF]/[0.04] p-4 hover:bg-[#00D9FF]/[0.08] transition-colors active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D9FF]/15">
              <Building2 size={18} className="text-[#00D9FF]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/80">
                現場管理
              </p>
              <p className="text-[11px] text-white/35">
                現場・ドキュメント・材料
              </p>
            </div>
          </Link>
        </div>

        {/* Active Sites */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[#00D9FF]" />
            <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
              稼働中現場
            </h2>
          </div>
          {!sites || sites.length === 0 ? (
            <p className="text-[13px] text-white/30 text-center py-4">
              稼働中の現場はありません
            </p>
          ) : (
            <div className="space-y-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 min-h-[48px] py-2.5 hover:border-white/[0.1] transition-colors"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#00D9FF]/10">
                    <Building2 size={14} className="text-[#00D9FF]" />
                  </div>
                  <span className="text-[13px] font-medium text-white/80 truncate flex-1">
                    {site.name}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-white/20 shrink-0"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
