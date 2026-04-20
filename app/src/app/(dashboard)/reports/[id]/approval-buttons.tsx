"use client";

import React, { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { approveReport, rejectReport, resubmitReport } from "./actions";
import { submitDraftReport, deleteDraftReport } from "@/app/(dashboard)/reports/new/actions";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Shield, ArrowRight, RotateCcw, Send, Trash2 } from "lucide-react";

interface ApprovalButtonsProps {
  reportId: string;
  userRole: string;
  siteName: string;
  reportDate: string;
  workContent: string;
}

export function ApprovalButtons({ reportId, userRole, siteName, reportDate, workContent }: ApprovalButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isAdminOrManager = userRole === "admin" || userRole === "manager";
  const approveLabel = isAdminOrManager ? "承認する" : "確認済みにする";
  const nextStatus = isAdminOrManager ? "承認済み → クライアントへ送信" : "最終確認済み";

  const handleApprove = () => {
    setShowApproveModal(true);
  };

  const confirmApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveReport(reportId);
      if (!result.success) {
        setError(result.error || "承認に失敗しました");
        return;
      }
      setShowApproveModal(false);
    });
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectReport(reportId, rejectReason.trim() || undefined);
      if (!result.success) {
        setError(result.error || "差戻しに失敗しました");
        return;
      }
      setShowRejectModal(false);
      setRejectReason("");
    });
  };

  const approveModal = showApproveModal && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">承認確認</h3>
            <p className="text-[13px] text-gray-400">以下の報告を承認します</p>
          </div>
        </div>

        {/* サマリー */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-14 shrink-0">現場</span>
            <span className="text-[13px] text-gray-700 font-medium">{siteName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-14 shrink-0">報告日</span>
            <span className="text-[13px] text-gray-700">{reportDate}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[11px] text-gray-400 w-14 shrink-0 pt-0.5">内容</span>
            <span className="text-[12px] text-gray-500 line-clamp-3">{workContent}</span>
          </div>
        </div>

        {/* フロー表示 */}
        <div className="flex items-center justify-center gap-2 py-3 mb-4">
          <span className="text-[11px] text-gray-400 px-2 py-1 rounded-lg bg-gray-100">提出済み</span>
          <ArrowRight size={12} className="text-emerald-400" />
          <span className="text-[11px] text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-semibold">
            {isAdminOrManager ? "承認済み" : "確認済み"}
          </span>
          {isAdminOrManager && (
            <>
              <ArrowRight size={12} className="text-gray-300" />
              <span className="text-[11px] text-gray-300 px-2 py-1 rounded-lg bg-gray-50">クライアント確認</span>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowApproveModal(false)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 min-h-[44px] px-4 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={confirmApprove}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 min-h-[44px] px-4 text-[14px] font-bold text-white transition-all hover:bg-emerald-400 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isPending ? "処理中..." : approveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  const rejectModal = showRejectModal && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <XCircle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">差戻し確認</h3>
            <p className="text-[13px] text-gray-400">差戻し理由を入力してください</p>
          </div>
        </div>

        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="修正が必要な箇所や追加で必要な情報を入力してください"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-gray-900 placeholder-gray-300 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20 resize-none min-h-[100px]"
          rows={4}
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 min-h-[44px] px-4 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={confirmReject}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 min-h-[44px] px-4 text-[14px] font-bold text-white transition-all hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : "差戻し確定"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 min-h-[48px] px-5 text-[14px] font-bold text-white transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          {approveLabel}
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 min-h-[48px] px-5 text-[14px] font-bold text-red-400 transition-all duration-200 hover:bg-red-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle size={18} aria-hidden="true" />
          差戻し
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}

      {approveModal}
      {rejectModal}
    </>
  );
}

// ---------------------------------------------------------------------------
// 承認フローステータスバー（サーバーコンポーネントから利用）
// ---------------------------------------------------------------------------
export function ApprovalFlowBar({ status }: { status: string }) {
  const steps = [
    { key: "submitted", label: "提出" },
    { key: "approved", label: "承認" },
    { key: "client_confirmed", label: "クライアント確認" },
  ];

  const currentIndex = status === "rejected" ? -1
    : status === "draft" ? -1
    : status === "submitted" ? 0
    : status === "approved" ? 1
    : status === "client_confirmed" ? 2
    : -1;

  if (status === "draft") return null;

  return (
    <div className="mb-6 p-4 rounded-2xl border border-gray-200 bg-white">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">承認フロー</p>
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const isDone = currentIndex > i;
          const isActive = currentIndex === i;
          const isRejected = status === "rejected" && i === 0;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-gray-200"}`} />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                  isRejected ? "bg-red-50 text-red-400 border border-red-200" :
                  isDone ? "bg-emerald-500 text-white" :
                  isActive ? "bg-[#0EA5E9] text-white ring-2 ring-[#0EA5E9]/30" :
                  "bg-gray-100 text-gray-300 border border-gray-200"
                }`}>
                  {isRejected ? <XCircle size={14} /> : isDone ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${
                  isRejected ? "text-red-400" :
                  isDone ? "text-emerald-400" :
                  isActive ? "text-[#0EA5E9]" :
                  "text-gray-300"
                }`}>
                  {isRejected ? "差戻し" : s.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 再提出ボタン（差戻し後に再送信）
// ---------------------------------------------------------------------------
export function ResubmitButton({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleResubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await resubmitReport(reportId);
      if (!result.success) {
        setError(result.error || "再提出に失敗しました");
      }
    });
  };

  return (
    <>
      <button
        onClick={handleResubmit}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 min-h-[48px] px-5 text-[14px] font-bold text-white transition-all duration-200 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
        {isPending ? "再提出中..." : "再提出する"}
      </button>
      {error && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}
    </>
  );
}

export function SubmitDraftButton({ reportId, siblingIds }: { reportId: string; siblingIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    setError(null);
    setShowConfirm(false);
    startTransition(async () => {
      const ids = siblingIds.length > 0 ? siblingIds : [reportId];
      const result = await submitDraftReport(ids);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "提出に失敗しました");
      }
    });
  };

  return (
    <>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[44px] px-4 text-[14px] font-medium text-white hover:bg-[#0EA5E9]/90 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isPending ? "提出中..." : "提出する"}
        </button>
      ) : (
        <div className="w-full rounded-xl border border-[#0EA5E9]/30 bg-[#0EA5E9]/5 p-4">
          <p className="text-[13px] font-medium text-gray-700 mb-2">この報告を提出しますか？</p>
          <p className="text-[12px] text-gray-400 mb-3">提出後はマネージャーに通知されます</p>
          <div className="flex gap-2">
            <button onClick={() => setShowConfirm(false)} className="flex-1 min-h-[40px] rounded-xl border border-gray-200 text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </button>
            <button onClick={handleSubmit} disabled={isPending} className="flex-1 min-h-[40px] rounded-xl bg-[#0EA5E9] text-[13px] font-bold text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors">
              {isPending ? "提出中..." : "提出する"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="w-full mt-2 rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 下書きを削除するボタン
// ---------------------------------------------------------------------------
export function DeleteDraftButton({ reportId, siblingIds }: { reportId: string; siblingIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    setError(null);
    setShowConfirm(false);
    startTransition(async () => {
      const ids = siblingIds.length > 0 ? siblingIds : [reportId];
      const result = await deleteDraftReport(ids);
      if (result.success) {
        router.push("/reports");
        router.refresh();
      } else {
        setError(result.error ?? "削除に失敗しました");
      }
    });
  };

  return (
    <>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white min-h-[44px] px-4 text-[14px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
          削除する
        </button>
      ) : (
        <div className="w-full rounded-xl border border-red-200 bg-red-50/50 p-4">
          <p className="text-[13px] font-medium text-gray-700 mb-2">この下書きを削除しますか？</p>
          <p className="text-[12px] text-gray-400 mb-3">
            関連する写真も含めて完全に削除され、元に戻せません。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 min-h-[40px] rounded-xl border border-gray-200 text-[13px] text-gray-500 hover:bg-gray-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 min-h-[40px] rounded-xl bg-red-500 text-[13px] font-bold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {isPending ? "削除中..." : "削除する"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="w-full mt-2 rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}
    </>
  );
}
