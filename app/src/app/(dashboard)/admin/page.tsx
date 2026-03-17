import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  KeyRound,
} from "lucide-react";
import { APPROVAL_STATUS_LABELS } from "@/lib/constants";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

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
    cyan: "bg-cyan-50 text-[#0EA5E9]",
    amber: "bg-amber-50 text-amber-400",
    emerald: "bg-emerald-50 text-emerald-400",
    red: "bg-red-50 text-red-400",
  };

  const content = (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center gap-3.5 hover:border-gray-300 transition-colors shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-gray-900 leading-tight">
          {value}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminPage() {
  const { role } = await requireUserContext();
  if (role !== "admin" && role !== "manager") redirect("/");

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
        <div className="mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              管理者ダッシュボード
            </h1>
            <p className="text-[13px] text-gray-400">
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
          className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#0EA5E9]" />
              <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
                未確認報告
              </h2>
            </div>
            <Link
              href="/reports"
              className="text-[12px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors"
            >
              すべて見る →
            </Link>
          </div>

          {!pendingReports || pendingReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <FileText size={32} className="mb-2 text-gray-200" />
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
                    className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 min-h-[52px] py-2.5 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      <FileText size={16} className="text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-gray-700 truncate">
                        {siteName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span>{report.report_date}</span>
                        <span className="text-gray-200">|</span>
                        <span>{report.work_process}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-50 px-2 py-0.5 rounded-full">
                      {APPROVAL_STATUS_LABELS["submitted"]}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 shrink-0"
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
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <Users size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                ユーザー管理
              </p>
              <p className="text-[11px] text-gray-400">招待・ロール変更</p>
            </div>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <FileText size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                全報告一覧
              </p>
              <p className="text-[11px] text-gray-400">閲覧・承認・差戻し</p>
            </div>
          </Link>
          <Link
            href="/sites"
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <Building2 size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                現場管理
              </p>
              <p className="text-[11px] text-gray-400">
                現場・ドキュメント・材料
              </p>
            </div>
          </Link>
          <Link
            href="/admin/process-templates"
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <Settings size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                標準工程マスター
              </p>
              <p className="text-[11px] text-gray-400">
                工程ID・順序・並行作業を調整
              </p>
            </div>
          </Link>
          <Link
            href="/admin/companies"
            className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <Building2 size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                会社マスター
              </p>
              <p className="text-[11px] text-gray-400">
                会社名を追加・編集・削除
              </p>
            </div>
          </Link>
          {role === "admin" && (
            <Link
              href="/admin/llm-settings"
              className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 hover:bg-cyan-100 transition-colors active:scale-[0.98] shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
                <KeyRound size={18} className="text-[#0EA5E9]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-700">
                  LLM API設定
                </p>
                <p className="text-[11px] text-gray-400">
                  Claude APIキーを安全に保存
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Active Sites */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[#0EA5E9]" />
            <h2 className="text-[13px] font-semibold text-gray-600 tracking-wide">
              稼働中現場
            </h2>
          </div>
          {!sites || sites.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">
              稼働中の現場はありません
            </p>
          ) : (
            <div className="space-y-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 min-h-[48px] py-2.5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50">
                    <Building2 size={14} className="text-[#0EA5E9]" />
                  </div>
                  <span className="text-[13px] font-medium text-gray-700 truncate flex-1">
                    {site.name}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 shrink-0"
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
