import { createClient } from "@/lib/supabase/server";
import { WORK_PROCESS_LABELS, PHOTO_TYPE_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  HardHat,
  TrendingUp,
  Users,
  Cloud,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  Shield,
  Edit3,
  Printer,
} from "lucide-react";
import { ApprovalButtons, ResubmitButton, SubmitDraftButton, DeleteDraftButton } from "./approval-buttons";
import { canAccessReport } from "@/lib/siteAccess";
import { PhotoGallery, type PhotoItem } from "@/components/ui/PhotoGallery";
import { getActivityLogs } from "@/lib/activity-log";
import type { ActivityAction } from "@/lib/types";

interface SiteData { name: string; address: string | null }
interface ProcessData { id: string; category: string; name: string; progress_rate: number; status: string }
interface ReportDetailRaw {
  id: string; report_date: string; work_process: string; work_content: string;
  workers: string[] | null; progress_rate: number; weather: string | null;
  work_hours: number | null; arrival_time: string | null; departure_time: string | null;
  issues: string | null; created_at: string; approved_at: string | null;
  approval_status: string; rejection_comment: string | null;
  admin_notes: string | null; edited_by_admin: boolean | null;
  reporter_id: string | null;
  sites: SiteData | SiteData[] | null; processes: ProcessData | ProcessData[] | null;
}
interface ReportPhoto { id: string; storage_path: string; photo_type: string | null; caption: string | null; media_type: string | null }
interface PageProps { params: Promise<{ id: string }> }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function progressColor(r: number) {
  if (r >= 80) return "bg-emerald-500";
  if (r >= 50) return "bg-[#0EA5E9]";
  return "bg-red-500";
}

function progressText(r: number) {
  if (r >= 80) return "text-emerald-400";
  if (r >= 50) return "text-[#0EA5E9]";
  return "text-red-400";
}

function statusIcon(s: string) {
  const map: Record<string, { Icon: React.ElementType; color: string }> = {
    submitted: { Icon: Clock, color: "text-blue-400" },
    approved: { Icon: CheckCircle2, color: "text-emerald-400" },
    client_confirmed: { Icon: CheckCircle2, color: "text-[#0EA5E9]" },
    rejected: { Icon: XCircle, color: "text-red-400" },
    draft: { Icon: FileText, color: "text-gray-400" },
  };
  return map[s] ?? map.draft;
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("daily_reports")
    .select(`id, report_date, work_process, work_content, workers, progress_rate, weather, work_hours, arrival_time, departure_time, issues, created_at, approved_at, approval_status, rejection_comment, admin_notes, edited_by_admin, reporter_id, sites(name, address), processes(id, category, name, progress_rate, status)`)
    .eq("id", id).single();

  if (reportError || !report) { console.error("Report fetch error:", reportError); notFound(); }

  const raw = report as ReportDetailRaw;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // 認可チェック: ユーザーがこの報告の現場にアクセスできるか確認
  const hasAccess = await canAccessReport(user.id, id);
  if (!hasAccess) notFound();

  let userRole: string | null = null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  userRole = profile?.role ?? null;

  // クライアントは個別の職人報告ではなく、マネージャーのサマリーのみ閲覧
  if (userRole === "client") notFound();

  // ワーカーは自分の報告のみ閲覧可能
  const isWorker = userRole === "worker_internal" || userRole === "worker_external";
  if (isWorker && raw.reporter_id !== user.id) notFound();

  const canApprove = userRole === "admin" || userRole === "manager";

  let reporterName: string | null = null;
  if (raw.reporter_id) {
    const { data: reporterProfile } = await supabase.from("profiles").select("full_name").eq("id", raw.reporter_id).single();
    reporterName = reporterProfile?.full_name || null;
  }

  const canResubmit = raw.approval_status === "rejected" && (
    (user && raw.reporter_id === user.id) || userRole === "admin" || userRole === "manager"
  );

  const sites = Array.isArray(raw.sites) ? raw.sites[0] ?? null : raw.sites;

  // 同じ報告者・同じ日・同じ現場の兄弟レポートを取得（複数工程対応）
  let siblingReports: Array<{ id: string; progress_rate: number; processes: { id: string; name: string; category: string } | null }> = [];
  {
    // 現在のレポートのsite_idを取得
    const { data: currentReport } = await supabase
      .from("daily_reports")
      .select("site_id")
      .eq("id", id)
      .single();

    if (currentReport?.site_id && raw.reporter_id) {
      const { data: siblings } = await supabase
        .from("daily_reports")
        .select("id, progress_rate, processes(id, name, category)")
        .eq("site_id", currentReport.site_id)
        .eq("reporter_id", raw.reporter_id)
        .eq("report_date", raw.report_date)
        .order("created_at");

      siblingReports = (siblings ?? []).map((s) => {
        const proc = Array.isArray(s.processes) ? s.processes[0] : s.processes;
        return {
          id: s.id as string,
          progress_rate: s.progress_rate as number,
          processes: proc as { id: string; name: string; category: string } | null,
        };
      });
    }
  }

  // 工程ごとの進捗率リスト（報告時の値を使用）
  const processProgressList = siblingReports.length > 0
    ? siblingReports.map((s) => ({
        id: s.id,
        name: s.processes?.name ?? WORK_PROCESS_LABELS[raw.work_process] ?? "工程未設定",
        progressRate: s.progress_rate ?? 0,
        isCurrent: s.id === id,
      }))
    : [{
        id: raw.id,
        name: WORK_PROCESS_LABELS[raw.work_process] ?? raw.work_process,
        progressRate: raw.progress_rate ?? 0,
        isCurrent: true,
      }];

  const { data: photos } = await supabase.from("report_photos").select("id, storage_path, photo_type, caption, media_type").eq("report_id", id).order("created_at", { ascending: true });
  const { data: materials } = await supabase
    .from("report_materials")
    .select("material_name, quantity, unit")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  const photosWithUrls = await Promise.all(
    ((photos as ReportPhoto[] | null) ?? []).map(async (p) => {
      const { data } = await supabase.storage.from("report-photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? "" };
    })
  );

  const processLabel = processProgressList.map((p) => p.name).join("、");
  const siteName = sites?.name ?? "不明な現場";
  const status = raw.approval_status ?? "draft";
  const { Icon: SIcon, color: sColor } = statusIcon(status);
  const statusLabel = APPROVAL_STATUS_LABELS[status] ?? status;

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors w-fit min-h-[44px]">
          <ArrowLeft size={14} /> 報告一覧
        </Link>
        <Link
          href={`/reports/${raw.id}/print`}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors min-h-[44px]"
        >
          <Printer size={14} /> PDF / 印刷
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <SIcon size={16} className={sColor} />
          <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
            status === 'submitted' ? 'bg-blue-50 text-blue-400' :
            status === 'approved' ? 'bg-emerald-50 text-emerald-400' :
            status === 'client_confirmed' ? 'bg-cyan-50 text-[#0EA5E9]' :
            status === 'rejected' ? 'bg-red-50 text-red-400' :
            'bg-gray-100 text-gray-400'
          }`}>{statusLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[24px] font-bold text-gray-900">{siteName}</h1>
          {(raw.reporter_id === user.id) && (
            <Link href={`/reports/${raw.id}/edit`} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 min-h-[36px] text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">
              <Edit3 size={14} />編集
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-[13px] text-gray-400 flex-wrap mt-1.5">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} />{formatDate(raw.report_date)}</span>
          <span className="flex items-center gap-1.5"><HardHat size={14} />{processLabel}</span>
          {reporterName && (<span className="flex items-center gap-1.5"><Users size={14} />報告者: {reporterName}</span>)}
        </div>
      </div>

      {raw.rejection_comment && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-1.5 mb-2"><AlertTriangle size={14} className="text-red-400" /><span className="text-[13px] font-semibold text-red-400">差戻し理由</span></div>
          <p className="text-[14px] text-gray-600 whitespace-pre-wrap leading-relaxed">{raw.rejection_comment}</p>
        </div>
      )}

      <div className="mb-8 p-5 rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-gray-400" />
          <span className="text-[13px] text-gray-400">工程進捗（担当者見込み）</span>
        </div>
        <div className="space-y-3">
          {processProgressList.map((proc) => (
            <div key={proc.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[13px] font-medium ${proc.isCurrent ? "text-gray-700" : "text-gray-500"}`}>
                  {proc.name}
                </span>
                <span className={`text-[18px] font-bold ${progressText(proc.progressRate)}`}>{proc.progressRate}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${progressColor(proc.progressRate)} transition-all duration-500`} style={{ width: `${proc.progressRate}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {raw.weather && (
          <div className="p-4 rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center gap-1.5 mb-2"><Cloud size={14} className="text-[#0EA5E9]/60" /><span className="text-[12px] text-gray-400 font-medium">天候</span></div>
            <span className="text-[15px] text-gray-700 font-medium">{
              ({ sunny: "晴れ", cloudy: "曇り", rainy: "雨", snowy: "雪" } as Record<string, string>)[raw.weather ?? ""] ?? raw.weather
            }</span>
          </div>
        )}
        {(raw.arrival_time || raw.departure_time) && (
          <div className="p-4 rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center gap-1.5 mb-2"><Clock size={14} className="text-[#0EA5E9]/60" /><span className="text-[12px] text-gray-400 font-medium">現場時間</span></div>
            <span className="text-[15px] text-gray-700 font-medium">{raw.arrival_time || "--:--"} 〜 {raw.departure_time || "--:--"}</span>
          </div>
        )}
      </div>

      {raw.work_content && (
        <div className="mb-8">
          <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">作業内容</h3>
          <div className="p-4 rounded-2xl border border-gray-200 bg-white"><p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">{raw.work_content}</p></div>
        </div>
      )}

      {raw.issues && (
        <div className="mb-8">
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="flex items-center gap-1.5 mb-2.5"><AlertTriangle size={14} className="text-red-400" /><span className="text-[12px] font-semibold text-red-400">報告記入欄</span></div>
            <p className="text-[14px] text-gray-600 whitespace-pre-wrap leading-relaxed">{raw.issues}</p>
          </div>
        </div>
      )}

      {materials && materials.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">材料・数量</h3>
          <div className="space-y-2">
            {materials.map((material, index) => (
              <div key={`material-${index}`} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <span className="text-[14px] font-medium text-gray-700">{material.material_name}</span>
                <span className="text-[14px] font-semibold text-[#0EA5E9]">
                  {material.quantity ?? "—"}{material.unit ?? ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {photosWithUrls.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">写真・動画 ({photosWithUrls.length})</h3>
          <PhotoGallery
            photos={photosWithUrls.map((p): PhotoItem => ({
              id: p.id,
              url: p.url,
              caption: p.caption,
              mediaType: p.media_type,
              label: p.photo_type ? (PHOTO_TYPE_LABELS[p.photo_type] ?? p.photo_type) : (p.media_type === "video" ? "動画" : "写真"),
            }))}
            columns={2}
            aspect="4/3"
          />
        </div>
      )}

      {status === "draft" && raw.reporter_id === user.id && (
        <div className="mb-8 p-5 rounded-2xl border border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-4"><FileText size={16} className="text-amber-500" /><span className="text-[14px] font-semibold text-amber-500">下書き</span></div>
          <p className="text-[13px] text-gray-500 mb-4">この報告は下書きです。編集して提出できます。</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/reports/${raw.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white min-h-[44px] px-4 text-[14px] font-medium text-amber-500 hover:bg-amber-50 transition-colors"><Edit3 size={16} />編集する</Link>
            <SubmitDraftButton reportId={raw.id} siblingIds={siblingReports.map((s) => s.id)} />
            <DeleteDraftButton reportId={raw.id} siblingIds={siblingReports.map((s) => s.id)} />
          </div>
        </div>
      )}

      {canApprove && ((status === "submitted" && (userRole === "admin" || userRole === "manager")) || (status === "approved" && userRole === "client")) && (
        <div className="mb-8 p-5 rounded-2xl border border-cyan-200 bg-cyan-50">
          <div className="flex items-center gap-2 mb-4"><Shield size={16} className="text-[#0EA5E9]" /><span className="text-[14px] font-semibold text-[#0EA5E9]">{userRole === "client" ? "確認アクション" : "承認アクション"}</span></div>
          <ApprovalButtons reportId={raw.id} userRole={userRole ?? ""} siteName={siteName} reportDate={raw.report_date} workContent={raw.work_content} />
        </div>
      )}

      {canResubmit && (
        <div className="mb-8 p-5 rounded-2xl border border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-4"><Shield size={16} className="text-amber-400" /><span className="text-[14px] font-semibold text-amber-400">再提出</span></div>
          <p className="text-[13px] text-gray-500 mb-4">差戻しされた報告を修正して再提出できます。</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/reports/${raw.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white min-h-[44px] px-4 text-[14px] font-medium text-amber-500 hover:bg-amber-50 transition-colors"><Edit3 size={16} />修正する</Link>
            <ResubmitButton reportId={raw.id} />
          </div>
        </div>
      )}

      {/* ── 操作履歴 ── */}
      <ActivityTimeline reportId={raw.id} />

      <div className="text-[11px] text-gray-300 mt-4 space-y-0.5">
        <p>提出日時: {new Date(raw.created_at).toLocaleString("ja-JP")}</p>
        {raw.approved_at && (
          <p>{raw.approval_status === "rejected" ? "差戻し" : "承認"}日時: {new Date(raw.approved_at).toLocaleString("ja-JP")}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 操作履歴タイムライン
// ---------------------------------------------------------------------------
const ACTION_LABELS: Record<ActivityAction, string> = {
  created: "作成",
  submitted: "提出",
  approved: "承認",
  rejected: "差し戻し",
  resubmitted: "再提出",
  revision_requested: "修正依頼",
  client_confirmed: "クライアント確認",
  edited: "編集",
  deleted: "削除",
  restored: "復元",
  uploaded: "アップロード",
  renamed: "リネーム",
  moved: "移動",
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-gray-400",
  submitted: "bg-blue-400",
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
  resubmitted: "bg-amber-400",
  revision_requested: "bg-orange-400",
  client_confirmed: "bg-cyan-400",
};

async function ActivityTimeline({ reportId }: { reportId: string }) {
  const result = await getActivityLogs({
    entityType: "daily_report",
    entityId: reportId,
    limit: 20,
  });

  if (!result.success || !result.logs || result.logs.length === 0) return null;

  return (
    <div className="mt-8 p-5 rounded-2xl border border-gray-200 bg-white">
      <h3 className="text-[13px] font-semibold text-gray-500 mb-4">操作履歴</h3>
      <div className="space-y-3">
        {result.logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTION_COLORS[log.action] ?? "bg-gray-300"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-medium text-gray-700">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-gray-400">
                  {log.actor_name ?? "不明"}
                </span>
                <span className="text-gray-300 ml-auto shrink-0">
                  {new Date(log.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {log.detail && typeof (log.detail as Record<string, unknown>).reason === "string" ? (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  理由: {(log.detail as Record<string, string>).reason}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
