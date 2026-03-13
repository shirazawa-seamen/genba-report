"use client";

import { useState, useTransition } from "react";
import { Send, Users, CheckCircle2 } from "lucide-react";
import {
  saveClientReportSummaryDraft,
  submitClientReportSummary,
} from "./actions";
import { SummaryPhotos, type SummaryPhotoItem } from "./summary-photos";

interface OfficialProgressItem {
  processId: string;
  processName: string;
  progressRate: number;
}

interface SiteMember {
  id: string;
  name: string;
  role: string;
}

export function SummaryEditor({
  summaryId,
  siteId,
  reportDate,
  initialSummaryText,
  initialOfficialProgress,
  siteMembers = [],
  initialPhotos = [],
  status,
}: {
  summaryId: string;
  siteId: string;
  reportDate: string;
  initialSummaryText: string;
  initialOfficialProgress: OfficialProgressItem[];
  siteMembers?: SiteMember[];
  initialPhotos?: SummaryPhotoItem[];
  status: string;
}) {
  const [summaryText, setSummaryText] = useState(initialSummaryText);
  const [officialProgress, setOfficialProgress] = useState(initialOfficialProgress);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleWorker = (name: string) => {
    setSelectedWorkers((current) =>
      current.includes(name)
        ? current.filter((w) => w !== name)
        : [...current, name]
    );
  };

  const updateProgress = (processId: string, progressRate: number) => {
    setOfficialProgress((current) =>
      current.map((item) =>
        item.processId === processId ? { ...item, progressRate } : item
      )
    );
  };

  const handleSaveDraft = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveClientReportSummaryDraft({
        summaryId,
        siteId,
        summaryText,
        officialProgress,
        workers: selectedWorkers,
      });
      setMessage(result.success ? "下書きを保存しました" : result.error || "保存に失敗しました");
    });
  };

  const handleSubmit = () => {
    if (!window.confirm("クライアントへ提出します。よろしいですか？\n提出後はクライアントに表示されます。")) return;
    setMessage(null);
    startTransition(async () => {
      const saveResult = await saveClientReportSummaryDraft({
        summaryId,
        siteId,
        summaryText,
        officialProgress,
        workers: selectedWorkers,
      });
      if (!saveResult.success) {
        setMessage(saveResult.error || "保存に失敗しました");
        return;
      }
      const submitResult = await submitClientReportSummary(summaryId, siteId);
      if (submitResult.success) {
        const warningText = (submitResult as { success: boolean; warning?: string | null }).warning;
        setMessage(warningText ? `クライアントへ提出しました（注意: ${warningText}）` : "クライアントへ提出しました");
      } else {
        setMessage(submitResult.error || "提出に失敗しました");
      }
    });
  };

  const isSubmitted = status === "submitted" || status === "client_confirmed";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-gray-700">{reportDate}</p>
      </div>

      <div className="mb-4 space-y-3">
        <div>
          <p className="mb-2 text-[12px] font-medium text-gray-500">公式進捗率</p>
          <div className="space-y-2">
            {officialProgress.map((item) => (
              <div key={item.processId} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-gray-700">{item.processName}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.progressRate}
                  onChange={(event) =>
                    updateProgress(
                      item.processId,
                      Math.max(0, Math.min(100, Number(event.target.value) || 0))
                    )
                  }
                  className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
                />
                <span className="text-[12px] text-gray-400">%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 作業者選択 */}
        {siteMembers.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-medium text-gray-500 flex items-center gap-1.5">
              <Users size={12} />
              作業者
            </p>
            <div className="flex flex-wrap gap-1.5">
              {siteMembers.map((member) => {
                const isSelected = selectedWorkers.includes(member.name);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleWorker(member.name)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                      isSelected
                        ? "border border-cyan-300 bg-cyan-100 text-[#0EA5E9]"
                        : "border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {isSelected && <CheckCircle2 size={10} />}
                    {member.name}
                  </button>
                );
              })}
            </div>
            {selectedWorkers.length > 0 && (
              <p className="mt-1 text-[10px] text-gray-400">
                選択中: {selectedWorkers.join("、")}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-[12px] font-medium text-gray-500">クライアント提出文</p>
          <textarea
            value={summaryText}
            onChange={(event) => setSummaryText(event.target.value)}
            rows={8}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[12px] leading-6 text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none"
          />
        </div>

        {/* 写真・動画 */}
        <SummaryPhotos
          summaryId={summaryId}
          siteId={siteId}
          initialPhotos={initialPhotos}
          editable={!isSubmitted}
        />
      </div>

      {message ? (
        <p className={`mb-3 text-[12px] ${message.includes("注意") ? "text-amber-500" : "text-gray-500"}`}>
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isPending}
          className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {isPending ? "保存中..." : "下書き保存"}
        </button>
        {!isSubmitted && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-5 text-[13px] font-bold text-white shadow-md shadow-sky-200 transition-all hover:bg-[#0284C7] hover:shadow-lg disabled:opacity-50"
          >
            <Send size={14} />
            {isPending ? "提出中..." : "クライアント提出"}
          </button>
        )}
      </div>
    </div>
  );
}
