import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Building2, Printer, AlertTriangle, Camera, Video } from "lucide-react";
import { canAccessSite } from "@/lib/siteAccess";
import { ClientConfirmButton } from "./confirm-button";
import { ClientRevisionRequestButton } from "./revision-request-button";
import { getSummaryPhotos } from "@/app/(dashboard)/sites/[siteId]/reports/actions";

interface PageProps {
  params: Promise<{ summaryId: string }>;
}

export default async function ClientSummaryDetailPage({ params }: PageProps) {
  const { summaryId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") redirect("/");

  // revision_comment は migration_v22 で追加。未適用時のフォールバック付き
  const initialSummaryResult = await supabase
    .from("client_report_summaries")
    .select("id, site_id, report_date, summary_text, status, official_progress, revision_comment, submitted_at, sites(name)")
    .eq("id", summaryId)
    .maybeSingle();
  let summary = initialSummaryResult.data;

  if (initialSummaryResult.error || !summary) {
    // revision_comment カラム未追加の場合はカラムなしでリトライ
    const { data: fallback } = await supabase
      .from("client_report_summaries")
      .select("id, site_id, report_date, summary_text, status, official_progress, sites(name)")
      .eq("id", summaryId)
      .maybeSingle();
    if (!fallback) notFound();
    summary = { ...fallback, revision_comment: null as string | null, submitted_at: null as string | null };
  }
  if (!summary) notFound();
  if (!(await canAccessSite(user.id, summary.site_id))) notFound();

  const siteName = (summary.sites as unknown as { name?: string } | null)?.name ?? "不明な現場";
  const isConfirmed = summary.status === "client_confirmed";
  const isRevisionRequested = summary.status === "revision_requested";
  const officialProgress = Array.isArray(summary.official_progress)
    ? (summary.official_progress as Array<{ processName?: string; progressRate?: number }>)
    : [];

  const reportDate = new Date(summary.report_date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // サマリー写真を取得
  const photos = await getSummaryPhotos(summary.id);

  return (
    <div className="flex-1 overflow-x-hidden px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/client"
          className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 transition-colors hover:text-[#0EA5E9]"
        >
          <ArrowLeft size={14} />
          確認ダッシュボード
        </Link>

        {/* ヘッダー */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={14} className="text-[#0EA5E9]" />
                <p className="text-[15px] font-bold text-gray-900">{siteName}</p>
              </div>
              <p className="text-[13px] text-gray-500">{reportDate}</p>
              {summary.submitted_at && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  提出: {new Date(summary.submitted_at).toLocaleString("ja-JP")}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isConfirmed
                  ? "bg-emerald-50 text-emerald-600"
                  : isRevisionRequested
                    ? "bg-amber-50 text-amber-600"
                    : "bg-amber-50 text-amber-600"
              }`}
            >
              {isConfirmed ? (
                <span className="flex items-center gap-1"><CheckCircle2 size={12} /> 確認済み</span>
              ) : isRevisionRequested ? (
                <span className="flex items-center gap-1"><AlertTriangle size={12} /> 修正依頼中</span>
              ) : (
                <span className="flex items-center gap-1"><Clock size={12} /> 確認待ち</span>
              )}
            </span>
          </div>

          {/* 修正依頼中の場合、コメントを表示 */}
          {isRevisionRequested && summary.revision_comment && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-[11px] font-semibold text-amber-500">修正依頼コメント</span>
              </div>
              <p className="text-[12px] text-gray-600 whitespace-pre-wrap leading-5">
                {summary.revision_comment}
              </p>
            </div>
          )}

          {/* 進捗率 */}
          {officialProgress.length > 0 && (
            <div className="mb-4 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-medium text-gray-400 mb-2">工程進捗</p>
              <div className="space-y-2">
                {officialProgress.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[12px] text-gray-600 min-w-0 flex-1 truncate">
                      {item.processName ?? "工程未設定"}
                    </span>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-[#0EA5E9] transition-all"
                        style={{ width: `${Math.min(100, item.progressRate ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-gray-700 w-10 text-right shrink-0">
                      {item.progressRate ?? 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* サマリー本文 */}
          <div className="pt-3 border-t border-gray-100">
            <p className="whitespace-pre-wrap text-[13px] leading-7 text-gray-700">
              {summary.summary_text}
            </p>
          </div>

          {/* 写真・動画 */}
          {photos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-3">
                <Camera size={14} className="text-[#0EA5E9]" />
                <p className="text-[11px] font-medium text-gray-400">添付写真・動画（{photos.length}件）</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {photo.mediaType === "video" ? (
                      <div className="relative">
                        <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-lg bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#0EA5E9]">
                          <Video size={10} />
                          動画
                        </div>
                        <video
                          src={photo.url}
                          controls
                          className="aspect-square w-full bg-black object-cover"
                          preload="metadata"
                        />
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photo.url}
                        alt={photo.caption || "報告写真"}
                        className="aspect-square w-full object-cover"
                      />
                    )}
                    {photo.caption && (
                      <p className="px-2 py-1.5 text-[10px] text-gray-500 truncate">{photo.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              {/* 確認ボタン — 提出済みで未確認のときのみ */}
              {!isConfirmed && !isRevisionRequested && (
                <ClientConfirmButton summaryId={summary.id} />
              )}

              {/* 修正依頼ボタン — 提出済みまたは確認済みで依頼可能 */}
              {!isRevisionRequested && (summary.status === "submitted" || summary.status === "client_confirmed") && (
                <ClientRevisionRequestButton summaryId={summary.id} />
              )}

              {/* PDF出力 */}
              <Link
                href={`/client/summaries/${summary.id}/print`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-[13px] font-medium text-[#0EA5E9] transition-colors hover:bg-cyan-100"
              >
                <Printer size={16} />
                PDF出力
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
