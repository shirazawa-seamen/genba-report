"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  Home,
  Settings,
  Users,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Package,
  FileText,
  PlusCircle,
  Calendar,
  Send,
  CheckSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Settings,
  Users,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Package,
  FileText,
  PlusCircle,
  Calendar,
  Send,
  CheckSquare,
};

interface NavItem {
  label: string;
  href: string;
  iconName: string;
}

interface MobileHamburgerMenuProps {
  navItems: NavItem[];
  adminItems: NavItem[];
  displayName: string;
  roleLabel: string;
}

export function MobileHamburgerMenu({
  navItems,
  adminItems,
  displayName,
  roleLabel,
}: MobileHamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const renderLink = ({ label, href, iconName }: NavItem) => {
    const Icon = ICON_MAP[iconName] ?? Settings;
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setIsOpen(false)}
        className={[
          "flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] transition-all",
          active
            ? "bg-sky-50 text-[#0EA5E9] font-semibold"
            : "text-gray-600 hover:text-[#0EA5E9] hover:bg-sky-50",
        ].join(" ")}
      >
        <Icon size={20} className="shrink-0" />
        {label}
      </Link>
    );
  };

  const drawer = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200">
              <span className="text-[15px] font-bold text-gray-900">メニュー</span>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <div className="space-y-1">
                {navItems.map(renderLink)}
              </div>

              {adminItems.length > 0 && (
                <>
                  <div className="mt-4 mb-2 px-3">
                    <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">管理</p>
                  </div>
                  <div className="space-y-1">
                    {adminItems.map(renderLink)}
                  </div>
                </>
              )}
            </nav>

            {/* User + Logout */}
            <div className="px-4 py-4 border-t border-gray-200 space-y-3">
              <div className="px-1">
                <p className="text-[13px] font-medium text-gray-700">{displayName}</p>
                <p className="text-[11px] text-gray-400">{roleLabel}</p>
              </div>
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="メニュー"
      >
        <Menu size={20} />
      </button>
      {drawer}
    </>
  );
}
