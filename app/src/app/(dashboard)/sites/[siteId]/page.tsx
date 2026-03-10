import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { WORK_PROCESS_LABELS, getProgressColorClasses } from "@/lib/constants";
import type { Process, Site } from "@/lib/types";
import { SetupCheckList } from "@/components/sites/SetupCheckList";
import { DocumentManager } from "@/components/sites/DocumentManager";
import { MaterialManager } from "@/components/sites/MaterialManager";
import { EditSiteForm } from "./EditSiteForm";

interface PageProps { params: Promise<{ siteId: string }> }

function formatDate(d: string | null): string {
  if (!d) return "未設定";
  return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function getPeriodLabel(s: string | null, e: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!s) return { label: "未定", color: "text-white/30", bg: "bg-white/[0.06]" };
  if (today < new Date(s)) return { label: "着工前", color: "text-blue-400", bg: "bg-blue-500/10" };
  if (e && today > new Date(e)) return { label: "完了", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  return { label: "施工中", color: "text-[#00D9FF]", bg: "bg-[#00D9FF]/10" };
}

export default async function SiteDetailPage({ params }: PageProps) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site, error } = await supabase
    .from("sites")
    .select("id, name, address, start_date, end_date, has_blueprint, has_specification, has_purchase_order, has_schedule, is_monitor, created_at")
    .eq("id", siteId).single();

  if (error || !site) { console.error("Site fetch error:", error); notFound(); }

  const { count: reportCount } = await supabase
    .from("daily_reports").select("*", { count: "exact", head: true }).eq("site_id", siteId);

  const { data: processes } = await supabase
    .from("processes").select("*").eq("site_id", siteId).order("category").order("name");

  const processList = (processes as Process[] | null) ?? [];
  const groupedProcesses = processList.reduce<Record<string, Process[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const s = site as unknown as Site;
  const period = getPeriodLabel(s.start_date, s.end_date);

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Back */}
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-[13px] text-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors mb-6 w-fit min-h-[44px]">
        <ArrowLeft size={14} /> 現場一覧
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <h1 className="text-[24px] font-bold text-white/95">{s.name}</h1>
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${period.bg} ${period.color}`}>{period.label}</span>
        </div>
        {s.address && (
          <p className="text-[13px] text-white/40 flex items-center gap-1.5 mb-2">
            <MapPin size={13} /> {s.address}
          </p>
        )}
        <div className="flex items-center gap-4 text-[13px] text-white/35">
          <span className="flex items-center gap-1.5"><CalendarDays size={13} />{formatDate(s.start_date)} ~ {formatDate(s.end_date)}</span>
          <span className="flex items-center gap-1.5"><FileText size={13} />{reportCount ?? 0}件の報告</span>
        </div>
      </div>

      {/* Edit/Delete */}
      <div className="mb-8">
        <EditSiteForm site={{ id: s.id, name: s.name, address: s.address, start_date: s.start_date, end_date: s.end_date }} />
      </div>

      {/* Processes */}
      {processList.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-3">
            工程 ({processList.length})
          </h2>
          <div className="space-y-4">
            {Object.entries(groupedProcesses).map(([category, procs]) => (
              <div key={category}>
                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">
                  {WORK_PROCESS_LABELS[category] ?? category}
                </p>
                <div className="space-y-1.5">
                  {procs.map((proc) => {
                    const c = getProgressColorClasses(proc.progress_rate);
                    return (
                      <div key={proc.id} className="flex items-center gap-3 py-3 px-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[13px] text-white/75 truncate font-medium">{proc.name}</span>
                            {proc.status === "completed" ? (
                              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            ) : (
                              <Loader2 size={13} className="text-[#00D9FF] shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${c.bg}`} style={{ width: `${proc.progress_rate}%` }} />
                            </div>
                            <span className={`text-[11px] font-semibold ${c.text} w-8 text-right`}>{proc.progress_rate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Check */}
      <div className="mb-6"><SetupCheckList site={s} /></div>

      {/* Materials */}
      <div className="mb-6"><MaterialManager siteId={siteId} /></div>

      {/* Documents */}
      <div className="mb-6"><DocumentManager siteId={siteId} /></div>

      {/* Action links */}
      <div className="space-y-2.5 mb-8">
        <Link href={`/sites/${siteId}/reports`} className="group flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors active:bg-white/[0.05]">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00D9FF]/10 shrink-0">
            <FileText size={18} className="text-[#00D9FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-white/80 font-semibold">報告一覧</p>
            <p className="text-[12px] text-white/35">{reportCount ?? 0}件の報告</p>
          </div>
          <ArrowRight size={16} className="text-white/15 group-hover:text-white/30 transition-colors" />
        </Link>
        <Link href={`/reports/new?siteId=${siteId}`} className="group flex items-center gap-4 p-4 rounded-2xl bg-[#00D9FF]/[0.06] border border-[#00D9FF]/15 hover:bg-[#00D9FF]/[0.1] transition-colors active:bg-[#00D9FF]/[0.12]">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00D9FF]/15 shrink-0">
            <Plus size={18} className="text-[#00D9FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-white/85 font-semibold">新規報告を作成</p>
            <p className="text-[12px] text-white/35">この現場の作業報告を追加</p>
          </div>
          <ArrowRight size={16} className="text-white/15 group-hover:text-white/30 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
