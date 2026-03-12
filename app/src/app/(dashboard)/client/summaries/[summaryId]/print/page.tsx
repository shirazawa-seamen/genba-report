import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canAccessSite } from "@/lib/siteAccess";
import { PrintButton } from "@/app/(dashboard)/reports/[id]/print/print-button";

interface PageProps {
  params: Promise<{ summaryId: string }>;
}

export default async function SummaryPrintPage({ params }: PageProps) {
  const { summaryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // クライアントまたはマネージャー/管理者がアクセス可能
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;
  if (!userRole) notFound();

  const { data: summary } = await supabase
    .from("client_report_summaries")
    .select("id, site_id, report_date, summary_text, status, official_progress, submitted_at, sites(name, address)")
    .eq("id", summaryId)
    .maybeSingle();

  if (!summary) notFound();
  if (!(await canAccessSite(user.id, summary.site_id))) notFound();

  // クライアントは submitted / client_confirmed のみ閲覧可
  if (userRole === "client" && summary.status !== "submitted" && summary.status !== "client_confirmed") {
    notFound();
  }

  const sites = summary.sites as unknown as { name?: string; address?: string } | null;
  const siteName = sites?.name ?? "不明な現場";
  const siteAddress = sites?.address ?? "";

  const officialProgress = Array.isArray(summary.official_progress)
    ? (summary.official_progress as Array<{ processName?: string; progressRate?: number }>)
    : [];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });

  const backHref = userRole === "client"
    ? `/client/summaries/${summaryId}`
    : "/manager/summaries";

  return (
    <>
      {/* Screen-only controls */}
      <div className="print:hidden bg-gray-50 p-5 flex items-center gap-4 border-b border-gray-200">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors min-h-[44px]"
        >
          <ArrowLeft size={14} /> 戻る
        </Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* Print content */}
      <div className="max-w-[210mm] mx-auto p-8 print:p-6 bg-white text-black print:text-black">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold text-center mb-1">施工報告書</h1>
          <p className="text-center text-sm text-gray-500">
            Construction Report Summary
          </p>
        </div>

        {/* Basic Info Table */}
        <table className="w-full border-collapse border border-gray-400 mb-6 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold w-[120px]">
                現場名
              </td>
              <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                {siteName}
              </td>
            </tr>
            {siteAddress && (
              <tr>
                <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                  住所
                </td>
                <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                  {siteAddress}
                </td>
              </tr>
            )}
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                報告日
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {formatDate(summary.report_date)}
              </td>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold w-[120px]">
                提出日
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {summary.submitted_at
                  ? new Date(summary.submitted_at).toLocaleDateString("ja-JP")
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Progress Table */}
        {officialProgress.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3">
              工程進捗
            </h2>
            <table className="w-full border-collapse border border-gray-400 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-3 py-2 text-left">工程名</th>
                  <th className="border border-gray-400 px-3 py-2 text-right w-[100px]">進捗率</th>
                </tr>
              </thead>
              <tbody>
                {officialProgress.map((item, i) => (
                  <tr key={i}>
                    <td className="border border-gray-400 px-3 py-1.5">
                      {item.processName ?? "工程未設定"}
                    </td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right font-bold">
                      {item.progressRate ?? 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Text */}
        <div className="mb-6">
          <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3">
            報告内容
          </h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {summary.summary_text || "—"}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-400">
          <span>報告日: {formatDate(summary.report_date)}</span>
          <span>現場報告システム</span>
        </div>

        {/* Signature area */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          {["施工管理者", "現場責任者", "クライアント"].map((label) => (
            <div key={label} className="text-center">
              <div className="border border-gray-400 h-20 mb-1" />
              <p className="text-sm text-gray-600">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
