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
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}

      {/* Work Content */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-white/50">
          作業内容 <span className="text-[#00D9FF] text-xs">*</span>
        </label>
        <textarea
          name="work_content"
          required
          defaultValue={initialData.work_content}
          rows={5}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20 resize-none"
        />
      </div>

      {/* Workers */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-white/50">作業者</label>
        <input
          name="workers"
          type="text"
          defaultValue={initialData.workers}
          placeholder="田中、山田、佐藤"
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20"
        />
      </div>

      {/* Progress & Weather */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-white/50">
            進捗率 (%)
          </label>
          <input
            name="progress_rate"
            type="number"
            min="0"
            max="100"
            defaultValue={initialData.progress_rate}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-white/50">天候</label>
          <input
            name="weather"
            type="text"
            defaultValue={initialData.weather}
            placeholder="晴れ"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20"
          />
        </div>
      </div>

      {/* Work Hours */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-white/50">
          作業時間 (h)
        </label>
        <input
          name="work_hours"
          type="number"
          step="0.5"
          min="0"
          defaultValue={initialData.work_hours ?? ""}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20"
        />
      </div>

      {/* Issues */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-white/50">
          課題・懸念事項
        </label>
        <textarea
          name="issues"
          defaultValue={initialData.issues}
          rows={3}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.05] text-[16px] text-white/90 placeholder-white/25 focus:outline-none focus:border-[#00D9FF]/50 focus:ring-1 focus:ring-[#00D9FF]/20 resize-none"
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
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] text-[16px] text-white/90 placeholder-white/25 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] min-h-[48px] px-4 text-[14px] font-medium text-white/70 hover:bg-white/[0.06] transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D9FF] min-h-[48px] px-5 text-[14px] font-bold text-[#0e0e0e] transition-all hover:bg-[#00D9FF]/90 active:scale-[0.98] disabled:opacity-50"
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
