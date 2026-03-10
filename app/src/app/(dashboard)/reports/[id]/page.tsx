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
  Camera,
  FileText,
  Video,
  CheckCircle2,
  XCircle,
  Shield,
  Edit3,
  Printer,
  StickyNote,
} from "lucide-react";
import { ApprovalButtons } from "./approval-buttons";

interface SiteData { name: string; address: string | null }
interface ProcessData { id: string; category: string; name: string; progress_rate: number; status: string }
interface ReportDetailRaw {
  id: string; report_date: string; work_process: string; work_content: string;
  workers: string[] | null; progress_rate: number; weather: string | null;
  work_hours: number | null; issues: string | null; created_at: string;
  approval_status: string; rejection_reason: string | null;
  admin_notes: string | null; edited_by_admin: boolean | null;
  sites: SiteData | SiteData[] | null; processes: ProcessData | ProcessData[] | null;
}
interface ReportPhoto { id: string; storage_path: string; photo_type: string | null; caption: string | null; media_type: string | null }
interface PageProps { params: Promise<{ id: string }> }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function progressColor(r: number) {
  if (r >= 80) return "bg-emerald-500";
  if (r >= 50) return "bg-[#00D9FF]";
  return "bg-red-500";
}

function progressText(r: number) {
  if (r >= 80) return "text-emerald-400";
  if (r >= 50) return "text-[#00D9FF]";
  return "text-red-400";
}

function statusIcon(s: string) {
  const map: Record<string, { Icon: React.ElementType; color: string }> = {
    submitted: { Icon: Clock, color: "text-blue-400" },
    admin_approved: { Icon: CheckCircle2, color: "text-emerald-400" },
    orderer_confirmed: { Icon: CheckCircle2, color: "text-[#00D9FF]" },
    rejected: { Icon: XCircle, color: "text-red-400" },
    draft: { Icon: FileText, color: "text-white/30" },
  };
  return map[s] ?? map.draft;
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("daily_reports")
    .select(`id, report_date, work_process, work_content, workers, progress_rate, weather, work_hours, issues, created_at, approval_status, rejection_reason, admin_notes, edited_by_admin, sites(name, address), processes(id, category, name, progress_rate, status)`)
    .eq("id", id).single();

  if (reportError || !report) { console.error("Report fetch error:", reportError); notFound(); }

  const raw = report as ReportDetailRaw;
  const { data: { user } } = await supabase.auth.getUser();
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    userRole = profile?.role ?? null;
  }
  const canApprove = userRole === "admin" || userRole === "orderer";

  const sites = Array.isArray(raw.sites) ? raw.sites[0] ?? null : raw.sites;
  const process = Array.isArray(raw.processes) ? raw.processes[0] ?? null : raw.processes;

  const { data: photos } = await supabase
    .from("report_photos").select("id, storage_path, photo_type, caption, media_type")
    .eq("report_id", id).order("created_at", { ascending: true });

  const photosWithUrls = await Promise.all(
    ((photos as ReportPhoto[] | null) ?? []).map(async (p) => {
      const { data } = await supabase.storage.from("report-photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? "" };
    })
  );

  const rate = raw.progress_rate ?? 0;
  const processLabel = process?.name ?? WORK_PROCESS_LABELS[raw.work_process] ?? raw.work_process;
  const siteName = sites?.name ?? "不明な現場";
  const status = raw.approval_status ?? "draft";
  const { Icon: SIcon, color: sColor } = statusIcon(status);
  const statusLabel = APPROVAL_STATUS_LABELS[status] ?? status;

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Back */}
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors mb-6 w-fit min-h-[44px]">
        <ArrowLeft size={14} /> 報告一覧
      </Link>

      {/* Title section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <SIcon size={16} className={sColor} />
          <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
            status === 'submitted' ? 'bg-blue-500/10 text-blue-400' :
            status === 'admin_approved' ? 'bg-emerald-500/10 text-emerald-400' :
            status === 'orderer_confirmed' ? 'bg-[#00D9FF]/10 text-[#00D9FF]' :
            status === 'rejected' ? 'bg-red-500/10 text-red-400' :
            'bg-white/[0.06] text-white/40'
          }`}>{statusLabel}</span>
        </div>
        <h1 className="text-[24px] font-bold text-white/95 mb-1.5">{siteName}</h1>
        <div className="flex items-center gap-4 text-[13px] text-white/40">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} />{formatDate(raw.report_date)}</span>
          <span className="flex items-center gap-1.5"><HardHat size={14} />{processLabel}</span>
        </div>
      </div>

      {/* Rejection reason */}
      {raw.rejection_reason && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/[0.06] border border-red-500/15">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[13px] font-semibold text-red-400">差戻し理由</span>
          </div>
          <p className="text-[14px] text-white/70 whitespace-pre-wrap leading-relaxed">{raw.rejection_reason}</p>
        </div>
      )}

      {/* Progress */}
      <div className="mb-8 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-white/45 flex items-center gap-2"><TrendingUp size={15} />進捗率</span>
          <span className={`text-[22px] font-bold ${progressText(rate)}`}>{rate}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full ${progressColor(rate)} transition-all duration-500`} style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {raw.workers && raw.workers.length > 0 && (
          <div className="col-span-2 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Users size={14} className="text-[#00D9FF]/60" />
              <span className="text-[12px] text-white/40 font-medium">作業者</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {raw.workers.map((w, i) => (
                <span key={i} className="text-[12px] bg-white/[0.06] px-2.5 py-1 rounded-lg text-white/65">{w}</span>
              ))}
            </div>
          </div>
        )}
        {raw.weather && (
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-2">
              <Cloud size={14} className="text-[#00D9FF]/60" />
              <span className="text-[12px] text-white/40 font-medium">天候</span>
            </div>
            <span className="text-[15px] text-white/75 font-medium">{raw.weather}</span>
          </div>
        )}
        {raw.work_hours != null && (
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={14} className="text-[#00D9FF]/60" />
              <span className="text-[12px] text-white/40 font-medium">作業時間</span>
            </div>
            <span className="text-[15px] text-white/75 font-medium">{raw.work_hours}時間</span>
          </div>
        )}
      </div>

      {/* Work content */}
      {raw.work_content && (
        <div className="mb-8">
          <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-3">作業内容</h3>
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[14px] text-white/75 leading-relaxed whitespace-pre-wrap">{raw.work_content}</p>
          </div>
        </div>
      )}

      {/* Issues */}
      {raw.issues && (
        <div className="mb-8">
          <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/10">
            <div className="flex items-center gap-1.5 mb-2.5">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-[12px] font-semibold text-red-400">課題・懸念事項</span>
            </div>
            <p className="text-[14px] text-white/70 whitespace-pre-wrap leading-relaxed">{raw.issues}</p>
          </div>
        </div>
      )}

      {/* Photos */}
      {photosWithUrls.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-3">
            写真・動画 ({photosWithUrls.length})
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {photosWithUrls.map((p) => {
              const isVideo = p.media_type === "video";
              const typeLabel = p.photo_type ? (PHOTO_TYPE_LABELS[p.photo_type] ?? p.photo_type) : (isVideo ? "動画" : "写真");
              return (
                <div key={p.id} className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
                  {isVideo ? (
                    <video src={p.url} controls className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.url} alt={p.caption || typeLabel} className="w-full aspect-[4/3] object-cover" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-[11px] text-white/80 flex items-center gap-1">
                      {isVideo ? <Video size={11} /> : <Camera size={11} />}
                      {typeLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approval actions */}
      {canApprove && status === "submitted" && (
        <div className="mb-8 p-5 rounded-2xl border border-[#00D9FF]/20 bg-[#00D9FF]/[0.04]">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-[#00D9FF]" />
            <span className="text-[14px] font-semibold text-[#00D9FF]">承認アクション</span>
          </div>
          <ApprovalButtons reportId={raw.id} />
        </div>
      )}

      {/* Admin Notes */}
      {raw.admin_notes && (
        <div className="mb-8">
          <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/10">
            <div className="flex items-center gap-1.5 mb-2.5">
              <StickyNote size={14} className="text-amber-400" />
              <span className="text-[12px] font-semibold text-amber-400">管理者メモ</span>
            </div>
            <p className="text-[14px] text-white/70 whitespace-pre-wrap leading-relaxed">
              {raw.admin_notes}
            </p>
          </div>
        </div>
      )}

      {/* Admin action buttons */}
      {userRole === "admin" && (
        <div className="mb-8 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/reports/${raw.id}/edit`}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] min-h-[44px] px-4 text-[14px] font-medium text-amber-400 hover:bg-amber-500/[0.12] transition-colors"
          >
            <Edit3 size={16} />
            編集する
          </Link>
          <Link
            href={`/reports/${raw.id}/print`}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#00D9FF]/20 bg-[#00D9FF]/[0.06] min-h-[44px] px-4 text-[14px] font-medium text-[#00D9FF] hover:bg-[#00D9FF]/[0.12] transition-colors"
          >
            <Printer size={16} />
            PDF出力
          </Link>
        </div>
      )}

      {/* PDF button for orderer */}
      {userRole === "orderer" && (
        <div className="mb-8">
          <Link
            href={`/reports/${raw.id}/print`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00D9FF]/20 bg-[#00D9FF]/[0.06] min-h-[44px] px-5 text-[14px] font-medium text-[#00D9FF] hover:bg-[#00D9FF]/[0.12] transition-colors"
          >
            <Printer size={16} />
            PDF出力
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="text-[11px] text-white/20 mt-4">
        <p>作成: {new Date(raw.created_at).toLocaleString("ja-JP")}</p>
        {raw.edited_by_admin && (
          <p className="mt-1 text-amber-400/40">※ 管理者による編集あり</p>
        )}
      </div>
    </div>
  );
}
