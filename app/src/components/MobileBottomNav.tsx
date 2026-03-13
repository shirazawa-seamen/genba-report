"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Building2,
  Settings,
  CheckSquare,
  Calendar,
  ClipboardList,
  Send,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Building2,
  Settings,
  CheckSquare,
  Calendar,
  ClipboardList,
  Send,
  Package,
};

export interface NavItemDef {
  shortLabel: string;
  href: string;
  iconName: string;
}

export function MobileBottomNav({ items }: { items: NavItemDef[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Fixed nav — full width */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
      >
        <div>
          <div
            className="flex items-center gap-1 rounded-full border border-white/[0.1] px-3 py-3"
            style={{
              background: "rgba(28, 28, 28, 0.45)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.45), inset 0 0.5px 0 rgba(255,255,255,0.08)",
            }}
          >
            {items.map(({ href, iconName }) => {
              const active = isActive(href);
              const Icon = ICON_MAP[iconName] ?? LayoutDashboard;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-1 items-center justify-center rounded-full py-3 transition-all duration-150 ${
                    active
                      ? "bg-[#0EA5E9] text-white"
                      : "text-white/30 active:bg-white/[0.06] active:text-white/50"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
