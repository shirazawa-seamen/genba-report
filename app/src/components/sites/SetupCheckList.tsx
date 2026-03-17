"use client";

import { useTransition } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileCheck,
  CalendarRange,
  Check,
  Loader2,
} from "lucide-react";
import { updateSetupCheck } from "@/app/(dashboard)/sites/actions";

const SETUP_ITEMS = [
  { key: "has_blueprint", label: "図面", icon: FileSpreadsheet },
  { key: "has_specification", label: "仕様書", icon: FileText },
  { key: "has_purchase_order", label: "発注書", icon: FileCheck },
  { key: "has_schedule", label: "工程表", icon: CalendarRange },
] as const;

export type SetupCheckField = (typeof SETUP_ITEMS)[number]["key"];

export interface SetupCheckDraft {
  has_blueprint: boolean;
  has_specification: boolean;
  has_purchase_order: boolean;
  has_schedule: boolean;
}

interface SetupCheckListProps {
  siteId?: string;
  checks: SetupCheckDraft;
  /** 編集モード用: ローカルステートを更新するコールバック */
  onChange?: (next: SetupCheckDraft) => void;
  /** DB直接保存モード: siteId と合わせて使用 */
  canToggle?: boolean;
}

export function SetupCheckList({
  siteId,
  checks,
  onChange,
  canToggle = false,
}: SetupCheckListProps) {
  const [isPending, startTransition] = useTransition();
  const checkedCount = Object.values(checks).filter(Boolean).length;

  const handleToggle = (key: SetupCheckField) => {
    // 編集モード（onChange が渡されている場合）: ローカルステートを更新
    if (onChange) {
      onChange({ ...checks, [key]: !checks[key] });
      return;
    }

    // DB直接保存モード
    if (!canToggle || !siteId) return;
    startTransition(async () => {
      await updateSetupCheck(siteId, key, !checks[key]);
    });
  };

  const isInteractive = !!onChange || canToggle;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPending ? (
            <Loader2 size={16} className="text-[#0EA5E9] animate-spin" />
          ) : (
            <Check size={16} className="text-[#0EA5E9]" />
          )}
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
              disabled={!isInteractive || isPending}
              className={[
                "flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border px-4 transition-all duration-200",
                isChecked
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-white",
                isInteractive && !isPending
                  ? "cursor-pointer hover:border-gray-300"
                  : "cursor-default",
                isPending ? "opacity-60" : "",
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
