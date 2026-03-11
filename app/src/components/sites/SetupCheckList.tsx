"use client";

import {
  FileSpreadsheet,
  FileText,
  FileCheck,
  CalendarRange,
  Monitor,
  Check,
} from "lucide-react";

const SETUP_ITEMS = [
  { key: "has_blueprint", label: "図面", icon: FileSpreadsheet },
  { key: "has_specification", label: "仕様書", icon: FileText },
  { key: "has_purchase_order", label: "発注書", icon: FileCheck },
  { key: "has_schedule", label: "工程表", icon: CalendarRange },
  { key: "is_monitor", label: "モニター施工", icon: Monitor },
] as const;

export interface SetupCheckDraft {
  has_blueprint: boolean;
  has_specification: boolean;
  has_purchase_order: boolean;
  has_schedule: boolean;
  is_monitor: boolean;
}

interface SetupCheckListProps {
  checks: SetupCheckDraft;
  editable?: boolean;
  onChange?: (next: SetupCheckDraft) => void;
}

export function SetupCheckList({
  checks,
  editable = false,
  onChange,
}: SetupCheckListProps) {
  const checkedCount = Object.values(checks).filter(Boolean).length;

  const handleToggle = (key: keyof SetupCheckDraft) => {
    if (!editable || !onChange) return;
    onChange({
      ...checks,
      [key]: !checks[key],
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-[#0EA5E9]" />
          <h2 className="text-[13px] font-semibold tracking-wide text-gray-600">
            セットアップチェック
          </h2>
        </div>
        <span className="text-[12px] text-gray-400">
          {checkedCount} / {SETUP_ITEMS.length} 完了
        </span>
      </div>

      <div className="space-y-2">
        {SETUP_ITEMS.map(({ key, label, icon: Icon }) => {
          const isChecked = checks[key];

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleToggle(key)}
              disabled={!editable}
              className={[
                "flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border px-4 transition-all duration-200",
                isChecked
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-white",
                editable ? "cursor-pointer hover:border-gray-300" : "cursor-default",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isChecked
                    ? "bg-emerald-100 text-emerald-500"
                    : "bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                <Icon size={18} />
              </div>
              <span
                className={[
                  "flex-1 text-left text-[13px] font-medium",
                  isChecked ? "text-emerald-600" : "text-gray-500",
                ].join(" ")}
              >
                {label}
              </span>
              {isChecked ? (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <Check size={14} className="text-white" />
                </div>
              ) : (
                <div className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
