"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { approveReport, rejectReport } from "./actions";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface ApprovalButtonsProps {
  reportId: string;
}

export function ApprovalButtons({ reportId }: ApprovalButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveReport(reportId);
      if (!result.success) {
        setError(result.error || "承認に失敗しました");
      }
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

  const rejectModal = showRejectModal && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#222222] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <XCircle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-white/90">差戻し確認</h3>
            <p className="text-[13px] text-white/40">差戻し理由を入力してください</p>
          </div>
        </div>

        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="修正が必要な箇所や追加で必要な情報を入力してください"
          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-[14px] text-white/90 placeholder-white/25 focus:border-[#00D9FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00D9FF]/20 resize-none min-h-[100px]"
          rows={4}
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason("");
            }}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] min-h-[44px] px-4 text-[14px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={confirmReject}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 min-h-[44px] px-4 text-[14px] font-bold text-white transition-all hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "差戻し確定"
            )}
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
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 min-h-[48px] px-5 text-[14px] font-bold text-[#0e0e0e] transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          承認する
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 min-h-[48px] px-5 text-[14px] font-bold text-red-400 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle size={18} aria-hidden="true" />
          差戻し
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-[13px] text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </p>
        </div>
      )}

      {rejectModal}
    </>
  );
}
