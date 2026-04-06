import Link from 'next/link'
import {
  Home,
  FileText,
  PlusCircle,
  LogOut,
  Building2,
  Settings,
  CheckSquare,
  Calendar,
  Send,
  Package,
  Users,
  ClipboardList,
  User,
  FolderClosed,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileHamburgerMenu } from '@/components/MobileHamburgerMenu'
import { requireUserContext } from '@/lib/auth/getCurrentUserContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role: userRole, displayName } = await requireUserContext()
  const roleLabel = ROLE_LABELS[userRole] ?? userRole

  const initials = displayName
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('')

  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager'

  // メインナビゲーション（サイドバー + フッター共通）
  const allNavItems = [
    { label: 'ホーム', shortLabel: 'ホーム', href: '/', icon: Home, iconName: 'Home', roles: ['admin', 'manager', 'worker_internal', 'worker_external', 'client'] },
    { label: '現場一覧', shortLabel: '現場', href: '/sites', icon: Building2, iconName: 'Building2', roles: ['admin', 'manager', 'worker_internal', 'worker_external', 'client'] },
    { label: 'ストレージ', shortLabel: 'ストレージ', href: '/storage', icon: FolderClosed, iconName: 'FolderClosed', roles: ['admin', 'manager', 'worker_internal', 'worker_external'] },
    { label: '現場カレンダー', shortLabel: '予定', href: '/calendar', icon: Calendar, iconName: 'Calendar', roles: ['admin', 'manager', 'worker_internal', 'worker_external', 'client'] },
    { label: '1次報告', shortLabel: '1次', href: '/manager/reports', icon: Send, iconName: 'Send', roles: ['admin', 'manager'] },
    { label: '2次報告', shortLabel: '2次', href: '/reports', icon: FileText, iconName: 'FileText', roles: ['admin', 'manager', 'worker_internal', 'worker_external'] },
    { label: '確認', shortLabel: '確認', href: '/client', icon: CheckSquare, iconName: 'CheckSquare', roles: ['client'] },
    { label: '新規2次報告', shortLabel: '新規', href: '/reports/new', icon: PlusCircle, iconName: 'PlusCircle', roles: ['admin', 'manager', 'worker_internal', 'worker_external'] },
    { label: 'マイページ', shortLabel: 'マイ', href: '/mypage', icon: User, iconName: 'User', roles: ['worker_internal', 'worker_external'] },
    { label: '材料カタログ', shortLabel: '材料', href: '/admin/materials', icon: Package, iconName: 'Package', roles: ['admin', 'manager'] },
  ]

  const navItems = allNavItems
    .filter(item => item.roles.includes(userRole))

  // フッターナビ: マネージャー/管理者は材料カタログを除外（サイドバーにあるため）
  const bottomNavItems = navItems.filter(item =>
    !(isManagerOrAdmin && item.href === '/admin/materials')
  )

  // 管理サブメニュー（サイドバー + ハンバーガー用）
  const adminSubItems = isManagerOrAdmin ? [
    { label: '管理ダッシュボード', href: '/admin', icon: Settings, iconName: 'Settings' },
    { label: '材料カタログ', href: '/admin/materials', icon: Package, iconName: 'Package' },
    { label: 'ユーザー管理', href: '/admin/users', icon: Users, iconName: 'Users' },
    { label: '標準工程マスター', href: '/admin/process-templates', icon: ClipboardList, iconName: 'ClipboardList' },
    { label: '会社マスター', href: '/admin/companies', icon: Building2, iconName: 'Building2' },
  ] : []

  return (
    <div className="flex h-dvh bg-[#F5F6F8] text-gray-900 font-sans overflow-hidden print:!h-auto print:!overflow-visible print:!bg-white">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex print:!hidden flex-col w-60 border-r border-gray-200 bg-white shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
            <Building2 size={16} className="text-[#0EA5E9]" />
          </div>
          <div>
            <span className="text-[14px] font-semibold tracking-tight text-gray-900 block leading-tight">
              現場報告
            </span>
            <span className="text-[10px] text-gray-400 leading-tight">
              Construction Report
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-500 hover:text-[#0EA5E9] hover:bg-sky-50 transition-all"
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          ))}

          {/* 管理セクション */}
          {isManagerOrAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">管理</p>
              </div>
              {adminSubItems.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-500 hover:text-[#0EA5E9] hover:bg-sky-50 transition-all"
                >
                  <Icon size={18} className="shrink-0" />
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-[#0EA5E9] text-[12px] font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-gray-700 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400">{roleLabel}</p>
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
        <div className="md:hidden print:!hidden flex items-center justify-between px-5 h-14 border-b border-gray-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center">
              <Building2 size={14} className="text-[#0EA5E9]" />
            </div>
            <span className="text-[15px] font-bold text-gray-900">現場報告</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 hidden min-[400px]:block font-medium">{roleLabel}</span>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-[#0EA5E9] text-[11px] font-bold">
              {initials}
            </div>
            <MobileHamburgerMenu
              navItems={navItems.map(({ label, href, iconName }) => ({ label, href, iconName }))}
              adminItems={adminSubItems.map(({ label, href, iconName }) => ({ label, href, iconName }))}
              displayName={displayName}
              roleLabel={roleLabel}
            />
          </div>
        </div>

        {/* Main content */}
        <main className="dashboard-main flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden print:!overflow-visible">
          {children}
        </main>

        {/* Mobile bottom nav — Liquid Glass floating pill */}
        <MobileBottomNav items={bottomNavItems.map(({ shortLabel, href, iconName }) => ({ shortLabel, href, iconName }))} />
      </div>
    </div>
  )
}
