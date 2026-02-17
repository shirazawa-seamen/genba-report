import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  HardHat,
  LayoutDashboard,
  FileText,
  PlusCircle,
  LogOut,
} from 'lucide-react'

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

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    'ユーザー'

  const initials = displayName
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('')

  const navItems = [
    {
      label: 'ダッシュボード',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: '報告一覧',
      href: '/reports',
      icon: FileText,
    },
    {
      label: '新規報告',
      href: '/reports/new',
      icon: PlusCircle,
    },
  ]

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400">
            <HardHat size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-zinc-100">
              現場報告
            </p>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">
              System
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors group"
            >
              <Icon
                size={16}
                className="text-zinc-500 group-hover:text-amber-400 transition-colors"
              />
              {label}
            </Link>
          ))}
        </nav>

        {/* User info + Logout */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400">
            <HardHat size={16} />
          </div>
          <span className="text-sm font-semibold text-zinc-100">現場報告</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
            {initials}
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center bg-zinc-900 border-t border-zinc-800">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center flex-1 py-3 gap-1 text-zinc-500 hover:text-amber-400 transition-colors"
          >
            <Icon size={18} />
            <span className="text-[10px] tracking-wide">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
