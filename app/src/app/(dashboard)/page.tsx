import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList,
  MapPin,
  PlusCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
  iconBg: string
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent, iconBg }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
      {/* accent glow */}
      <div
        className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${accent}`}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-widest uppercase text-zinc-500">
            {label}
          </p>
          <p className="text-4xl font-bold text-zinc-100">{value}</p>
          {sub && <p className="text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBg}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest uppercase text-zinc-500 mb-4">
      {children}
    </h2>
  )
}

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'ユーザー'

  // 今日の日付（日本語表示用）
  const today = new Date()
  const dateLabel = today.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  // ────────────────────────────
  // Quick actions
  // ────────────────────────────
  const quickActions = [
    {
      label: '新規報告を作成',
      description: '本日の現場報告を入力する',
      href: '/reports/new',
      icon: PlusCircle,
      primary: true,
    },
    {
      label: '報告一覧を見る',
      description: '過去の報告を検索・閲覧する',
      href: '/reports',
      icon: ClipboardList,
      primary: false,
    },
  ]

  // ────────────────────────────
  // Recent activity (placeholder)
  // ────────────────────────────
  const recentItems = [
    {
      id: 1,
      site: '第3工区 Aブロック',
      date: '2026-02-15',
      status: '提出済',
      statusColor: 'text-emerald-400 bg-emerald-400/10',
    },
    {
      id: 2,
      site: '本館改修工事',
      date: '2026-02-14',
      status: '提出済',
      statusColor: 'text-emerald-400 bg-emerald-400/10',
    },
    {
      id: 3,
      site: '外構整備エリア',
      date: '2026-02-13',
      status: '下書き',
      statusColor: 'text-amber-400 bg-amber-400/10',
    },
  ]

  return (
    <div className="flex-1 px-6 py-8 md:px-10 md:py-10 max-w-5xl w-full mx-auto space-y-10">

      {/* ── Greeting ─────────────────────────────── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-amber-500 mb-1">
              現場報告システム
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">
              おかえりなさい、{displayName} さん
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
            <CalendarDays size={14} className="text-zinc-600" />
            <span>{dateLabel}</span>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────── */}
      <section>
        <SectionHeading>本日のサマリー</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="今日の報告数"
            value={0}
            sub="本日提出された報告"
            icon={ClipboardList}
            accent="bg-amber-400"
            iconBg="bg-amber-400/15 text-amber-400"
          />
          <StatCard
            label="未報告現場数"
            value={0}
            sub="報告が必要な現場"
            icon={MapPin}
            accent="bg-rose-400"
            iconBg="bg-rose-400/15 text-rose-400"
          />
          <StatCard
            label="今月の報告合計"
            value={0}
            sub="2026年2月"
            icon={TrendingUp}
            accent="bg-sky-400"
            iconBg="bg-sky-400/15 text-sky-400"
          />
        </div>
      </section>

      {/* ── Quick Actions ─────────────────────────── */}
      <section>
        <SectionHeading>クイックアクション</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map(({ label, description, href, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden flex items-center gap-5 rounded-2xl border p-6 transition-all duration-200 ${
                primary
                  ? 'bg-amber-500 border-amber-400 hover:bg-amber-400 text-zinc-900'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-zinc-100'
              }`}
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${
                  primary
                    ? 'bg-amber-400/40 text-zinc-900'
                    : 'bg-zinc-800 text-amber-400'
                }`}
              >
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-semibold ${primary ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  {label}
                </p>
                <p className={`text-sm mt-0.5 ${primary ? 'text-zinc-700' : 'text-zinc-500'}`}>
                  {description}
                </p>
              </div>
              <ArrowRight
                size={18}
                className={`shrink-0 transition-transform group-hover:translate-x-1 ${
                  primary ? 'text-zinc-700' : 'text-zinc-600'
                }`}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent Reports ────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>最近の報告</SectionHeading>
          <Link
            href="/reports"
            className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            すべて見る
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 overflow-hidden">
          {recentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
              <AlertCircle size={32} className="text-zinc-700" />
              <p className="text-sm">報告がまだありません</p>
            </div>
          ) : (
            recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-800 text-zinc-400 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {item.site}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-zinc-500 text-xs">
                      <Clock size={10} />
                      <span>{item.date}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 ml-4 text-xs font-medium px-2.5 py-1 rounded-full ${item.statusColor}`}
                >
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  )
}
