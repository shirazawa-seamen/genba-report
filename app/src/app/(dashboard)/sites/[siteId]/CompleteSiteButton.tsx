"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { updateSiteStatus } from "../actions";
import { Button } from "@/components/ui/button";

interface CompleteSiteButtonProps {
  siteId: string;
  isCompleted: boolean;
}

export function CompleteSiteButton({ siteId, isCompleted }: CompleteSiteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateSiteStatus(siteId, isCompleted ? "active" : "completed");
      if (!result.success) {
        setError(result.error ?? "エラーが発生しました");
        return;
      }
      setShowConfirm(false);
      router.refresh();
    });
  };

  return (
    <>
      {isCompleted ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-amber-500 border border-amber-200 hover:bg-amber-50 transition-all"
        >
          <RotateCcw size={14} /> 稼働中に戻す
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-emerald-500 border border-emerald-200 hover:bg-emerald-50 transition-all"
        >
          <CheckCircle2 size={14} /> 現場を完了する
        </button>
      )}

      {showConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 max-w-sm w-full shadow-sm">
            <h3 className="text-[16px] font-bold text-gray-900 mb-2">
              {isCompleted ? "現場を稼働中に戻しますか？" : "現場を完了しますか？"}
            </h3>
            <p className="text-[13px] text-gray-400 mb-6">
              {isCompleted
                ? "この現場を稼働中の一覧に戻します。"
                : "この現場を完了にすると、稼働中の一覧から非表示になります。"}
            </p>
            {error && <p className="text-[13px] text-red-400 mb-4">{error}</p>}
            <div className="flex gap-2.5">
              <Button variant="outline" size="sm" onClick={() => { setShowConfirm(false); setError(null); }} disabled={isPending} className="flex-1">
                キャンセル
              </Button>
              <Button
                variant={isCompleted ? "secondary" : "primary"}
                size="sm"
                onClick={handleConfirm}
                disabled={isPending}
                loading={isPending}
                className="flex-1"
              >
                {isPending ? "処理中..." : isCompleted ? "稼働中に戻す" : "完了にする"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
