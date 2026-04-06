import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canAccessSite } from "@/lib/siteAccess";
import { PrintButton } from "@/app/(dashboard)/reports/[id]/print/print-button";
import { PHOTO_TYPE_LABELS } from "@/lib/constants";

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
    .select("id, site_id, report_date, summary_text, status, official_progress, submitted_at, weather, arrival_time, departure_time, workers, sites(name, address)")
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
    : "/manager/reports";

  return (
    <>
      {/* Screen-only controls */}
      <div className="print:hidden print-hidden bg-gray-50 p-5 flex items-center gap-4 border-b border-gray-200">
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
      <div className="max-w-[210mm] mx-auto p-6 bg-white text-black text-[11px] print-section print-page-break">
        {/* Header */}
        <div className="border-b-2 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold text-center mb-0.5">施工報告書</h1>
          <p className="text-center text-[10px] text-gray-500">
            Construction Report Summary
          </p>
        </div>

        {/* Basic Info Table */}
        <table className="w-full border-collapse border border-gray-400 mb-4 text-[11px]">
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
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                天気
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {((summary as Record<string, unknown>).weather as string) ?? "—"}
              </td>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                現場時間
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {(summary as Record<string, unknown>).arrival_time || (summary as Record<string, unknown>).departure_time
                  ? `${(summary as Record<string, unknown>).arrival_time ?? "--:--"} 〜 ${(summary as Record<string, unknown>).departure_time ?? "--:--"}`
                  : "—"}
              </td>
            </tr>
            {Array.isArray((summary as Record<string, unknown>).workers) && ((summary as Record<string, unknown>).workers as string[]).length > 0 && (
              <tr>
                <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                  作業者
                </td>
                <td colSpan={3} className="border border-gray-400 px-3 py-2">
                  {((summary as Record<string, unknown>).workers as string[]).join("、")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Progress Table */}
        {officialProgress.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[12px] font-bold border-b border-gray-300 pb-1 mb-2">
              工程進捗
            </h2>
            <table className="w-full border-collapse border border-gray-400 text-[11px]">
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
          <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
            {summary.summary_text || "—"}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-400">
          <span>報告日: {formatDate(summary.report_date)}</span>
          <span>現場報告システム</span>
        </div>
      </div>

      {/* Photos - 2ページ目 */}
      <SummaryPhotosPage summaryId={summaryId} siteName={siteName} reportDate={summary.report_date} formatDate={formatDate} />

      {/* Print styles */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          html, body, div, main {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            overflow: visible !important;
            height: auto !important;
          }
          .print\\:hidden, .print-hidden {
            display: none !important;
          }
          .print-section {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          img {
            break-inside: avoid;
          }
          table {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// 写真ギャラリー（2ページ目）
// ---------------------------------------------------------------------------
async function SummaryPhotosPage({
  summaryId,
  siteName,
  reportDate,
  formatDate,
}: {
  summaryId: string;
  siteName: string;
  reportDate: string;
  formatDate: (d: string) => string;
}) {
  const supabase = await createClient();

  // summary_photos から取得
  const { data: summaryPhotos } = await supabase
    .from("summary_photos")
    .select("id, storage_path, caption, source_report_id")
    .eq("summary_id", summaryId)
    .order("created_at", { ascending: true });

  // source_report_ids から元の1次報告写真も取得
  const { data: summaryData } = await supabase
    .from("client_report_summaries")
    .select("source_report_ids")
    .eq("id", summaryId)
    .single();

  const sourceReportIds = Array.isArray(summaryData?.source_report_ids)
    ? (summaryData.source_report_ids as string[])
    : [];

  let reportPhotos: { id: string; storage_path: string; photo_type: string | null; caption: string | null }[] = [];
  if (sourceReportIds.length > 0) {
    const { data } = await supabase
      .from("report_photos")
      .select("id, storage_path, photo_type, caption, media_type")
      .in("report_id", sourceReportIds)
      .or("media_type.eq.photo,media_type.is.null")
      .order("created_at", { ascending: true });
    reportPhotos = (data ?? []).map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      photo_type: p.photo_type,
      caption: p.caption,
    }));
  }

  // summary_photos のsigned URL
  const summaryPhotoUrls = await Promise.all(
    (summaryPhotos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? "", photo_type: null as string | null };
    })
  );

  // report_photos のsigned URL
  const reportPhotoUrls = await Promise.all(
    reportPhotos.map(async (p) => {
      const { data } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? "" };
    })
  );

  // 統合（重複排除: storage_path ベース）
  const seenPaths = new Set<string>();
  const allPhotos: { id: string; url: string; photo_type: string | null; caption: string | null }[] = [];
  for (const p of [...reportPhotoUrls, ...summaryPhotoUrls]) {
    if (!p.url || seenPaths.has(p.storage_path)) continue;
    seenPaths.add(p.storage_path);
    allPhotos.push({ id: p.id, url: p.url, photo_type: p.photo_type, caption: p.caption });
  }

  if (allPhotos.length === 0) return null;

  // photo_type でグループ化
  const groups: Record<string, typeof allPhotos> = {};
  const typeOrder = ["before", "during", "after"];
  for (const p of allPhotos) {
    const key = p.photo_type || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const ai = typeOrder.indexOf(a);
    const bi = typeOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="max-w-[210mm] mx-auto p-6 bg-white text-black print-section">
      <div className="border-b-2 border-black pb-3 mb-6">
        <h1 className="text-xl font-bold text-center">施工写真</h1>
        <p className="text-center text-sm text-gray-500 mt-1">
          {siteName} — {formatDate(reportDate)} （{allPhotos.length}枚）
        </p>
      </div>

      {sortedKeys.map((key) => {
        const label = PHOTO_TYPE_LABELS[key] ?? "その他";
        const items = groups[key];
        return (
          <div key={key} className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-2 px-1 border-l-4 border-gray-400 pl-2">
              {label}（{items.length}枚）
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map((p) => (
                <div key={p.id} className="border border-gray-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || label}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  {p.caption && (
                    <p className="text-[10px] px-1.5 py-1 bg-gray-50 text-gray-500 truncate">
                      {p.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-auto pt-4 border-t border-gray-300 text-right text-xs text-gray-400">
        現場報告システム
      </div>
    </div>
  );
}
