"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyReportRejected } from "@/lib/email";
import { canAccessReport } from "@/lib/siteAccess";

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
  const { error: updateError } = await supabase
    .from("daily_reports")
    .update({
      approval_status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: `承認エラー: ${updateError.message}` };
  }

  // キャッシュを無効化
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);

  // 注: 個別の職人報告承認時にはクライアントへ通知しない
  // クライアントへはマネージャーが二次報告（サマリー）を提出した時点で通知する

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
  const { error: updateError } = await supabase
    .from("daily_reports")
    .update({
      approval_status: "rejected",
      rejection_comment: reason || null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: `差戻しエラー: ${updateError.message}` };
  }

  // キャッシュを無効化
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);

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

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);

  return { success: true };
}
