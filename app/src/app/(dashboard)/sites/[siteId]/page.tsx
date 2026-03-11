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
  Building2,
} from "lucide-react";
import type { Process, Site } from "@/lib/types";
import { SetupCheckList } from "@/components/sites/SetupCheckList";
import { DocumentManager } from "@/components/sites/DocumentManager";
import { MaterialManager } from "@/components/sites/MaterialManager";
import { SiteMemberManager } from "@/components/sites/SiteMemberManager";
import { ProcessManager } from "@/components/sites/ProcessManager";
import { CompleteSiteButton } from "./CompleteSiteButton";
import { listProcessCategories } from "@/lib/processCategories";
import { listProcessTemplates } from "@/lib/processTemplates";
import { SiteDetailEditSession } from "./SiteDetailEditSession";
import { InviteSiteMembersButton } from "./InviteSiteMembersButton";

interface PageProps { params: Promise<{ siteId: string }> }
interface SearchParams {
  edit?: string;
}

function formatDate(d: string | null): string {
  if (!d) return "未設定";
  return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function getPeriodLabel(s: string | null, e: string | null, status: string) {
  if (status === "completed") return { label: "完了", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!s) return { label: "未定", color: "text-gray-400", bg: "bg-gray-100" };
  if (today < new Date(s)) return { label: "着工前", color: "text-blue-400", bg: "bg-blue-500/10" };
  if (e && today > new Date(e)) return { label: "完了", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  return { label: "施工中", color: "text-[#0EA5E9]", bg: "bg-cyan-50" };
}

export default async function SiteDetailPage({
  params,
  searchParams,
}: PageProps & { searchParams: Promise<SearchParams> }) {
  const { siteId } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  // client_name, status カラムが未追加の場合に備え、まず含めて取得 → 失敗したらなしで取得
  let site: Record<string, unknown> | null = null;
  let error: unknown = null;
  {
    const res = await supabase
      .from("sites")
      .select("id, name, site_number, address, client_name, start_date, end_date, status, site_color, has_blueprint, has_specification, has_purchase_order, has_schedule, is_monitor, created_at")
      .eq("id", siteId).single();
    if (res.error?.message?.includes("client_name") || res.error?.message?.includes("site_color")) {
      const fallback = await supabase
        .from("sites")
        .select("id, name, site_number, address, start_date, end_date, status, has_blueprint, has_specification, has_purchase_order, has_schedule, is_monitor, created_at")
        .eq("id", siteId).single();
      site = fallback.data as Record<string, unknown> | null;
      error = fallback.error;
    } else {
      site = res.data as Record<string, unknown> | null;
      error = res.error;
    }
  }

  if (error || !site) { console.error("Site fetch error:", error); notFound(); }

  // ユーザーロール取得
  const { data: { user } } = await supabase.auth.getUser();
  let userRole = "worker_internal";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    userRole = profile?.role ?? "worker_internal";
  }

  const { count: reportCount } = await supabase
    .from("daily_reports").select("*", { count: "exact", head: true }).eq("site_id", siteId);

  const { data: processes } = await supabase
    .from("processes").select("*").eq("site_id", siteId).order("order_index");

  const { data: workPeriods } = await supabase
    .from("site_work_periods")
    .select("id, start_date, end_date")
    .eq("site_id", siteId)
    .order("start_date");

  const { data: siteMembers } = await supabase
    .from("site_members")
    .select("id, user_id, created_at")
    .eq("site_id", siteId)
    .order("created_at");

  const processList = (processes as Process[] | null) ?? [];
  const periodList = (workPeriods ?? []).map((period) => ({
    id: period.id,
    startDate: period.start_date,
    endDate: period.end_date,
  }));
  const memberUserIds = (siteMembers ?? []).map((member) => member.user_id);
  const { data: memberProfiles } = memberUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", memberUserIds)
    : { data: [] };
  const memberProfileMap = new Map(
    (memberProfiles ?? []).map((profile) => [profile.id, profile])
  );
  const memberList = (siteMembers ?? []).map((member) => {
    const profile = memberProfileMap.get(member.user_id);
    return {
      id: member.id,
      userId: member.user_id,
      name: profile?.full_name || "不明",
      role: profile?.role || "worker_external",
      createdAt: member.created_at,
    };
  });
  const [processTemplates, processCategories] = await Promise.all([
    listProcessTemplates(),
    listProcessCategories(),
  ]);

  // 全体進捗率
  const overallProgress = processList.length > 0
    ? Math.round(processList.reduce((sum, p) => sum + p.progress_rate, 0) / processList.length)
    : null;

  const s = site as unknown as Site & { status?: string };
  const siteStatus = (site.status as string) ?? "active";
  const isCompleted = siteStatus === "completed";
  const period = getPeriodLabel(s.start_date, s.end_date, siteStatus);
  const canManage = userRole === "admin" || userRole === "manager";
  const isEditMode = canManage && edit === "1";

  return (
    <div className="flex-1 flex flex-col px-5 py-8 md:px-8 md:py-10 max-w-3xl w-full mx-auto">
      {/* Back */}
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]">
        <ArrowLeft size={14} /> 現場一覧
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-bold text-gray-900">{s.name}</h1>
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${period.bg} ${period.color}`}>{period.label}</span>
          </div>
          {canManage && !isEditMode ? <InviteSiteMembersButton siteId={siteId} /> : null}
        </div>
        {s.site_number && (
          <p className="text-[12px] text-[#0EA5E9]/60 font-mono mb-1">現場ID：{s.site_number}</p>
        )}
        {s.address && (
          <p className="text-[13px] text-gray-400 flex items-center gap-1.5 mb-1">
            <MapPin size={13} /> {s.address}
          </p>
        )}
        <div className="flex items-center gap-4 text-[13px] text-gray-400">
          <span className="flex items-center gap-1.5"><CalendarDays size={13} />{formatDate(s.start_date)} ~ {formatDate(s.end_date)}</span>
          <span className="flex items-center gap-1.5"><FileText size={13} />{reportCount ?? 0}件の報告</span>
        </div>
      </div>

      {/* Client Name Card */}
      {s.client_name && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Building2 size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">クライアント</p>
            <p className="text-[15px] font-bold text-gray-800">{s.client_name}</p>
          </div>
        </div>
      )}

      {!isEditMode && memberList.length > 0 ? (
        <div className="mb-8">
          <SiteMemberManager
            siteId={siteId}
            members={memberList}
            userRole={userRole}
          />
        </div>
      ) : null}

      {/* Overall Progress */}
      {!isEditMode && overallProgress !== null && (
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">全体進捗</h2>
            <span className={`text-[20px] font-bold ${
              overallProgress >= 80 ? "text-emerald-500" : overallProgress >= 50 ? "text-amber-500" : "text-red-400"
            }`}>{overallProgress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overallProgress >= 80 ? "bg-emerald-500" : overallProgress >= 50 ? "bg-amber-500" : "bg-red-400"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{processList.length}工程の平均進捗率</p>
        </div>
      )}

      {/* Edit/Delete */}
      {canManage && (
        <div className="mb-8 flex items-center gap-2 flex-wrap">
          {isEditMode ? (
            <>
              <Link
                href={`/sites/${siteId}`}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 transition-all"
              >
                編集をキャンセル
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/sites/${siteId}?edit=1`}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 transition-all"
              >
                編集
              </Link>
              <CompleteSiteButton siteId={siteId} isCompleted={isCompleted} />
            </>
          )}
        </div>
      )}

      {isEditMode ? (
        <SiteDetailEditSession
          siteId={siteId}
          initialSiteDraft={{
            name: s.name,
            siteNumber: s.site_number ?? "",
            address: s.address,
            clientName: s.client_name ?? "",
            startDate: s.start_date ?? "",
            endDate: s.end_date ?? "",
            siteColor: (site.site_color as string) ?? "#0EA5E9",
          }}
          initialChecks={{
            has_blueprint: s.has_blueprint,
            has_specification: s.has_specification,
            has_purchase_order: s.has_purchase_order,
            has_schedule: s.has_schedule,
            is_monitor: s.is_monitor,
          }}
          initialProcesses={processList.map((process) => ({
            id: process.id,
            category: process.category,
            name: process.name,
            orderIndex: process.order_index,
            progressRate: process.progress_rate,
            status: process.status,
            createdAt: process.created_at,
          }))}
          initialPeriods={periodList}
          initialMembers={memberList}
          processTemplates={processTemplates}
          processCategories={processCategories}
        />
      ) : (
        <>
          <div className="mb-8">
            <ProcessManager
              processes={processList.map((process) => ({
                id: process.id,
                category: process.category,
                name: process.name,
                orderIndex: process.order_index,
                progressRate: process.progress_rate,
                status: process.status,
                createdAt: process.created_at,
              }))}
              canManage={false}
              initialTemplates={processTemplates}
              categoryOptions={processCategories}
            />
          </div>

          <div className="mb-6">
            <SetupCheckList
              checks={{
                has_blueprint: s.has_blueprint,
                has_specification: s.has_specification,
                has_purchase_order: s.has_purchase_order,
                has_schedule: s.has_schedule,
                is_monitor: s.is_monitor,
              }}
            />
          </div>

          <div className="mb-6"><MaterialManager siteId={siteId} canManage={false} /></div>
          <div className="mb-6"><DocumentManager siteId={siteId} canManage={false} /></div>
        </>
      )}

      {/* Action links */}
      {!isEditMode && <div className="space-y-2.5 mb-8">
        <Link href={`/sites/${siteId}/reports`} className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors active:bg-gray-100">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-50 shrink-0">
            <FileText size={18} className="text-[#0EA5E9]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-gray-700 font-semibold">報告一覧</p>
            <p className="text-[12px] text-gray-400">{reportCount ?? 0}件の報告</p>
          </div>
          <ArrowRight size={16} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
        </Link>
        {!isCompleted && (
          <Link href={`/reports/new?siteId=${siteId}`} className="group flex items-center gap-4 p-4 rounded-2xl bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors active:bg-cyan-100">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 shrink-0">
              <Plus size={18} className="text-[#0EA5E9]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-gray-700 font-semibold">新規報告を作成</p>
              <p className="text-[12px] text-gray-400">この現場の作業報告を追加</p>
            </div>
            <ArrowRight size={16} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
          </Link>
        )}
      </div>}
    </div>
  );
}
