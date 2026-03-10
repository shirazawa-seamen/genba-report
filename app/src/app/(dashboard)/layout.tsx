import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  LogOut,
  Building2,
  Settings,
  CheckSquare,
  Calendar,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role ?? 'worker_internal'
  const roleLabel = ROLE_LABELS[userRole] ?? userRole

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const initials = displayName
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('')

  const allNavItems = [
    { label: 'ホーム', href: '/', icon: LayoutDashboard, roles: ['admin', 'worker_internal', 'worker_external', 'orderer'] },
    { label: '現場', href: '/sites', icon: Building2, roles: ['admin', 'worker_internal', 'worker_external', 'orderer'] },
    { label: '予定', href: '/calendar', icon: Calendar, roles: ['admin', 'worker_internal', 'worker_external'] },
    { label: '報告', href: '/reports', icon: FileText, roles: ['admin', 'worker_internal', 'worker_external'] },
    { label: '確認', href: '/orderer', icon: CheckSquare, roles: ['orderer'] },
    { label: '新規', href: '/reports/new', icon: PlusCircle, roles: ['admin', 'worker_internal', 'worker_external'] },
    { label: '管理', href: '/admin', icon: Settings, roles: ['admin'] },
  ]

  const navItems = allNavItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="flex h-dvh bg-[#1a1a1a] text-white/90 font-sans overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 border-r border-white/[0.06] bg-[#161616] shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-[#00D9FF]/15 flex items-center justify-center">
            <Building2 size={16} className="text-[#00D9FF]" />
          </div>
          <div>
            <span className="text-[14px] font-semibold tracking-tight text-white/90 block leading-tight">
              現場報告
            </span>
            <span className="text-[10px] text-white/30 leading-tight">
              Construction Report
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-[#00D9FF] hover:bg-[#00D9FF]/[0.06] transition-all"
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00D9FF]/15 text-[#00D9FF] text-[12px] font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white/80 truncate">{displayName}</p>
              <p className="text-[11px] text-white/30">{roleLabel}</p>
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              <LogOut size={14} />
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile + Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-5 h-14 border-b border-white/[0.06] bg-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00D9FF]/15 flex items-center justify-center">
              <Building2 size={14} className="text-[#00D9FF]" />
            </div>
            <span className="text-[15px] font-semibold text-white/90">現場報告</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/30 hidden min-[400px]:block">{roleLabel}</span>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00D9FF]/15 text-[#00D9FF] text-[11px] font-semibold">
              {initials}
            </div>
            <form action="/auth/signout" method="POST">
              <button type="submit" className="flex items-center justify-center w-8 h-8 rounded-lg text-white/30 hover:text-white/60 transition-colors">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

        {/* Mobile bottom nav - always visible with safe area */}
        <nav className="md:hidden border-t border-white/[0.06] shrink-0 bg-[#1a1a1a]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          <div className="flex items-center">
            {navItems.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center flex-1 min-h-[52px] gap-0.5 text-white/35 hover:text-[#00D9FF] active:text-[#00D9FF] transition-colors"
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
