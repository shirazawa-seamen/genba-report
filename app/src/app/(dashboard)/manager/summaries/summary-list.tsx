"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileText,
  CheckCircle2,
  Send,
  Clock,
  X,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Printer,
} from "lucide-react";
import {
  generateClientReportSummary,
  regenerateSummaryWithPrompt,
  createClientReportSummaryManual,
  saveClientReportSummaryDraft,
  submitClientReportSummary,
} from "@/app/(dashboard)/sites/[siteId]/reports/actions";

export interface SummaryItem {
  id: string | null; // null = 未生成
  siteId: string;
  siteName: string;
  reportDate: string;
  summaryText: string;
  status: string; // "ungenerated" | "draft" | "submitted" | "client_confirmed" | "revision_requested"
  revisionComment?: string | null;
  officialProgress: Array<{
    processId: string;
    processName: string;
    progressRate: number;
  }>;
}

interface SiteGroup {
  siteId: string;
  siteName: string;
  items: SummaryItem[];
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: typeof FileText }> = {
  ungenerated: { label: "未生成", badge: "bg-gray-100 text-gray-500", icon: FileText },
  draft: { label: "下書き", badge: "bg-amber-100 text-amber-600", icon: FileText },
  submitted: { label: "提出済み", badge: "bg-emerald-100 text-emerald-600", icon: Send },
  client_confirmed: { label: "確認済み", badge: "bg-blue-100 text-blue-600", icon: CheckCircle2 },
  rejected: { label: "差戻し", badge: "bg-red-100 text-red-500", icon: Clock },
  revision_requested: { label: "修正依頼", badge: "bg-orange-100 text-orange-600", icon: MessageSquare },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function SummaryList({ groups }: { groups: SiteGroup[] }) {
  const [modalItem, setModalItem] = useState<SummaryItem | null>(null);

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.siteId}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            {/* 現場ヘッダー */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-50 shrink-0">
                <Building2 size={16} className="text-[#0EA5E9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-gray-800 truncate">
                  {group.siteName}
                </p>
                <p className="text-[11px] text-gray-400">{group.items.length}件</p>
              </div>
            </div>

            {/* 日付一覧 */}
            <div className="divide-y divide-gray-100">
              {group.items.map((item) => {
                const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.ungenerated;
                const StatusIcon = config.icon;
                const avgProgress =
                  item.officialProgress.length > 0
                    ? Math.round(
                        item.officialProgress.reduce((sum, p) => sum + p.progressRate, 0) /
                          item.officialProgress.length
                      )
                    : null;

                return (
                  <button
                    key={`${item.siteId}_${item.reportDate}`}
                    type="button"
                    onClick={() => setModalItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[13px] font-medium text-gray-700">
                        {formatDate(item.reportDate)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}
                      >
                        <StatusIcon size={10} />
                        {config.label}
                      </span>
                    </div>

                    {item.summaryText ? (
                      <p className="text-[12px] text-gray-500 leading-5 line-clamp-2 whitespace-pre-wrap">
                        {item.summaryText}
                      </p>
                    ) : (
                      <p className="text-[12px] text-gray-400 italic">タップして編集</p>
                    )}

                    {avgProgress !== null && avgProgress > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0EA5E9] transition-all"
                            style={{ width: `${Math.min(100, avgProgress)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400">{avgProgress}%</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* モーダル */}
      {modalItem && (
        <SummaryEditModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// モーダル
// ---------------------------------------------------------------------------
function SummaryEditModal({
  item,
  onClose,
}: {
  item: SummaryItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [summaryText, setSummaryText] = useState(item.summaryText);
  const [officialProgress, setOfficialProgress] = useState(item.officialProgress);
  const [summaryId, setSummaryId] = useState(item.id);
  const [status, setStatus] = useState(item.status);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 再生成プロンプト
  const [showPrompt, setShowPrompt] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // 生成済みフラグ（初回生成後に再生成UIを表示するため）
  const hasGenerated = Boolean(summaryId && summaryText);

  useEffect(() => {
    if (showPrompt && promptRef.current) {
      promptRef.current.focus();
    }
  }, [showPrompt]);

  const updateProgress = (processId: string, rate: number) => {
    setOfficialProgress((current) =>
      current.map((p) => (p.processId === processId ? { ...p, progressRate: rate } : p))
    );
  };

  // 初回生成: 1次報告から自動生成
  const handleGenerate = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await generateClientReportSummary(item.siteId, item.reportDate);
      if (!result.success) {
        setMessage(result.error || "生成に失敗しました");
        return;
      }
      setMessage("下書きを生成しました");
      router.refresh();
      onClose();
    });
  };

  // 再生成: 既存テキスト + プロンプトでTEXT2TEXT
  const handleRegenerate = () => {
    if (!userPrompt.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await regenerateSummaryWithPrompt({
        siteId: item.siteId,
        reportDate: item.reportDate,
        currentText: summaryText,
        userPrompt: userPrompt.trim(),
      });
      if (!result.success) {
        setMessage(result.error || "再生成に失敗しました");
        return;
      }
      setSummaryText(result.text);
      setUserPrompt("");
      setShowPrompt(false);
      setMessage("再生成しました。内容を確認して保存してください。");
    });
  };

  const handleSaveDraft = () => {
    setMessage(null);
    startTransition(async () => {
      if (!summaryId) {
        // 新規作成
        const result = await createClientReportSummaryManual({
          siteId: item.siteId,
          reportDate: item.reportDate,
          summaryText,
          officialProgress,
        });
        if (!result.success) {
          setMessage(result.error || "保存に失敗しました");
          return;
        }
        setSummaryId(result.summaryId);
        setStatus("draft");
        setMessage("下書きを保存しました");
        router.refresh();
      } else {
        // 既存更新
        const result = await saveClientReportSummaryDraft({
          summaryId,
          siteId: item.siteId,
          summaryText,
          officialProgress,
        });
        setMessage(result.success ? "下書きを保存しました" : result.error || "保存に失敗しました");
      }
    });
  };

  const handleSubmit = () => {
    if (
      !window.confirm(
        "クライアントへ提出します。よろしいですか？\n提出後はクライアントに表示されます。"
      )
    )
      return;
    setMessage(null);

    startTransition(async () => {
      let currentSummaryId = summaryId;
      if (!currentSummaryId) {
        // 新規作成
        const createResult = await createClientReportSummaryManual({
          siteId: item.siteId,
          reportDate: item.reportDate,
          summaryText,
          officialProgress,
        });
        if (!createResult.success) {
          setMessage(createResult.error || "保存に失敗しました");
          return;
        }
        currentSummaryId = createResult.summaryId;
        setSummaryId(currentSummaryId);
      } else {
        // 先に保存
        const saveResult = await saveClientReportSummaryDraft({
          summaryId: currentSummaryId,
          siteId: item.siteId,
          summaryText,
          officialProgress,
        });
        if (!saveResult.success) {
          setMessage(saveResult.error || "保存に失敗しました");
          return;
        }
      }

      if (!currentSummaryId) {
        setMessage("サマリーの作成に失敗しました");
        return;
      }

      const submitResult = await submitClientReportSummary(currentSummaryId, item.siteId);
      if (submitResult.success) {
        setStatus("submitted");
        const warningText = (submitResult as { success: boolean; warning?: string | null }).warning;
        setMessage(
          warningText
            ? `クライアントへ提出しました（注意: ${warningText}）`
            : "クライアントへ提出しました"
        );
        router.refresh();
      } else {
        setMessage(submitResult.error || "提出に失敗しました");
      }
    });
  };

  const isSubmitted = status === "submitted" || status === "client_confirmed";
  const isRevisionRequested = status === "revision_requested";
  const isEditable = !isSubmitted || isRevisionRequested;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.ungenerated;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Building2 size={14} className="text-[#0EA5E9]" />
              <p className="text-[14px] font-bold text-gray-900">{item.siteName}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-gray-500">{formatDate(item.reportDate)}</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}
              >
                {config.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 修正依頼コメント */}
          {isRevisionRequested && item.revisionComment && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare size={12} className="text-orange-500" />
                <span className="text-[11px] font-semibold text-orange-600">クライアントからの修正依頼</span>
              </div>
              <p className="text-[12px] text-gray-600 whitespace-pre-wrap leading-5">
                {item.revisionComment}
              </p>
            </div>
          )}

          {/* 進捗率 */}
          {officialProgress.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-medium text-gray-500">公式進捗率</p>
              <div className="space-y-2">
                {officialProgress.map((p) => (
                  <div
                    key={p.processId}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-700">
                      {p.processName}
                    </p>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.progressRate}
                      onChange={(e) =>
                        updateProgress(
                          p.processId,
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      disabled={!isEditable}
                      className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-[12px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <span className="text-[12px] text-gray-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* テキストエリア */}
          <div>
            <p className="mb-2 text-[12px] font-medium text-gray-500">クライアント提出文</p>
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              rows={10}
              disabled={!isEditable}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[12px] leading-6 text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
              placeholder="報告内容を入力してください..."
            />
          </div>

          {/* AI生成セクション */}
          {isEditable && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#0EA5E9]" />
                  <span className="text-[11px] font-semibold text-gray-600">AI生成（オプション）</span>
                </div>
                {!hasGenerated ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isPending}
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                  >
                    <Sparkles size={11} />
                    {isPending ? "生成中..." : "1次報告から生成"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <MessageSquare size={11} />
                    再生成
                  </button>
                )}
              </div>

              {!hasGenerated && (
                <p className="text-[11px] text-gray-400">
                  職人の1次報告をもとにAIが下書きを生成します
                </p>
              )}

              {/* 再生成プロンプト入力 */}
              {showPrompt && hasGenerated && (
                <div className="mt-2 space-y-2">
                  <textarea
                    ref={promptRef}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={2}
                    placeholder="例: もっと簡潔にして、安全面の記述を追加して"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none placeholder:text-gray-400"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={isPending || !userPrompt.trim()}
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={isPending ? "animate-spin" : ""} />
                      {isPending ? "再生成中..." : "この指示で再生成"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isPending}
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isPending ? "..." : "最初から再生成"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* メッセージ */}
          {message && (
            <p
              className={`text-[12px] ${
                message.includes("失敗") || message.includes("エラー")
                  ? "text-red-500"
                  : message.includes("注意")
                    ? "text-amber-500"
                    : "text-emerald-500"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        {/* フッターアクション */}
        {isEditable && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending || !summaryText.trim()}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {isPending ? "保存中..." : "下書き保存"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !summaryText.trim()}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0EA5E9] px-5 text-[13px] font-bold text-white shadow-md shadow-sky-200 transition-all hover:bg-[#0284C7] hover:shadow-lg disabled:opacity-50"
            >
              <Send size={14} />
              {isPending ? "提出中..." : isRevisionRequested ? "修正して再提出" : "クライアント提出"}
            </button>
          </div>
        )}
        {!isEditable && (
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50">
            <p className="text-[12px] text-gray-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {status === "client_confirmed" ? "クライアント確認済み" : "クライアントへ提出済み"}
            </p>
            {summaryId && (
              <Link
                href={`/client/summaries/${summaryId}/print`}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-[12px] font-medium text-[#0EA5E9] transition-colors hover:bg-cyan-100"
              >
                <Printer size={13} />
                PDF
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

