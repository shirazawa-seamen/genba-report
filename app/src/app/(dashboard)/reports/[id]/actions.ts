"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyReportApproved, notifyReportRejected } from "@/lib/email";

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

  if (profile.role !== "admin" && profile.role !== "orderer") {
    return { success: false, error: "承認権限がありません" };
  }

  // ロールに応じた承認ステータスを決定
  const newStatus = profile.role === "admin" ? "admin_approved" : "orderer_confirmed";

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

  // 管理者承認時 → 元請けへメール通知
  if (newStatus === "admin_approved") {
    try {
      const adminClient = createAdminClient();
      const { data: report } = await supabase
        .from("daily_reports")
        .select("report_date, sites(name)")
        .eq("id", reportId)
        .single();

      const { data: ordererProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "orderer");

      if (ordererProfiles && ordererProfiles.length > 0 && report) {
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const ordererIds = new Set(ordererProfiles.map((p) => p.id));
        const ordererEmails = (authUsers?.users ?? [])
          .filter((u) => ordererIds.has(u.id) && u.email)
          .map((u) => u.email!);

        const siteName = (report.sites as { name?: string } | null)?.name ?? "不明な現場";

        notifyReportApproved({
          siteName,
          reportDate: report.report_date,
          reportId,
          ordererEmails,
        }).catch((err) => console.error("[Email] Notification error:", err));
      }
    } catch (err) {
      console.error("[Email] Failed to send approval notification:", err);
    }
  }

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

  if (profile.role !== "admin" && profile.role !== "orderer") {
    return { success: false, error: "差戻し権限がありません" };
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
