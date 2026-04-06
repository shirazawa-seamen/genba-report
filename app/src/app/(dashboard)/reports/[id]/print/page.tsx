import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { WORK_PROCESS_LABELS, PHOTO_TYPE_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import { PrintButton } from "./print-button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canAccessReport } from "@/lib/siteAccess";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPrintPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 認証・認可チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const hasAccess = await canAccessReport(user.id, id);
  if (!hasAccess) notFound();

  // クライアントは個別の職人報告にアクセスできない
  const { data: viewerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (viewerProfile?.role === "client") notFound();

  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, workers, progress_rate, weather, work_hours, arrival_time, departure_time, issues, created_at, approval_status, rejection_comment, admin_notes, reporter_id, sites(name, address), processes(id, category, name, progress_rate, status)"
    )
    .eq("id", id)
    .single();

  if (error || !report) notFound();

  // ワーカーは自分の報告のみ閲覧可能
  const isWorker = viewerProfile?.role === "worker_internal" || viewerProfile?.role === "worker_external";
  if (isWorker && report.reporter_id !== user.id) notFound();

  const sites = Array.isArray(report.sites) ? report.sites[0] : report.sites;
  const process = Array.isArray(report.processes) ? report.processes[0] : report.processes;
  const siteName = (sites as { name?: string; address?: string } | null)?.name ?? "不明な現場";
  const siteAddress = (sites as { name?: string; address?: string } | null)?.address ?? "";
  const processLabel = (process as { name?: string } | null)?.name ?? WORK_PROCESS_LABELS[report.work_process] ?? report.work_process;

  // Fetch photos（media_type が photo または null のもの。動画は除外）
  const { data: photos } = await supabase
    .from("report_photos")
    .select("id, storage_path, photo_type, caption, media_type")
    .eq("report_id", id)
    .or("media_type.eq.photo,media_type.is.null")
    .order("created_at", { ascending: true });

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? "" };
    })
  );

  // Fetch materials
  const { data: materials } = await supabase
    .from("report_materials")
    .select("material_name, product_number, quantity, unit, supplier")
    .eq("report_id", id);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });

  return (
    <>
      {/* Screen-only controls */}
      <div className="print:hidden bg-gray-50 p-5 flex items-center gap-4 border-b border-gray-200">
        <Link
          href={`/reports/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors min-h-[44px]"
        >
          <ArrowLeft size={14} /> 報告詳細に戻る
        </Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* Print content */}
      <div className="max-w-[210mm] mx-auto p-6 bg-white text-black text-[11px] print-section print-page-break">
        {/* Header */}
        <div className="border-b-2 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold text-center mb-0.5">日次施工報告書</h1>
          <p className="text-center text-[10px] text-gray-500">
            Daily Construction Report
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
                {formatDate(report.report_date)}
              </td>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold w-[120px]">
                ステータス
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {APPROVAL_STATUS_LABELS[report.approval_status] ?? report.approval_status}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                工程
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {processLabel}
              </td>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                進捗率
              </td>
              <td className="border border-gray-400 px-3 py-2 font-bold">
                {report.progress_rate}%
              </td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                天候
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {report.weather ?? "—"}
              </td>
              <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                現場時間
              </td>
              <td className="border border-gray-400 px-3 py-2">
                {(report.arrival_time || report.departure_time)
                  ? `${(report.arrival_time as string) || "--:--"} 〜 ${(report.departure_time as string) || "--:--"}`
                  : "—"}
              </td>
            </tr>
            {report.workers && (report.workers as string[]).length > 0 && (
              <tr>
                <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-semibold">
                  作業者
                </td>
                <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                  {(report.workers as string[]).join("、")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Work Content */}
        <div className="mb-6">
          <h2 className="text-[12px] font-bold border-b border-gray-300 pb-1 mb-2">
            作業内容
          </h2>
          <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
            {report.work_content || "—"}
          </p>
        </div>

        {/* Issues */}
        {report.issues && (
          <div className="mb-6">
            <h2 className="text-[12px] font-bold border-b border-gray-300 pb-1 mb-2">
              課題・懸念事項
            </h2>
            <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
              {report.issues}
            </p>
          </div>
        )}

        {/* Admin Notes */}
        {report.admin_notes && (
          <div className="mb-6">
            <h2 className="text-[12px] font-bold border-b border-gray-300 pb-1 mb-2">
              管理者メモ
            </h2>
            <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
              {String(report.admin_notes)}
            </p>
          </div>
        )}

        {/* Materials */}
        {materials && materials.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[12px] font-bold border-b border-gray-300 pb-1 mb-2">
              使用材料
            </h2>
            <table className="w-full border-collapse border border-gray-400 text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-3 py-2 text-left">
                    材料名
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left">
                    品番
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-right">
                    数量
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left">
                    単位
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left">
                    仕入先
                  </th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m, i) => (
                  <tr key={i}>
                    <td className="border border-gray-400 px-3 py-1.5">
                      {m.material_name}
                    </td>
                    <td className="border border-gray-400 px-3 py-1.5">
                      {m.product_number ?? "—"}
                    </td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">
                      {m.quantity ?? "—"}
                    </td>
                    <td className="border border-gray-400 px-3 py-1.5">
                      {m.unit ?? "—"}
                    </td>
                    <td className="border border-gray-400 px-3 py-1.5">
                      {m.supplier ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-400">
          <span>
            作成日時: {new Date(report.created_at).toLocaleString("ja-JP")}
          </span>
          <span>現場報告システム</span>
        </div>

      </div>

      {/* Photos - 2ページ目 */}
      {photosWithUrls.length > 0 && (() => {
        // photo_type でグループ化
        const groups: Record<string, typeof photosWithUrls> = {};
        const typeOrder = ["before", "during", "after"];
        for (const p of photosWithUrls) {
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
                {siteName} — {formatDate(report.report_date)} （{photosWithUrls.length}枚）
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
      })()}

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
