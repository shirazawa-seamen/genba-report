"use client";

import { useState, useTransition } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileCheck,
  CalendarRange,
  Monitor,
  Check,
  Loader2,
} from "lucide-react";
import { updateSetupCheck } from "@/app/(dashboard)/sites/actions";
import type { Site } from "@/lib/types";

const SETUP_ITEMS = [
  { key: "has_blueprint", label: "図面", icon: FileSpreadsheet },
  { key: "has_specification", label: "仕様書", icon: FileText },
  { key: "has_purchase_order", label: "発注書", icon: FileCheck },
  { key: "has_schedule", label: "工程表", icon: CalendarRange },
  { key: "is_monitor", label: "モニター施工", icon: Monitor },
] as const;

interface SetupCheckListProps {
  site: Pick<Site, "id" | "has_blueprint" | "has_specification" | "has_purchase_order" | "has_schedule" | "is_monitor">;
}

export function SetupCheckList({ site }: SetupCheckListProps) {
  const [isPending, startTransition] = useTransition();
  const [checks, setChecks] = useState({
    has_blueprint: site.has_blueprint,
    has_specification: site.has_specification,
    has_purchase_order: site.has_purchase_order,
    has_schedule: site.has_schedule,
    is_monitor: site.is_monitor,
  });
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const handleToggle = (key: keyof typeof checks, currentValue: boolean) => {
    setUpdatingKey(key);
    startTransition(async () => {
      const result = await updateSetupCheck(site.id, key, !currentValue);
      if (result.success) {
        setChecks((prev) => ({ ...prev, [key]: !currentValue }));
      }
      setUpdatingKey(null);
    });
  };

  const checkedCount = Object.values(checks).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-[#00D9FF]" />
          <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">
            セットアップチェック
          </h2>
        </div>
        <span className="text-[12px] text-white/35">
          {checkedCount} / {SETUP_ITEMS.length} 完了
        </span>
      </div>

      <div className="space-y-2">
        {SETUP_ITEMS.map(({ key, label, icon: Icon }) => {
          const isChecked = checks[key];
          const isUpdating = updatingKey === key;

          return (
            <button
              key={key}
              onClick={() => handleToggle(key, isChecked)}
              disabled={isPending}
              className={[
                "w-full flex items-center gap-3.5 rounded-xl border px-4 min-h-[52px] transition-all duration-200",
                isChecked
                  ? "bg-emerald-500/[0.06] border-emerald-500/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]",
                isPending && "cursor-wait",
                !isPending && "cursor-pointer",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0",
                  isChecked
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-white/[0.06] text-white/35",
                ].join(" ")}
              >
                <Icon size={18} />
              </div>
              <span
                className={[
                  "flex-1 text-left text-[13px] font-medium",
                  isChecked ? "text-emerald-300" : "text-white/65",
                ].join(" ")}
              >
                {label}
              </span>
              <div className="flex items-center justify-center h-6 w-6 shrink-0">
                {isUpdating ? (
                  <Loader2 size={16} className="animate-spin text-[#00D9FF]" />
                ) : isChecked ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                    <Check size={14} className="text-[#0e0e0e]" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-white/[0.15]" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
