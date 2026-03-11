import { createClient } from '@/lib/supabase/server'
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
} from 'lucide-react'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'
import { requireUserContext } from '@/lib/auth/getCurrentUserContext'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { role: userRole, displayName } = await requireUserContext()
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const isClient = userRole === 'client'

  const [
    { count: totalSiteCount },
    { count: pendingCount },
    { data: recentReports },
  ] = await Promise.all([
    supabase.from('sites').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('daily_reports').select('*', { count: 'exact', head: true }).eq('approval_status', 'submitted'),
    supabase.from('daily_reports').select('id, report_date, approval_status, site_id, sites(name)').order('report_date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
  ])

  const greeting = isClient
    ? '確認が必要な報告をチェックしましょう'
    : (isAdmin || isManager)
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
        <p className="text-[13px] text-[#0EA5E9] font-medium mb-1">Welcome back</p>
        <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">
          {displayName}
        </h1>
        <p className="text-[14px] text-gray-400">{greeting}</p>
      </div>

      {/* ── Quick Actions ── */}
      <div className="space-y-3 mb-8">
        {!isClient && !isManager && (
          <Link href="/reports/new" className="group flex items-center gap-4 p-4 rounded-2xl bg-[#0EA5E9] hover:bg-[#0284C7] transition-all active:scale-[0.98] shadow-md shadow-sky-200">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20">
              <Plus size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-white">新規報告を作成</p>
              <p className="text-[12px] text-white/80">本日の作業を報告する</p>
            </div>
            <ArrowRight size={18} className="text-white/60 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        {(isAdmin || isManager || isClient) && (pendingCount ?? 0) > 0 && (
          <Link href="/reports?status=submitted" className="group flex items-center gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all active:scale-[0.98] shadow-sm">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100">
              <Eye size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-amber-700">承認待ちを確認</p>
              <p className="text-[12px] text-amber-700/50">{pendingCount}件の報告が待っています</p>
            </div>
            <ArrowRight size={18} className="text-amber-400/40 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/sites" className="group flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50">
              <Building2 size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">現場一覧</p>
              <p className="text-[12px] text-gray-500">{totalSiteCount ?? 0}件</p>
            </div>
          </Link>

          <Link href="/reports" className="group flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50">
              <FileText size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">報告一覧</p>
              <p className="text-[12px] text-gray-500">すべて確認</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Recent Reports ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">最近の報告</h2>
          <Link href="/reports" className="text-[12px] text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors flex items-center gap-1">
            すべて見る <ArrowRight size={11} />
          </Link>
        </div>

        {recentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <FileText size={28} className="mb-3 text-gray-200" />
            <p className="text-[14px]">報告がまだありません</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-200 shadow-sm">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                href={`/reports/${item.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                <StatusDot status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-gray-800 truncate font-medium">{item.site}</p>
                  <p className="text-[12px] text-gray-400">{item.date}</p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">
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

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; Icon: React.ElementType }> = {
    submitted: { color: 'text-blue-400', Icon: Clock },
    approved: { color: 'text-emerald-400', Icon: CheckCircle2 },
    client_confirmed: { color: 'text-[#0EA5E9]', Icon: CheckCircle2 },
    rejected: { color: 'text-red-400', Icon: AlertTriangle },
    draft: { color: 'text-gray-300', Icon: FileText },
  }
  const { color, Icon } = config[status] ?? config.draft
  return <Icon size={16} className={`shrink-0 ${color}`} />
}
