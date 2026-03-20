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

  // 管理者権限の確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "manager") {
    return { success: false, error: "管理者または現場管理者の権限が必要です" };
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
    edited_by_admin: true,
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
