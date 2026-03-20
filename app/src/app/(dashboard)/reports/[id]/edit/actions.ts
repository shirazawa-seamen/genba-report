"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { canAccessReport } from "@/lib/siteAccess";

interface UpdateReportResult {
  success: boolean;
  error?: string;
}

export async function updateReport(
  reportId: string,
  formData: FormData
): Promise<UpdateReportResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdminOrManager = profile?.role === "admin" || profile?.role === "manager";

  // 報告の reporter_id を確認
  const { data: reportData } = await supabase
    .from("daily_reports")
    .select("reporter_id")
    .eq("id", reportId)
    .single();

  const isReporter = reportData?.reporter_id === user.id;

  // 管理者/マネージャー または 報告者本人のみ編集可能
  if (!isAdminOrManager && !isReporter) {
    return { success: false, error: "この報告を編集する権限がありません" };
  }

  // この報告のサイトにアクセス権があるか確認
  const hasAccess = await canAccessReport(user.id, reportId);
  if (!hasAccess) {
    return { success: false, error: "この報告にアクセスする権限がありません" };
  }

  const workContent = formData.get("work_content") as string;
  const workers = formData.get("workers") as string;
  const progressRate = formData.get("progress_rate") as string;
  const weather = formData.get("weather") as string;
  const arrivalTime = formData.get("arrival_time") as string;
  const departureTime = formData.get("departure_time") as string;
  const issues = formData.get("issues") as string;
  const adminNotes = formData.get("admin_notes") as string;

  const workersArray = workers
    ? workers
        .split(/[、,]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
    : undefined;

  const updateData: Record<string, unknown> = {
    edited_by_admin: isAdminOrManager,
  };

  if (workContent !== null) updateData.work_content = workContent;
  if (workersArray) updateData.workers = workersArray;
  if (progressRate) updateData.progress_rate = parseInt(progressRate, 10);
  if (weather !== null) updateData.weather = weather || null;
  if (arrivalTime !== null) updateData.arrival_time = arrivalTime || null;
  if (departureTime !== null) updateData.departure_time = departureTime || null;
  if (issues !== null) updateData.issues = issues || null;
  if (adminNotes !== null) updateData.admin_notes = adminNotes || null;

  const { error: updateError } = await supabase
    .from("daily_reports")
    .update(updateData)
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: `更新エラー: ${updateError.message}` };
  }

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);

  return { success: true };
}
