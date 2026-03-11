"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-xl bg-[#0EA5E9] min-h-[44px] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#0284C7] active:scale-[0.98]"
    >
      <Printer size={16} />
      印刷 / PDF保存
    </button>
  );
}
