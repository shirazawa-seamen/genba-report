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
  Send,
} from 'lucide-react'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'
import { requireUserContext } from '@/lib/auth/getCurrentUserContext'
import { getAccessibleSiteContext } from '@/lib/siteAccess'
import { getWorkerTodayInfo } from './worker-advice-action'

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

const EMPTY_SITE_ID = '00000000-0000-0000-0000-000000000000'

export default async function DashboardPage({ searchParams }: PageProps) {
  await searchParams
  const supabase = await createClient()
  const { user, role: userRole, companyId, displayName } = await requireUserContext()
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const isClient = userRole === 'client'
  const accessContext = await getAccessibleSiteContext(user.id, userRole, companyId)
  const pendingSiteIds = accessContext.accessibleSiteIds

  let siteCountQuery = supabase.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'active')
  if (accessContext.accessibleSiteIds) {
    if (accessContext.accessibleSiteIds.length === 0) {
      siteCountQuery = supabase.from('sites').select('id', { count: 'exact', head: true }).in('id', [EMPTY_SITE_ID])
    } else {
      siteCountQuery = siteCountQuery.in('id', accessContext.accessibleSiteIds)
    }
  }

  const isWorkerRole = userRole === 'worker_internal' || userRole === 'worker_external'
  const isManagerOrAdmin = isAdmin || isManager

  // 承認待ち: 報告者×現場×日付の組み合わせでカウント（工程単位ではなく報告単位）
  let pendingReportsQuery = isManagerOrAdmin
    ? supabase
        .from('daily_reports')
        .select('reporter_id, site_id, report_date')
        .eq('approval_status', 'submitted')
    : null

  let recentReportsQuery = !isClient
    ? supabase
        .from('daily_reports')
        .select('id, report_date, created_at, approval_status, site_id, reporter_id, sites(name)')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30)
    : null

  // ワーカーは自分の報告のみ
  if (isWorkerRole && recentReportsQuery) {
    recentReportsQuery = recentReportsQuery.eq('reporter_id', user.id)
  }

  if (pendingSiteIds) {
    if (pendingSiteIds.length === 0) {
      pendingReportsQuery = pendingReportsQuery?.in('site_id', [EMPTY_SITE_ID]) ?? null
      recentReportsQuery = recentReportsQuery?.in('site_id', [EMPTY_SITE_ID]) ?? null
    } else {
      pendingReportsQuery = pendingReportsQuery?.in('site_id', pendingSiteIds) ?? null
      recentReportsQuery = recentReportsQuery?.in('site_id', pendingSiteIds) ?? null
    }
  }

  // マネージャー/管理者向け: 未取りまとめ報告の集計（並列クエリに含める）
  let approvedReportsQuery = isManagerOrAdmin
    ? supabase
        .from('daily_reports')
        .select('site_id, report_date, sites(name)')
        .eq('approval_status', 'approved')
        .order('report_date', { ascending: false })
        .limit(100)
    : null
  // 提出済み・確認済みの1次報告のみ取得（未提出の判定に使う）
  let submittedSummariesQuery = isManagerOrAdmin
    ? supabase
        .from('client_report_summaries')
        .select('site_id, report_date')
        .in('status', ['submitted', 'client_confirmed'])
    : null

  if (pendingSiteIds) {
    if (pendingSiteIds.length === 0) {
      approvedReportsQuery = approvedReportsQuery?.in('site_id', [EMPTY_SITE_ID]) ?? null
      submittedSummariesQuery = submittedSummariesQuery?.in('site_id', [EMPTY_SITE_ID]) ?? null
    } else {
      approvedReportsQuery = approvedReportsQuery?.in('site_id', pendingSiteIds) ?? null
      submittedSummariesQuery = submittedSummariesQuery?.in('site_id', pendingSiteIds) ?? null
    }
  }

  // 職人向け: 今日の現場
  const isWorker = userRole === 'worker_internal' || userRole === 'worker_external'
  const workerInfoPromise = isWorker ? getWorkerTodayInfo(user.id) : null

  // クライアント向け: 最近のサマリー（Promise.allに組み込む）
  const clientSummariesQuery =
    isClient && accessContext.accessibleSiteIds && accessContext.accessibleSiteIds.length > 0
      ? supabase
          .from('client_report_summaries')
          .select('id, report_date, status, sites(name)')
          .in('site_id', accessContext.accessibleSiteIds)
          .in('status', ['submitted', 'client_confirmed'])
          .order('report_date', { ascending: false })
          .limit(5)
      : null

  // マネージャー/管理者向け: 最近の2次報告
  const managerSummariesQuery = isManagerOrAdmin
    ? supabase
        .from('client_report_summaries')
        .select('id, report_date, status, sites(name)')
        .in('status', ['draft', 'submitted', 'client_confirmed', 'revision_requested'])
        .order('report_date', { ascending: false })
        .limit(5)
    : null

  // 全クエリを並列実行
  const [
    { count: totalSiteCount },
    pendingReportsResult,
    recentReportsResult,
    approvedResult,
    summariesResult,
    workerInfo,
    clientSummariesResult,
    managerSummariesResult,
  ] = await Promise.all([
    siteCountQuery,
    pendingReportsQuery ?? Promise.resolve({ data: [] }),
    recentReportsQuery ?? Promise.resolve({ data: [] }),
    approvedReportsQuery ?? Promise.resolve({ data: null }),
    submittedSummariesQuery ?? Promise.resolve({ data: null }),
    workerInfoPromise ?? Promise.resolve(null),
    clientSummariesQuery ?? Promise.resolve({ data: null }),
    managerSummariesQuery ?? Promise.resolve({ data: null }),
  ])
  // 報告者×現場×日付でユニーク化して件数をカウント
  const pendingRows = (pendingReportsResult.data ?? []) as Array<{ reporter_id: string; site_id: string; report_date: string }>;
  const pendingCount = new Set(pendingRows.map((r) => `${r.reporter_id}_${r.site_id}_${r.report_date}`)).size;
  const recentReports = recentReportsResult.data ?? []

  // 未提出の1次報告の集計（承認済み2次報告があるが、1次報告が未提出の日）
  let unsummarizedItems: Array<{ siteId: string; siteName: string; reportDate: string; reportCount: number }> = []
  if (isManagerOrAdmin && approvedResult.data && approvedResult.data.length > 0) {
    const submittedSet = new Set(
      (summariesResult?.data ?? []).map((s: { site_id: string; report_date: string }) => `${s.site_id}_${s.report_date}`)
    )
    const countMap = new Map<string, { siteId: string; siteName: string; reportDate: string; count: number }>()
    for (const r of approvedResult.data) {
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

  // 職人情報の取得
  let workerTodaySites: Array<{ id: string; name: string; address: string | null }> = []
  if (workerInfo) {
    workerTodaySites = workerInfo.todaySites.map((s) => ({ id: s.id, name: s.name, address: s.address }))
  }

  const greeting = isClient
    ? '確認が必要な報告をチェックしましょう'
    : (isAdmin || isManager)
      ? '現場の進捗を管理しましょう'
      : '今日の作業を報告しましょう'

  // クライアント向け: 最近のサマリーを取得（Promise.allで並列取得済み）
  const recentSummaries = (clientSummariesResult?.data ?? []).map((s: { id: string; report_date: string; status: string; sites: unknown }) => ({
    id: s.id,
    siteName: (s.sites as { name: string } | null)?.name ?? '不明な現場',
    date: s.report_date,
    status: s.status,
  }))

  // マネージャー向け: 最近の2次報告
  const managerRecentSummaries = isManagerOrAdmin
    ? (managerSummariesResult?.data ?? []).map((s: { id: string; report_date: string; status: string; sites: unknown }) => ({
        id: s.id,
        siteName: (s.sites as { name: string } | null)?.name ?? '不明な現場',
        date: s.report_date,
        status: s.status,
      }))
    : []

  // グループ化して重複カードを排除（ホームでは site_id + report_date でまとめる）
  const recentGrouped = new Map<string, { id: string; site: string; date: string; submittedTime: string | null; status: string; statusLabel: string }>()
  for (const r of recentReports ?? []) {
    const groupKey = `${r.site_id}_${r.report_date}`
    if (recentGrouped.has(groupKey)) continue
    const siteName = (r.sites as unknown as { name: string } | null)?.name ?? '不明な現場'
    const status = r.approval_status ?? 'submitted'
    const createdAt = (r as unknown as { created_at?: string }).created_at ?? null
    recentGrouped.set(groupKey, {
      id: r.id as string,
      site: siteName,
      date: r.report_date as string,
      submittedTime: createdAt ? new Date(createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : null,
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
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100 shrink-0">
                <Eye size={20} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-amber-700">承認待ち</p>
                <p className="text-[12px] text-amber-700/60">{pendingCount}件の報告が待っています</p>
              </div>
            </div>
          </div>
        )}

        {(isAdmin || isManager) && unsummarizedItems.length > 0 && (
          <Link href="/manager/reports?filter=actionRequired" className="block rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm hover:bg-cyan-100/50 transition-colors active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-cyan-100 shrink-0">
                <Sparkles size={20} className="text-[#0EA5E9]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-cyan-800">未提出の1次報告</p>
                <p className="text-[12px] text-cyan-800/60">{unsummarizedItems.length}件の1次報告が未提出です</p>
              </div>
              <ArrowRight size={18} className="text-cyan-400 shrink-0" />
            </div>
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

          <Link href={isClient ? "/client" : isManagerOrAdmin ? "/manager/reports?filter=all" : "/reports"} className="group flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50">
              <FileText size={18} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">{isClient ? "日報一覧" : isManagerOrAdmin ? "1次報告一覧" : "報告一覧"}</p>
              <p className="text-[12px] text-gray-500">すべて確認</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Recent Reports / Summaries ── */}

      {/* マネージャー/管理者: 1次報告 → 2次報告の順 */}
      {isManagerOrAdmin && (
        <div className="space-y-6">
          {/* 1次報告（クライアント向けサマリー） */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">最近の1次報告</h2>
              <Link href="/manager/reports?filter=all" className="text-[12px] text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors flex items-center gap-1">
                すべて見る <ArrowRight size={11} />
              </Link>
            </div>
            {managerRecentSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <Send size={24} className="mb-2 text-gray-200" />
                <p className="text-[13px]">1次報告がまだありません</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-200 shadow-sm">
                {managerRecentSummaries.map((item) => (
                  <Link
                    key={item.id}
                    href={`/manager/reports`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors active:bg-gray-100"
                  >
                    <StatusDot status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-gray-800 truncate font-medium">{item.siteName}</p>
                      <p className="text-[12px] text-gray-400">{item.date}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {item.status === 'client_confirmed' ? '確認済み' : item.status === 'submitted' ? '提出済み' : item.status === 'revision_requested' ? '修正依頼' : '下書き'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 2次報告（ワーカー→マネージャー） */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">最近の2次報告</h2>
              <Link href="/manager/reports" className="text-[12px] text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors flex items-center gap-1">
                すべて見る <ArrowRight size={11} />
              </Link>
            </div>
            {recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <FileText size={24} className="mb-2 text-gray-200" />
                <p className="text-[13px]">2次報告がまだありません</p>
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
                      <p className="text-[12px] text-gray-400">{item.date}{item.submittedTime && <span className="ml-1 text-gray-300">{item.submittedTime}</span>}</p>
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
      )}

      {/* クライアント */}
      {isClient && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">最近の日報</h2>
            <Link href="/client" className="text-[12px] text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors flex items-center gap-1">
              すべて見る <ArrowRight size={11} />
            </Link>
          </div>
          {recentSummaries.length === 0 ? (
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
          )}
        </div>
      )}

      {/* ワーカー/パートナー */}
      {isWorkerRole && (
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
      )}
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
