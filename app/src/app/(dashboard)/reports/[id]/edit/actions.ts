"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  if (profile?.role !== "admin") {
    return { success: false, error: "管理者権限が必要です" };
  }

  const workContent = formData.get("work_content") as string;
  const workers = formData.get("workers") as string;
  const progressRate = formData.get("progress_rate") as string;
  const weather = formData.get("weather") as string;
  const workHours = formData.get("work_hours") as string;
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
  if (workHours !== null)
    updateData.work_hours = workHours ? parseFloat(workHours) : null;
  if (issues !== null) updateData.issues = issues || null;
  if (adminNotes !== null) updateData.admin_notes = adminNotes || null;

  const { error: updateError } = await supabase
    .from("daily_reports")
    .update(updateData)
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: `更新エラー: ${updateError.message}` };
  }

  // 工程の進捗率も更新
  if (progressRate) {
    const { data: report } = await supabase
      .from("daily_reports")
      .select("process_id")
      .eq("id", reportId)
      .single();

    if (report?.process_id) {
      const rate = parseInt(progressRate, 10);
      const newStatus = rate >= 100 ? "completed" : "in_progress";
      await supabase
        .from("processes")
        .update({ progress_rate: rate, status: newStatus })
        .eq("id", report.process_id);
    }
  }

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);

  return { success: true };
}
