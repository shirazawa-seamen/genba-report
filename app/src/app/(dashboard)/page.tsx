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
  Sparkles,
} from 'lucide-react'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'
import { requireUserContext } from '@/lib/auth/getCurrentUserContext'
import { getAccessibleSiteContext } from '@/lib/siteAccess'
import { getWorkerTodayInfo, generateWorkerAdvice } from './worker-advice-action'

interface PageProps {
  searchParams: Promise<{ pendingScope?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { pendingScope: pendingScopeParam } = await searchParams
  const supabase = await createClient()
  const { user, role: userRole, displayName } = await requireUserContext()
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const isClient = userRole === 'client'
  const accessContext = await getAccessibleSiteContext(user.id)
  const pendingScope = isManager && pendingScopeParam === 'mine' ? 'mine' : 'all'
  const pendingSiteIds =
    pendingScope === 'mine' ? accessContext.assignedSiteIds : accessContext.accessibleSiteIds
  let siteCountQuery = supabase.from('sites').select('*', { count: 'exact', head: true }).eq('status', 'active')
  if (accessContext.accessibleSiteIds) {
    if (accessContext.accessibleSiteIds.length === 0) {
      siteCountQuery = supabase.from('sites').select('*', { count: 'exact', head: true }).in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      siteCountQuery = siteCountQuery.in('id', accessContext.accessibleSiteIds)
    }
  }

  const isWorkerRole = userRole === 'worker_internal' || userRole === 'worker_external'

  // 承認待ちカウント用（グループ化ベース）
  let pendingDataQuery = supabase
    .from('daily_reports')
    .select('site_id, reporter_id, report_date')
    .eq('approval_status', 'submitted')
    .limit(500)
  let recentReportsQuery = supabase
    .from('daily_reports')
    .select('id, report_date, approval_status, site_id, reporter_id, sites(name)')
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // ワーカーは自分の報告のみ
  if (isWorkerRole) {
    recentReportsQuery = recentReportsQuery.eq('reporter_id', user.id)
  }

  if (pendingSiteIds) {
    if (pendingSiteIds.length === 0) {
      pendingDataQuery = pendingDataQuery.in('site_id', ['00000000-0000-0000-0000-000000000000'])
      recentReportsQuery = recentReportsQuery.in('site_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      pendingDataQuery = pendingDataQuery.in('site_id', pendingSiteIds)
      recentReportsQuery = recentReportsQuery.in('site_id', pendingSiteIds)
    }
  }

  const [{ count: totalSiteCount }, { data: pendingData }, { data: recentReports }] = await Promise.all([
    siteCountQuery,
    pendingDataQuery,
    recentReportsQuery,
  ])

  // 承認待ちをグループ化してカウント
  const pendingGroups = new Set<string>()
  for (const r of pendingData ?? []) {
    pendingGroups.add(`${r.site_id}_${r.reporter_id ?? 'none'}_${r.report_date}`)
  }
  const pendingCount = pendingGroups.size

  // マネージャー/管理者向け: 未取りまとめ報告の集計
  let unsummarizedItems: Array<{ siteId: string; siteName: string; reportDate: string; reportCount: number }> = []
  if (isAdmin || isManager) {
    // 承認済み報告の (site_id, report_date) を取得
    const { data: approvedReports } = await supabase
      .from('daily_reports')
      .select('site_id, report_date, sites(name)')
      .eq('approval_status', 'approved')
      .order('report_date', { ascending: false })
      .limit(200)

    if (approvedReports && approvedReports.length > 0) {
      // 提出済み or 確認済みサマリーの (site_id, report_date) を取得
      const { data: submittedSummaries } = await supabase
        .from('client_report_summaries')
        .select('site_id, report_date')
        .in('status', ['submitted', 'client_confirmed'])

      const submittedSet = new Set(
        (submittedSummaries ?? []).map((s) => `${s.site_id}_${s.report_date}`)
      )

      // 承認済みだがサマリー未提出のものを集計
      const countMap = new Map<string, { siteId: string; siteName: string; reportDate: string; count: number }>()
      for (const r of approvedReports) {
        const key = `${r.site_id}_${r.report_date}`
        if (submittedSet.has(key)) continue
        const existing = countMap.get(key)
        if (existing) {
          existing.count++
        } else {
          const siteName = (r.sites as unknown as { name: string } | null)?.name ?? '不明な現場'
          countMap.set(key, { siteId: r.site_id as string, siteName, reportDate: r.report_date as string, count: 1 })
        }
      }
      unsummarizedItems = Array.from(countMap.values())
        .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
        .slice(0, 10)
        .map((item) => ({ siteId: item.siteId, siteName: item.siteName, reportDate: item.reportDate, reportCount: item.count }))
    }
  }

  // 職人向け: 今日の現場とアドバイス
  const isWorker = userRole === 'worker_internal' || userRole === 'worker_external'
  let workerTodaySites: Array<{ id: string; name: string; address: string | null }> = []
  let workerAdvice: string | null = null
  if (isWorker) {
    const workerInfo = await getWorkerTodayInfo(user.id)
    workerTodaySites = workerInfo.todaySites.map((s) => ({ id: s.id, name: s.name, address: s.address }))
    // LLMアドバイスは非同期で取得（失敗してもエラーにしない）
    try {
      workerAdvice = await generateWorkerAdvice(user.id)
    } catch {
      // ignore
    }
  }

  const greeting = isClient
    ? '確認が必要な報告をチェックしましょう'
    : (isAdmin || isManager)
      ? '現場の進捗を管理しましょう'
      : '今日の作業を報告しましょう'

  // クライアント向け: 最近のサマリーを取得
  let recentSummaries: Array<{ id: string; siteName: string; date: string; status: string }> = []
  if (isClient && accessContext.accessibleSiteIds && accessContext.accessibleSiteIds.length > 0) {
    const { data: summaries } = await supabase
      .from('client_report_summaries')
      .select('id, report_date, status, sites(name)')
      .in('site_id', accessContext.accessibleSiteIds)
      .in('status', ['submitted', 'client_confirmed'])
      .order('report_date', { ascending: false })
      .limit(5)
    recentSummaries = (summaries ?? []).map((s) => ({
      id: s.id,
      siteName: (s.sites as unknown as { name: string } | null)?.name ?? '不明な現場',
      date: s.report_date,
      status: s.status,
    }))
  }

  // グループ化して重複カードを排除（ホームでは site_id + report_date でまとめる）
  const recentGrouped = new Map<string, { id: string; site: string; date: string; status: string; statusLabel: string }>()
  for (const r of recentReports ?? []) {
    const groupKey = `${r.site_id}_${r.report_date}`
    if (recentGrouped.has(groupKey)) continue
    const siteName = (r.sites as unknown as { name: string } | null)?.name ?? '不明な現場'
    const status = r.approval_status ?? 'submitted'
    recentGrouped.set(groupKey, {
      id: r.id as string,
      site: siteName,
      date: r.report_date as string,
      status,
      statusLabel: APPROVAL_STATUS_LABELS[status] ?? status,
    })
  }
  const recentItems = Array.from(recentGrouped.values()).slice(0, 5)

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

      {/* ── Worker Today Info ── */}
      {isWorker && workerTodaySites.length > 0 && (
        <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} className="text-[#0EA5E9]" />
            <h2 className="text-[13px] font-semibold text-gray-700">今日の現場</h2>
          </div>
          <div className="space-y-2">
            {workerTodaySites.map((site) => (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3 hover:bg-cyan-50 transition-colors"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-50 shrink-0">
                  <Building2 size={16} className="text-[#0EA5E9]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-gray-800 truncate">{site.name}</p>
                  {site.address && <p className="text-[11px] text-gray-400 truncate">{site.address}</p>}
                </div>
                <ArrowRight size={14} className="text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
          {workerAdvice && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 leading-relaxed">{workerAdvice}</p>
            </div>
          )}
        </div>
      )}

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

        {(isAdmin || isManager) && (pendingCount ?? 0) > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100">
                  <Eye size={20} className="text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-amber-700">承認待ちを確認</p>
                  <p className="text-[12px] text-amber-700/60">{pendingCount}件の報告が待っています</p>
                </div>
              </div>
              <Link
                href={isManager && pendingScope === 'mine' ? '/reports?status=submitted&scope=mine' : '/reports?status=submitted'}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700/70 transition-colors hover:text-amber-700"
              >
                一覧へ
                <ArrowRight size={14} />
              </Link>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Link
                  href="/?pendingScope=all"
                  className={`inline-flex min-h-[34px] items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
                    pendingScope === 'all'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-white/70 text-amber-700/60 hover:bg-white'
                  }`}
                >
                  全体
                </Link>
                <Link
                  href="/?pendingScope=mine"
                  className={`inline-flex min-h-[34px] items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
                    pendingScope === 'mine'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-white/70 text-amber-700/60 hover:bg-white'
                  }`}
                >
                  自分の現場
                </Link>
              </div>
            )}
          </div>
        )}

        {(isAdmin || isManager) && unsummarizedItems.length > 0 && (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-cyan-100">
                  <Sparkles size={20} className="text-[#0EA5E9]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-cyan-800">未取りまとめ報告</p>
                  <p className="text-[12px] text-cyan-800/60">{unsummarizedItems.length}件のサマリー作成が必要です</p>
                </div>
              </div>
              <Link
                href="/manager/reports"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-cyan-700/70 transition-colors hover:text-cyan-700"
              >
                管理画面へ
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {unsummarizedItems.map((item) => (
                <Link
                  key={`${item.siteId}_${item.reportDate}`}
                  href={`/sites/${item.siteId}/reports`}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-[12px] transition-colors hover:bg-white"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={12} className="text-[#0EA5E9] shrink-0" />
                    <span className="text-gray-700 font-medium truncate">{item.siteName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400">{item.reportDate}</span>
                    <span className="text-[#0EA5E9] font-medium">{item.reportCount}件</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
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

          <Link href={isClient ? "/client" : "/reports"} className="group flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50">
              <FileText size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">{isClient ? "日報一覧" : "報告一覧"}</p>
              <p className="text-[12px] text-gray-500">すべて確認</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Recent Reports / Summaries ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">
            {isClient ? '最近の日報' : '最近の報告'}
          </h2>
          <Link href={isClient ? "/client" : "/reports"} className="text-[12px] text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors flex items-center gap-1">
            すべて見る <ArrowRight size={11} />
          </Link>
        </div>

        {isClient ? (
          recentSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <FileText size={28} className="mb-3 text-gray-200" />
              <p className="text-[14px]">日報がまだありません</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-200 shadow-sm">
              {recentSummaries.map((item) => (
                <Link
                  key={item.id}
                  href={`/client/summaries/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <StatusDot status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-gray-800 truncate font-medium">{item.siteName}</p>
                    <p className="text-[12px] text-gray-400">{item.date}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {item.status === 'client_confirmed' ? '確認済み' : '未確認'}
                  </span>
                </Link>
              ))}
            </div>
          )
        ) : (
          recentItems.length === 0 ? (
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
          )
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
