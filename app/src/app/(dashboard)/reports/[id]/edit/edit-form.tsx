"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReport } from "./actions";
import { Loader2, Save, AlertTriangle } from "lucide-react";

interface ReportEditFormProps {
  reportId: string;
  initialData: {
    work_content: string;
    workers: string;
    progress_rate: number;
    weather: string;
    work_hours?: number;
    issues: string;
    admin_notes: string;
  };
}

export function ReportEditForm({ reportId, initialData }: ReportEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateReport(reportId, formData);
      if (result.success) {
        router.push(`/reports/${reportId}`);
      } else {
        setError(result.error || "更新に失敗しました");
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}

      {/* Work Content */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-500">
          作業内容 <span className="text-[#0EA5E9] text-xs">*</span>
        </label>
        <textarea
          name="work_content"
          required
          defaultValue={initialData.work_content}
          rows={5}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20 resize-none"
        />
      </div>

      {/* Progress & Weather */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">
            担当者見込み進捗 (%)
          </label>
          <input
            name="progress_rate"
            type="number"
            min="0"
            max="100"
            defaultValue={initialData.progress_rate}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">天候</label>
          <input
            name="weather"
            type="text"
            defaultValue={initialData.weather}
            placeholder="晴れ"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
          />
        </div>
      </div>

      {/* Work Hours */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-500">
          作業時間 (h)
        </label>
        <input
          name="work_hours"
          type="number"
          step="0.5"
          min="0"
          defaultValue={initialData.work_hours ?? ""}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20"
        />
      </div>

      {/* Issues */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-500">
          課題・懸念事項
        </label>
        <textarea
          name="issues"
          defaultValue={initialData.issues}
          rows={3}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/20 resize-none"
        />
      </div>

      {/* Admin Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-amber-400/80">
          管理者メモ
        </label>
        <textarea
          name="admin_notes"
          defaultValue={initialData.admin_notes}
          rows={3}
          placeholder="管理者のみ編集可能なメモ欄"
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/50 text-[16px] text-gray-900 placeholder-gray-300 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 min-h-[48px] px-4 text-[14px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[48px] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Save size={16} />
              保存する
            </>
          )}
        </button>
      </div>
    </form>
  );
}
