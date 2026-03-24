"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { DayReportsModal } from "@/app/(dashboard)/manager/reports/day-reports-modal";
import type { SiteReportDay } from "@/app/(dashboard)/manager/reports/page";

export function CreateFirstReportButton({ day }: { day: SiteReportDay }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-lg bg-[#0EA5E9] text-[11px] font-semibold text-white hover:bg-[#0284C7] transition-colors"
      >
        <Sparkles size={12} />
        1次報告を作成する
      </button>
      {showModal && (
        <DayReportsModal day={day} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
