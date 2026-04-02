"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyReportRejected } from "@/lib/email";
import { canAccessReport } from "@/lib/siteAccess";
import { logActivity } from "@/lib/activity-log";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface ApprovalResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// 報告の承認
// ---------------------------------------------------------------------------
export async function approveReport(reportId: string): Promise<ApprovalResult> {
  const supabase = await createClient();

  // 認証ユーザーの取得
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // ユーザーのロールを確認（admin または orderer のみ承認可能）
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "ユーザー情報の取得に失敗しました" };
  }

  // クライアントは個別の職人報告を承認しない（サマリー経由で確認する）
  if (profile.role !== "admin" && profile.role !== "manager") {
    return { success: false, error: "承認権限がありません" };
  }

  // この報告のサイトにアクセス権があるか確認
  const hasAccess = await canAccessReport(user.id, reportId);
  if (!hasAccess) {
    return { success: false, error: "この報告にアクセスする権限がありません" };
  }

  // 承認ステータス
  const newStatus = "approved";

  // 報告のステータスを更新
  const { data: approvedRows, error: updateError } = await supabase
    .from("daily_reports")
    .update({
      approval_status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select("id, process_id, progress_rate");

  if (updateError) {
    return { success: false, error: `承認エラー: ${updateError.message}` };
  }

  if (!approvedRows || approvedRows.length === 0) {
    return { success: false, error: "更新対象の報告が見つかりませんでした（権限エラーの可能性）" };
  }

  // 承認した報告の進捗率をprocessesテーブルに反映
  for (const row of approvedRows) {
    if (row.process_id && row.progress_rate != null) {
      await supabase
        .from("processes")
        .update({ progress_rate: row.progress_rate })
        .eq("id", row.process_id);
    }
  }

  // キャッシュを無効化（ホーム・報告一覧・報告詳細・マネージャー画面すべて）
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/manager/reports");
  revalidatePath("/manager/reports");
  revalidatePath("/sites", "layout");

  // ログ記録
  const { data: reportForLog } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", reportId)
    .single();
  logActivity({
    entityType: "daily_report",
    entityId: reportId,
    siteId: reportForLog?.site_id,
    action: "approved",
    actorId: user.id,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// 報告の差戻し
// ---------------------------------------------------------------------------
export async function rejectReport(
  reportId: string,
  reason?: string
): Promise<ApprovalResult> {
  const supabase = await createClient();

  // 認証ユーザーの取得
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // ユーザーのロールを確認（admin または orderer のみ差戻し可能）
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "ユーザー情報の取得に失敗しました" };
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    return { success: false, error: "差戻し権限がありません" };
  }

  // この報告のサイトにアクセス権があるか確認
  const hasReportAccess = await canAccessReport(user.id, reportId);
  if (!hasReportAccess) {
    return { success: false, error: "この報告にアクセスする権限がありません" };
  }

  // 報告のステータスを更新
  const { data: updatedRows, error: updateError } = await supabase
    .from("daily_reports")
    .update({
      approval_status: "rejected",
      rejection_comment: reason || null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select("id");

  if (updateError) {
    return { success: false, error: `差戻しエラー: ${updateError.message}` };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "更新対象の報告が見つかりませんでした（権限エラーの可能性）" };
  }

  // キャッシュを無効化（ホーム・報告一覧・報告詳細・マネージャー画面すべて）
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/manager/reports");
  revalidatePath("/manager/reports");
  revalidatePath("/sites", "layout");

  // ログ記録
  const { data: rejectedReport } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", reportId)
    .single();
  logActivity({
    entityType: "daily_report",
    entityId: reportId,
    siteId: rejectedReport?.site_id,
    action: "rejected",
    actorId: user.id,
    detail: reason ? { reason } : null,
  });

  // 差戻し → 報告者へメール通知
  try {
    const adminClient = createAdminClient();
    const { data: report } = await supabase
      .from("daily_reports")
      .select("report_date, reporter_id, sites(name)")
      .eq("id", reportId)
      .single();

    if (report?.reporter_id) {
      const { data: authData } = await adminClient.auth.admin.getUserById(report.reporter_id);
      const reporterEmail = authData?.user?.email;

      if (reporterEmail) {
        const siteName = (report.sites as { name?: string } | null)?.name ?? "不明な現場";

        notifyReportRejected({
          siteName,
          reportDate: report.report_date,
          reportId,
          reporterEmail,
          rejectionReason: reason,
        }).catch((err) => console.error("[Email] Notification error:", err));
      }
    }
  } catch (err) {
    console.error("[Email] Failed to send rejection notification:", err);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// 現在のユーザーロールを取得
// ---------------------------------------------------------------------------
export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role ?? null;
}

// ---------------------------------------------------------------------------
// 報告の再提出（差戻し後に再送信）
// ---------------------------------------------------------------------------
export async function resubmitReport(reportId: string): Promise<ApprovalResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // ユーザーのロールを確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, error: "ユーザー情報の取得に失敗しました" };
  }

  // この報告のサイトにアクセス権があるか確認
  const hasResubmitAccess = await canAccessReport(user.id, reportId);
  if (!hasResubmitAccess) {
    return { success: false, error: "この報告にアクセスする権限がありません" };
  }

  // 報告のステータスを確認（rejectedのみ再提出可能）
  const { data: report } = await supabase
    .from("daily_reports")
    .select("approval_status, reporter_id")
    .eq("id", reportId)
    .single();

  if (!report || report.approval_status !== "rejected") {
    return { success: false, error: "差戻しされた報告のみ再提出できます" };
  }

  // 報告者本人、または admin/manager のみ再提出可能
  const isReporter = report.reporter_id === user.id;
  const isAdminOrManager = profile.role === "admin" || profile.role === "manager";
  if (!isReporter && !isAdminOrManager) {
    return { success: false, error: "再提出権限がありません" };
  }

  const { error: updateError } = await supabase
    .from("daily_reports")
    .update({
      approval_status: "submitted",
      rejection_comment: null,
      approved_by: null,
      approved_at: null,
    })
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: `再提出エラー: ${updateError.message}` };
  }

  // ログ記録
  const { data: resubmittedReport } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", reportId)
    .single();
  logActivity({
    entityType: "daily_report",
    entityId: reportId,
    siteId: resubmittedReport?.site_id,
    action: "resubmitted",
    actorId: user.id,
  });

  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/manager/reports");
  revalidatePath("/manager/reports");
  revalidatePath("/sites", "layout");

  return { success: true };
}

// ---------------------------------------------------------------------------
// 複数報告IDの写真を一括取得（signed URL付き）
// ---------------------------------------------------------------------------
export async function getReportPhotosForIds(reportIds: string[]) {
  if (reportIds.length === 0) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // process_idカラムがない場合のフォールバック
  let photos: Array<Record<string, unknown>> | null = null;
  const primaryResult = await supabase
    .from("report_photos")
    .select("id, report_id, storage_path, photo_type, caption, media_type, process_id, processes(name)")
    .in("report_id", reportIds)
    .order("created_at");

  if (primaryResult.error) {
    const fallbackResult = await supabase
      .from("report_photos")
      .select("id, report_id, storage_path, photo_type, caption, media_type")
      .in("report_id", reportIds)
      .order("created_at");
    photos = fallbackResult.data;
  } else {
    photos = primaryResult.data;
  }

  if (!photos || photos.length === 0) return [];

  const result = await Promise.all(
    photos.map(async (p) => {
      const { data } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(p.storage_path as string, 3600);
      const processName = (p.processes as unknown as { name?: string } | null)?.name ?? null;
      return {
        id: p.id as string,
        reportId: p.report_id as string,
        url: data?.signedUrl ?? "",
        caption: p.caption as string | null,
        mediaType: (p.media_type ?? "photo") as string,
        photoType: p.photo_type as string | null,
        processName,
      };
    })
  );

  return result;
}
