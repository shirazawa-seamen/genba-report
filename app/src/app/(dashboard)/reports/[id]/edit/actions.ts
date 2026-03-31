"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// ---------------------------------------------------------------------------
// 写真のキャプション・種別更新
// ---------------------------------------------------------------------------
export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインが必要です" };

  // 写真の報告者を確認
  const { data: photo } = await supabase
    .from("report_photos")
    .select("report_id, daily_reports!inner(reporter_id)")
    .eq("id", photoId)
    .single();

  if (!photo) return { success: false, error: "写真が見つかりません" };

  const reporterId = (photo.daily_reports as unknown as { reporter_id: string })?.reporter_id;
  if (reporterId !== user.id) {
    return { success: false, error: "この写真を編集する権限がありません" };
  }

  const { error } = await supabase
    .from("report_photos")
    .update({ caption: caption || null })
    .eq("id", photoId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// 写真の種別更新
// ---------------------------------------------------------------------------
export async function updatePhotoType(
  photoId: string,
  photoType: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインが必要です" };

  const { data: photo } = await supabase
    .from("report_photos")
    .select("report_id, daily_reports!inner(reporter_id)")
    .eq("id", photoId)
    .single();

  if (!photo) return { success: false, error: "写真が見つかりません" };

  const reporterId = (photo.daily_reports as unknown as { reporter_id: string })?.reporter_id;
  if (reporterId !== user.id) {
    return { success: false, error: "この写真を編集する権限がありません" };
  }

  const VALID_TYPES = ["before", "during", "after", "corner_ne", "corner_nw", "corner_se", "corner_sw"];
  if (!VALID_TYPES.includes(photoType)) {
    return { success: false, error: "無効な写真種別です" };
  }

  const { error } = await supabase
    .from("report_photos")
    .update({ photo_type: photoType })
    .eq("id", photoId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// 写真の削除
// ---------------------------------------------------------------------------
export async function deleteReportPhoto(
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインが必要です" };

  // 写真情報と報告者を取得
  const { data: photo } = await supabase
    .from("report_photos")
    .select("id, storage_path, report_id, daily_reports!inner(reporter_id)")
    .eq("id", photoId)
    .single();

  if (!photo) return { success: false, error: "写真が見つかりません" };

  const reporterId = (photo.daily_reports as unknown as { reporter_id: string })?.reporter_id;
  if (reporterId !== user.id) {
    return { success: false, error: "この写真を削除する権限がありません" };
  }

  // Storageからファイル削除
  const { error: storageError } = await supabase.storage
    .from("report-photos")
    .remove([photo.storage_path]);

  if (storageError) {
    console.error("[deleteReportPhoto] Storage error:", storageError);
  }

  // DBレコード削除
  const { error: dbError } = await supabase
    .from("report_photos")
    .delete()
    .eq("id", photoId);

  if (dbError) return { success: false, error: dbError.message };

  revalidatePath(`/reports/${photo.report_id}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 写真の追加（編集ページ用サーバーアクション）
// ---------------------------------------------------------------------------
export async function addReportPhoto(
  reportId: string,
  formData: FormData
): Promise<{ success: boolean; photoId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインが必要です" };

  // 報告者確認
  const { data: report } = await supabase
    .from("daily_reports")
    .select("reporter_id")
    .eq("id", reportId)
    .single();

  if (!report) return { success: false, error: "報告が見つかりません" };
  if (report.reporter_id !== user.id) {
    return { success: false, error: "この報告に写真を追加する権限がありません" };
  }

  const file = formData.get("photo") as File;
  const photoType = (formData.get("photoType") as string) || "during";
  const caption = (formData.get("caption") as string) || null;

  if (!file || file.size === 0) return { success: false, error: "ファイルが選択されていません" };

  const mediaType = file.type.startsWith("video/") ? "video" : "photo";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `reports/${reportId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("report-photos")
    .upload(storagePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) return { success: false, error: `アップロードエラー: ${uploadError.message}` };

  const VALID_TYPES = ["before", "during", "after", "corner_ne", "corner_nw", "corner_se", "corner_sw"];
  const validPhotoType = VALID_TYPES.includes(photoType) ? photoType : "during";

  const { data: newPhoto, error: dbError } = await supabase
    .from("report_photos")
    .insert({
      report_id: reportId,
      storage_path: storagePath,
      photo_type: validPhotoType,
      media_type: mediaType,
      caption,
    })
    .select("id")
    .single();

  if (dbError) {
    await supabase.storage.from("report-photos").remove([storagePath]);
    return { success: false, error: `DB保存エラー: ${dbError.message}` };
  }

  revalidatePath(`/reports/${reportId}`);
  return { success: true, photoId: newPhoto?.id };
}
