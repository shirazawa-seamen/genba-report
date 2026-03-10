"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-xl bg-[#00D9FF] min-h-[44px] px-5 text-[14px] font-bold text-[#0e0e0e] transition-all hover:bg-[#00D9FF]/90 active:scale-[0.98]"
    >
      <Printer size={16} />
      印刷 / PDF保存
    </button>
  );
}
