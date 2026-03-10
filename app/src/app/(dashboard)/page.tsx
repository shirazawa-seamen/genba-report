import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Building2,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role ?? 'worker_internal'
  const isAdmin = userRole === 'admin'
  const isOrderer = userRole === 'orderer'

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const today = new Date()
  const jstNow = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  const todayStr = jstNow.toISOString().slice(0, 10)
  const monthStr = todayStr.slice(0, 7)
  const lastDay = new Date(jstNow.getFullYear(), jstNow.getMonth() + 1, 0).getDate()

  const [
    { count: todayReportCount },
    { count: totalSiteCount },
    { data: reportedSites },
    { count: monthReportCount },
    { count: pendingCount },
    { data: recentReports },
  ] = await Promise.all([
    supabase.from('daily_reports').select('*', { count: 'exact', head: true }).eq('report_date', todayStr),
    supabase.from('sites').select('*', { count: 'exact', head: true }),
    supabase.from('daily_reports').select('site_id').eq('report_date', todayStr),
    supabase.from('daily_reports').select('*', { count: 'exact', head: true }).gte('report_date', `${monthStr}-01`).lte('report_date', `${monthStr}-${lastDay}`),
    supabase.from('daily_reports').select('*', { count: 'exact', head: true }).eq('approval_status', 'submitted'),
    supabase.from('daily_reports').select('id, report_date, approval_status, site_id, sites(name)').order('report_date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
  ])

  const reportedSiteIds = new Set((reportedSites ?? []).map((r) => r.site_id))
  const unreportedCount = Math.max(0, (totalSiteCount ?? 0) - reportedSiteIds.size)

  const greeting = isOrderer
    ? '確認が必要な報告をチェックしましょう'
    : isAdmin
      ? '現場の進捗を管理しましょう'
      : '今日の作業を報告しましょう'

  const recentItems = (recentReports ?? []).map((r) => {
    const siteName = (r.sites as unknown as { name: string } | null)?.name ?? '不明な現場'
    const status = r.approval_status ?? 'submitted'
    return {
      id: r.id as string,
      site: siteName,
      date: r.report_date as string,
      status,
      statusLabel: APPROVAL_STATUS_LABELS[status] ?? status,
    }
  })

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">

      {/* ── Header ── */}
      <div className="mb-8">
        <p className="text-[13px] text-[#00D9FF] font-medium mb-1">Welcome back</p>
        <h1 className="text-[24px] font-bold text-white/95 mb-1.5">
          {displayName}
        </h1>
        <p className="text-[14px] text-white/40">{greeting}</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatCard
          icon={FileText}
          label="今日の報告"
          value={todayReportCount ?? 0}
          color="cyan"
        />
        <StatCard
          icon={AlertCircle}
          label="未報告現場"
          value={unreportedCount}
          color={unreportedCount > 0 ? "red" : "default"}
        />
        <StatCard
          icon={Eye}
          label="承認待ち"
          value={pendingCount ?? 0}
          color={(isAdmin || isOrderer) && (pendingCount ?? 0) > 0 ? "amber" : "default"}
        />
        <StatCard
          icon={TrendingUp}
          label="今月合計"
          value={monthReportCount ?? 0}
          color="default"
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="space-y-3 mb-8">
        {!isOrderer && (
          <Link href="/reports/new" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#00D9FF] hover:bg-[#00c4e6] transition-all active:scale-[0.98]">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-black/10">
              <Plus size={20} className="text-[#0e0e0e]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#0e0e0e]">新規報告を作成</p>
              <p className="text-[12px] text-[#0e0e0e]/60">本日の作業を報告する</p>
            </div>
            <ArrowRight size={18} className="text-[#0e0e0e]/40 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        {(isAdmin || isOrderer) && (pendingCount ?? 0) > 0 && (
          <Link href="/reports" className="group flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all active:scale-[0.98]">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/20">
              <Eye size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-amber-200">承認待ちを確認</p>
              <p className="text-[12px] text-amber-200/50">{pendingCount}件の報告が待っています</p>
            </div>
            <ArrowRight size={18} className="text-amber-400/40 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/sites" className="group flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-all active:scale-[0.98]">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00D9FF]/10">
              <Building2 size={18} className="text-[#00D9FF]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/85">現場一覧</p>
              <p className="text-[12px] text-white/35">{totalSiteCount ?? 0}件</p>
            </div>
          </Link>

          <Link href="/reports" className="group flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-all active:scale-[0.98]">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00D9FF]/10">
              <FileText size={18} className="text-[#00D9FF]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/85">報告一覧</p>
              <p className="text-[12px] text-white/35">すべて確認</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Recent Reports ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white/40 uppercase tracking-wider">最近の報告</h2>
          <Link href="/reports" className="text-[12px] text-[#00D9FF]/70 hover:text-[#00D9FF] transition-colors flex items-center gap-1">
            すべて見る <ArrowRight size={11} />
          </Link>
        </div>

        {recentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/25 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <FileText size={28} className="mb-3 text-white/15" />
            <p className="text-[14px]">報告がまだありません</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                href={`/reports/${item.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors active:bg-white/[0.05]"
              >
                <StatusDot status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white/85 truncate font-medium">{item.site}</p>
                  <p className="text-[12px] text-white/30">{item.date}</p>
                </div>
                <span className="text-[11px] text-white/35 shrink-0">
                  {item.statusLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: number
  color: 'cyan' | 'amber' | 'red' | 'default'
}) {
  const colorMap = {
    cyan: { bg: 'bg-[#00D9FF]/10', icon: 'text-[#00D9FF]', value: 'text-[#00D9FF]' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-400', value: 'text-amber-400' },
    red: { bg: 'bg-red-500/10', icon: 'text-red-400', value: 'text-red-400' },
    default: { bg: 'bg-white/[0.06]', icon: 'text-white/40', value: 'text-white/85' },
  }
  const c = colorMap[color]

  return (
    <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={15} className={c.icon} />
        </div>
        <span className="text-[12px] text-white/40 font-medium">{label}</span>
      </div>
      <p className={`text-[28px] font-bold leading-none ${c.value}`}>
        {value}
      </p>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; Icon: React.ElementType }> = {
    submitted: { color: 'text-blue-400', Icon: Clock },
    admin_approved: { color: 'text-emerald-400', Icon: CheckCircle2 },
    orderer_confirmed: { color: 'text-[#00D9FF]', Icon: CheckCircle2 },
    rejected: { color: 'text-red-400', Icon: AlertTriangle },
    draft: { color: 'text-white/25', Icon: FileText },
  }
  const { color, Icon } = config[status] ?? config.draft
  return <Icon size={16} className={`shrink-0 ${color}`} />
}
