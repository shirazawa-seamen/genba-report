import { createClient } from "@/lib/supabase/server";
import { WORK_PROCESS_LABELS } from "@/lib/constants";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft, ArrowRight, FileText, Sparkles, Camera } from "lucide-react";
import { canAccessSite } from "@/lib/siteAccess";
import { SummaryEditor } from "./summary-editor";
import { GenerateSummaryButton } from "./generate-summary-button";
import { CreateSummaryButton } from "./create-summary-button";

interface DailyReport {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  reporter_id: string | null;
  approval_status: string;
  processes: { name: string } | null;
}

interface ReportPhoto {
  id: string;
  report_id: string;
  storage_path: string;
  photo_type: string;
  media_type: string;
  caption: string | null;
}

interface DailySummary {
  id: string;
  report_date: string;
  summary_text: string;
  status: string;
  official_progress?: Array<{
    processId?: string;
    processName?: string;
    progressRate?: number;
  }> | null;
}

interface PageProps { params: Promise<{ siteId: string }> }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
}

function progressText(r: number) {
  if (r >= 80) return "text-emerald-400";
  if (r >= 50) return "text-[#0EA5E9]";
  return "text-red-400";
}

const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-500" },
  submitted: { label: "提出済み", cls: "bg-amber-100 text-amber-600" },
  approved: { label: "承認済み", cls: "bg-emerald-100 text-emerald-600" },
  client_confirmed: { label: "確認済み", cls: "bg-blue-100 text-blue-600" },
  rejected: { label: "差戻し", cls: "bg-red-100 text-red-500" },
};

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: "施工前",
  during: "施工中",
  after: "施工後",
  corner_ne: "北東",
  corner_nw: "北西",
  corner_se: "南東",
  corner_sw: "南西",
};

export default async function SiteReportsPage({ params }: PageProps) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  if (!(await canAccessSite(user.id, siteId))) notFound();
  const { data: viewerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  // クライアントは1次報告を見れない → 二次報告（サマリー）一覧へリダイレクト
  if (viewerProfile?.role === "client") redirect(`/client?site=${siteId}`);

  // ワーカーはサイト別の報告一覧ではなく、自分の報告一覧へリダイレクト
  const isWorker = viewerProfile?.role === "worker_internal" || viewerProfile?.role === "worker_external";
  if (isWorker) redirect("/reports");

  const canManageSummary = viewerProfile?.role === "admin" || viewerProfile?.role === "manager";

  const { data: site, error: siteError } = await supabase
    .from("sites").select("id, name").eq("id", siteId).single();

  if (siteError || !site) notFound();

  const { data: reports } = await supabase
    .from("daily_reports")
    .select(`id, report_date, work_process, progress_rate, work_content, reporter_id, approval_status, processes(name)`)
    .eq("site_id", siteId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: summaries } = await supabase
    .from("client_report_summaries")
    .select("id, report_date, summary_text, status, official_progress")
    .eq("site_id", siteId)
    .order("report_date", { ascending: false });

  // 現場メンバー取得（2次報告の作業者選択用）
  const { data: siteMembers } = await supabase
    .from("site_members")
    .select("user_id, profiles(full_name, role)")
    .eq("site_id", siteId);
  const memberOptions = (siteMembers ?? [])
    .map((m) => {
      const profile = m.profiles as unknown as { full_name?: string; role?: string } | null;
      return {
        id: m.user_id,
        name: profile?.full_name ?? "不明",
        role: profile?.role ?? "",
      };
    })
    .filter((m) => m.role !== "client");

  const reportList = (reports as DailyReport[] | null) ?? [];
  const reporterIds = [...new Set(reportList.map((report) => report.reporter_id).filter(Boolean))] as string[];
  const { data: reporters } = reporterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", reporterIds)
    : { data: [] };
  const reporterMap = new Map((reporters ?? []).map((reporter) => [reporter.id, reporter.full_name ?? "不明"]));

  // 写真データ取得
  const reportIds = reportList.map((r) => r.id);
  const { data: photos } = reportIds.length
    ? await supabase
        .from("report_photos")
        .select("id, report_id, storage_path, photo_type, media_type, caption")
        .in("report_id", reportIds)
        .eq("media_type", "photo")
    : { data: [] };
  const photosByReport = new Map<string, ReportPhoto[]>();
  for (const photo of (photos as ReportPhoto[] | null) ?? []) {
    const list = photosByReport.get(photo.report_id) ?? [];
    list.push(photo);
    photosByReport.set(photo.report_id, list);
  }

  // 写真のsigned URL一括取得（最大表示用）
  const allPhotoPaths = (photos ?? []).map((p) => (p as ReportPhoto).storage_path);
  const signedUrlMap = new Map<string, string>();
  if (allPhotoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("report-photos")
      .createSignedUrls(allPhotoPaths, 3600);
    if (signedUrls) {
      for (const item of signedUrls) {
        if (item.signedUrl && item.path) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      }
    }
  }

  const reportsByDate = reportList.reduce<Record<string, DailyReport[]>>((acc, report) => {
    acc[report.report_date] = [...(acc[report.report_date] ?? []), report];
    return acc;
  }, {});
  const summaryMap = new Map(
    ((summaries as DailySummary[] | null) ?? []).map((summary) => [summary.report_date, summary])
  );

  // 2次報告の写真を取得
  const summaryIds = ((summaries as DailySummary[] | null) ?? []).map((s) => s.id);
  let summaryPhotoMap = new Map<string, Array<{ id: string; url: string; caption: string | null; mediaType: string; isFromReport: boolean }>>();
  if (summaryIds.length > 0) {
    try {
      const { data: summaryPhotos } = await supabase
        .from("summary_photos")
        .select("id, summary_id, storage_path, caption, media_type, source_report_id")
        .in("summary_id", summaryIds)
        .order("created_at");

      if (summaryPhotos && summaryPhotos.length > 0) {
        const spPaths = summaryPhotos.map((p) => p.storage_path);
        const { data: spUrls } = await supabase.storage
          .from("report-photos")
          .createSignedUrls(spPaths, 3600);
        const spUrlMap = new Map<string, string>();
        if (spUrls) {
          for (const item of spUrls) {
            if (item.signedUrl && item.path) spUrlMap.set(item.path, item.signedUrl);
          }
        }

        for (const sp of summaryPhotos) {
          const list = summaryPhotoMap.get(sp.summary_id) ?? [];
          list.push({
            id: sp.id,
            url: spUrlMap.get(sp.storage_path) ?? "",
            caption: sp.caption,
            mediaType: sp.media_type ?? "photo",
            isFromReport: !!sp.source_report_id,
          });
          summaryPhotoMap.set(sp.summary_id, list);
        }
      }
    } catch {
      // summary_photos テーブルが未作成の場合は無視
      summaryPhotoMap = new Map();
    }
  }
  // 1次報告の日付 + 2次報告のみ存在する日付を統合
  const reportDates = new Set(reportList.map((report) => report.report_date));
  const summaryOnlyDates = ((summaries as DailySummary[] | null) ?? [])
    .map((s) => s.report_date)
    .filter((d) => !reportDates.has(d));
  const uniqueDates = [...reportDates, ...summaryOnlyDates];

  // 日付をソート（サマリーの状態考慮：未生成/下書き優先）
  const sortedDates = [...uniqueDates].sort((a, b) => {
    if (!canManageSummary) return b.localeCompare(a);
    const sa = summaryMap.get(a);
    const sb = summaryMap.get(b);
    const priority = (s: DailySummary | undefined) => !s ? 0 : s.status === "draft" ? 1 : s.status === "submitted" ? 2 : 3;
    const pa = priority(sa);
    const pb = priority(sb);
    if (pa !== pb) return pa - pb;
    return b.localeCompare(a);
  });

  // マネージャー用サマリー統計
  const draftCount = uniqueDates.filter((d) => { const s = summaryMap.get(d); return s && s.status === "draft"; }).length;
  const ungeneratedCount = uniqueDates.filter((d) => !summaryMap.get(d)).length;
  const submittedCount = uniqueDates.filter((d) => { const s = summaryMap.get(d); return s && s.status === "submitted"; }).length;
  const confirmedCount = uniqueDates.filter((d) => { const s = summaryMap.get(d); return s && s.status === "client_confirmed"; }).length;

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      <Link href={`/sites/${siteId}`} className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]">
        <ArrowLeft size={14} /> {site.name}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">報告一覧</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{site.name} / {reportList.length}件</p>
        </div>
        {viewerProfile?.role !== "client" ? (
          <Link
            href={`/reports/new?siteId=${siteId}`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0EA5E9] text-white text-[13px] font-semibold hover:bg-[#0284C7] transition-colors active:scale-[0.98]"
          >
            <Plus size={16} /> 新規報告
          </Link>
        ) : null}
      </div>

      {/* マネージャー用サマリー統計バー */}
      {canManageSummary && (
        <div className="mb-6 space-y-3">
          {uniqueDates.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#0EA5E9]" />
                <span className="text-[13px] font-semibold text-gray-700">サマリー状況</span>
              </div>
              {ungeneratedCount > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500 font-medium">未生成 {ungeneratedCount}</span>}
              {draftCount > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-600 font-medium">下書き {draftCount}</span>}
              {submittedCount > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-600 font-medium">提出済み {submittedCount}</span>}
              {confirmedCount > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-600 font-medium">確認済み {confirmedCount}</span>}
            </div>
          )}
          <CreateSummaryButton siteId={siteId} />
        </div>
      )}

      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <FileText size={36} className="mb-3 text-gray-200" />
          <p className="text-[15px] mb-5">報告がまだありません</p>
          <Link
            href={`/reports/new?siteId=${siteId}`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0EA5E9] text-white text-[13px] font-semibold hover:bg-[#0284C7] transition-colors"
          >
            <Plus size={16} /> 最初の報告を作成
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((reportDate) => {
            const dayReports = reportsByDate[reportDate] ?? [];
            const summary = summaryMap.get(reportDate);
            const summaryStatusConfig = !summary
              ? { badge: "未生成", badgeClass: "bg-gray-100 text-gray-500", borderClass: "border-gray-200" }
              : summary.status === "draft"
                ? { badge: "下書き", badgeClass: "bg-amber-100 text-amber-600", borderClass: "border-amber-300" }
                : summary.status === "submitted"
                  ? { badge: "提出済み", badgeClass: "bg-emerald-100 text-emerald-600", borderClass: "border-emerald-200" }
                  : { badge: "確認済み", badgeClass: "bg-blue-100 text-blue-600", borderClass: "border-blue-200" };

            return (
              <div key={reportDate} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* 日付ヘッダー */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-gray-800">{formatDate(reportDate)}</p>
                      {dayReports.length > 0 && <span className="text-[11px] text-gray-400">{dayReports.length}件の報告</span>}
                      {dayReports.length === 0 && <span className="text-[11px] text-gray-400">2次報告のみ</span>}
                    </div>
                    {canManageSummary && (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${summaryStatusConfig.badgeClass}`}>
                          {summaryStatusConfig.badge}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* クライアント提出サマリー（マネージャーのみ） */}
                {canManageSummary && (
                  <div className={`border-b ${summary ? summaryStatusConfig.borderClass : "border-gray-100"} bg-gradient-to-r from-cyan-50/30 to-white`}>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={14} className="text-[#0EA5E9]" />
                          <span className="text-[12px] font-semibold text-[#0EA5E9]">クライアント向け日報</span>
                        </div>
                        <GenerateSummaryButton
                          siteId={siteId}
                          reportDate={reportDate}
                          hasSummary={Boolean(summary)}
                        />
                      </div>
                      {summary ? (
                        <SummaryEditor
                          summaryId={summary.id}
                          siteId={siteId}
                          reportDate={formatDate(reportDate)}
                          initialSummaryText={summary.summary_text}
                          siteMembers={memberOptions}
                          initialOfficialProgress={
                            (summary.official_progress ?? []).map((item) => ({
                              processId: item.processId ?? item.processName ?? "",
                              processName: item.processName ?? item.processId ?? "工程未設定",
                              progressRate: item.progressRate ?? 0,
                            })).length > 0
                              ? (summary.official_progress ?? []).map((item) => ({
                                  processId: item.processId ?? item.processName ?? "",
                                  processName: item.processName ?? item.processId ?? "工程未設定",
                                  progressRate: item.progressRate ?? 0,
                                }))
                              : [...new Map(dayReports.map((report) => [
                                  report.processes?.name ?? report.id,
                                  {
                                    processId: report.processes?.name ?? report.id,
                                    processName: report.processes?.name ?? "工程未設定",
                                    progressRate: report.progress_rate ?? 0,
                                  },
                                ])).values()]
                          }
                          initialPhotos={summaryPhotoMap.get(summary.id) ?? []}
                          status={summary.status}
                        />
                      ) : (
                        <p className="text-[12px] text-gray-400">職人報告をまとめてクライアント向けの日報を生成できます。</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 職人報告一覧（ツリー表示） */}
                <div className="divide-y divide-gray-100">
                  {dayReports.map((r) => {
                    const processName = r.processes?.name ?? WORK_PROCESS_LABELS[r.work_process] ?? r.work_process;
                    const rate = r.progress_rate ?? 0;
                    const reporterName = r.reporter_id ? reporterMap.get(r.reporter_id) ?? "不明" : "不明";
                    const badge = APPROVAL_BADGE[r.approval_status];
                    const reportPhotos = photosByReport.get(r.id) ?? [];

                    return (
                      <div key={r.id} className="px-4 py-3">
                        <Link href={`/reports/${r.id}`} className="group flex items-start gap-3 hover:opacity-80 transition-opacity">
                          {/* ツリーインジケーター */}
                          <div className="flex flex-col items-center pt-1 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-[#0EA5E9] transition-colors" />
                            {reportPhotos.length > 0 && <div className="w-px h-full bg-gray-200 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[13px] font-medium text-gray-800">{reporterName}</p>
                              <span className="text-[11px] text-gray-400">{processName}</span>
                              <span className={`text-[11px] font-semibold ${progressText(rate)}`}>{rate}%</span>
                              {badge && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-gray-500 line-clamp-2 leading-5">{r.work_content}</p>
                          </div>
                          <ArrowRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors shrink-0 mt-1" />
                        </Link>

                        {/* 添付写真サムネイル */}
                        {reportPhotos.length > 0 && (
                          <div className="ml-6 mt-2 flex flex-wrap gap-2">
                            {reportPhotos.slice(0, 4).map((photo) => {
                              const url = signedUrlMap.get(photo.storage_path);
                              return (
                                <Link key={photo.id} href={`/reports/${r.id}`} className="block shrink-0">
                                  {url ? (
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-[#0EA5E9]/50 transition-colors">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url}
                                        alt={photo.caption ?? PHOTO_TYPE_LABELS[photo.photo_type] ?? "写真"}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1 py-0.5">
                                        <p className="text-[8px] text-white truncate">{PHOTO_TYPE_LABELS[photo.photo_type] ?? photo.photo_type}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                                      <Camera size={12} className="text-gray-300" />
                                    </div>
                                  )}
                                </Link>
                              );
                            })}
                            {reportPhotos.length > 4 && (
                              <Link href={`/reports/${r.id}`} className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:border-[#0EA5E9]/50 transition-colors">
                                <span className="text-[11px] text-gray-400 font-medium">+{reportPhotos.length - 4}</span>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
