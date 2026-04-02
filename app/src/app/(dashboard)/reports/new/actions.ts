"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyReportSubmitted } from "@/lib/email";
import { syncReportPhotoToStorage } from "@/app/(dashboard)/storage/actions";
import { logActivity } from "@/lib/activity-log";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface CreateReportInput {
  siteName: string; // 既存（後方互換のため残す）
  siteId?: string; // 新規追加: 現場ID（ドロップダウンから選択時）
  reportDate: string;
  workDescription: string;
  workers: string;
  weather: string;
  arrivalTime: string;
  departureTime: string;
  issues: string;
  isDraft?: boolean; // 下書き保存の場合 true
  processes: Array<{
    processId: string;
    workProcess: string;
    progressRate: string;
    name?: string;
  }>;
}

interface CreateReportResult {
  success: boolean;
  reportId?: string;
  reportIds?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// 現場の取得または作成（後方互換のため残す）
// ---------------------------------------------------------------------------
async function getOrCreateSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteName: string
): Promise<{ id: string } | { error: string }> {
  // まず既存の現場を検索
  const { data: existingSite, error: searchError } = await supabase
    .from("sites")
    .select("id")
    .eq("name", siteName)
    .maybeSingle();

  if (searchError) {
    return { error: `現場検索エラー: ${searchError.message}` };
  }

  if (existingSite) {
    return { id: existingSite.id };
  }

  // 現場が存在しない場合は新規作成
  const { data: newSite, error: insertError } = await supabase
    .from("sites")
    .insert({
      name: siteName,
      address: "住所未設定", // デフォルト値
    })
    .select("id")
    .single();

  if (insertError) {
    // 権限がない場合はRLSエラーになる可能性
    if (insertError.code === "42501") {
      return { error: "現場の新規登録権限がありません。管理者に現場登録を依頼してください。" };
    }
    return { error: `現場作成エラー: ${insertError.message}` };
  }

  return { id: newSite.id };
}

// ---------------------------------------------------------------------------
// 現場一覧の取得（ドロップダウン用）
// ---------------------------------------------------------------------------
export async function fetchSites() {
  const supabase = await createClient();

  // ユーザーロール取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isWorker = profile?.role === "worker_internal" || profile?.role === "worker_external";

  if (isWorker) {
    // ワーカー（社内・外注）: 招待された稼働中の現場のみ
    const { data, error } = await supabase
      .from("site_members")
      .select("sites!inner(id, name, status)")
      .eq("user_id", user.id)
      .eq("sites.status", "active");
    if (error) throw error;
    return (data ?? [])
      .map((m) => m.sites as unknown as { id: string; name: string })
      .filter(Boolean);
  }

  // 管理者・マネージャー: 稼働中の現場すべて
  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// 指定現場の工程一覧を取得（カテゴリでグルーピング）
// ---------------------------------------------------------------------------
export async function fetchProcesses(siteId: string) {
  const supabase = await createClient();
  let data: {
    id: string;
    category: string;
    name: string;
    progress_rate: number;
    status: string;
    order_index?: number;
    parent_process_id?: string | null;
  }[] | null = null;
  let error: Error | null = null;

  const primary = await supabase
    .from("processes")
    .select("id, category, name, progress_rate, status, order_index, parent_process_id")
    .eq("site_id", siteId)
    .order("order_index");

  data = primary.data;
  error = primary.error;

  if (error?.message?.includes("order_index")) {
    const fallback = await supabase
      .from("processes")
      .select("id, category, name, progress_rate, status, parent_process_id")
      .eq("site_id", siteId)
      .order("category")
      .order("name");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data;
}

export async function fetchProcessChecklistItems(processIds: string[]) {
  if (processIds.length === 0) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("process_checklist_items")
      .select("id, process_id, name, is_completed, sort_order")
      .in("process_id", processIds)
      .order("sort_order");
    if (error) return []; // テーブル未作成時はフォールバック
    return data ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 新規工程作成
// ---------------------------------------------------------------------------
export async function createProcess(siteId: string, category: string, name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .insert({ site_id: siteId, category, name })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return { success: false as const, error: "同じ工程が既に存在します" };
    }
    throw error;
  }
  return { success: true as const, process: data };
}

// ---------------------------------------------------------------------------
// 作業者候補の取得（登録ユーザー一覧）
// ---------------------------------------------------------------------------
export async function fetchWorkers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // admin, manager, worker_internal, worker_external のプロフィールを取得
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "manager", "worker_internal", "worker_external"])
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? [])
    .filter((p) => p.full_name && p.full_name.trim() !== "")
    .map((p) => ({ id: p.id, name: p.full_name!, role: p.role }));
}

// ---------------------------------------------------------------------------
// 直近の進捗率を取得（自動引き継ぎ用）
// ---------------------------------------------------------------------------
export async function fetchLatestProgress(processId: string) {
  const supabase = await createClient();
  // processes テーブルの progress_rate を取得
  const { data, error } = await supabase
    .from("processes")
    .select("progress_rate")
    .eq("id", processId)
    .single();
  if (error) return 0;
  return data.progress_rate;
}

// ---------------------------------------------------------------------------
// 日次報告の作成
// ---------------------------------------------------------------------------
export async function createDailyReport(
  input: CreateReportInput
): Promise<CreateReportResult> {
  try {
  const supabase = await createClient();

  // 認証ユーザーの取得
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // 現場IDの決定: siteId が指定されていればそのまま使う。なければ getOrCreateSite で取得
  let siteId: string;
  if (input.siteId) {
    siteId = input.siteId;
  } else {
    const siteResult = await getOrCreateSite(supabase, input.siteName.trim());
    if ("error" in siteResult) {
      return { success: false, error: siteResult.error };
    }
    siteId = siteResult.id;
  }

  if (input.processes.length === 0) {
    return { success: false, error: "工程を1つ以上選択してください" };
  }

  const duplicateProcessNames = input.processes
    .filter(
      (process, index, list) =>
        list.findIndex((target) => target.processId === process.processId) !== index
    )
    .map((process) => process.name || "未設定工程");

  if (duplicateProcessNames.length > 0) {
    return {
      success: false,
      error: `同じ工程が重複しています: ${duplicateProcessNames.join("、")}`,
    };
  }

  const selectedProcessIds = input.processes.map((process) => process.processId);
  const { data: existingReports, error: existingReportsError } = await supabase
    .from("daily_reports")
    .select("process_id, processes(name)")
    .in("process_id", selectedProcessIds)
    .eq("report_date", input.reportDate)
    .eq("reporter_id", user.id);

  if (existingReportsError) {
    return {
      success: false,
      error: `既存報告の確認に失敗しました: ${existingReportsError.message}`,
    };
  }

  if ((existingReports ?? []).length > 0) {
    const existingNames = (existingReports ?? []).map((report) => {
      const process = report.processes as { name?: string } | null;
      return process?.name || "未設定工程";
    });
    return {
      success: false,
      error: `この日付で自分が既に報告済みの工程があります: ${existingNames.join("、")}`,
    };
  }

  // 作業者リストをパース（読点区切り）
  const workersArray = input.workers
    .split(/[、,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  const invalidProgressProcess = input.processes.find((process) => {
    const progressRate = Number.parseInt(process.progressRate, 10);
    return Number.isNaN(progressRate) || progressRate < 0 || progressRate > 100;
  });

  if (invalidProgressProcess) {
    return {
      success: false,
      error: `進捗率が不正です: ${invalidProgressProcess.name || "未設定工程"}`,
    };
  }

  const reportRows = input.processes.map((process) => ({
    site_id: siteId,
    process_id: process.processId,
    reporter_id: user.id,
    report_date: input.reportDate,
    work_process: process.workProcess,
    work_content: input.workDescription,
    workers: workersArray,
    progress_rate: Number.parseInt(process.progressRate, 10),
    weather: input.weather || null,
    arrival_time: input.arrivalTime || null,
    departure_time: input.departureTime || null,
    issues: input.issues || null,
    approval_status: input.isDraft ? "draft" : "submitted",
  }));

  const { data: createdReports, error: insertError } = await supabase
    .from("daily_reports")
    .insert(reportRows)
    .select("id, process_id");

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        success: false,
        error: input.isDraft
          ? "選択した工程の中に、この日付で自分が既に下書き・報告済みのものがあります"
          : "選択した工程の中に、この日付で自分が既に報告済みのものがあります",
      };
    }
    return { success: false, error: `報告作成エラー: ${insertError.message}` };
  }

  const createdReportIds = (createdReports ?? []).map((report) => report.id);

  // 報告一覧のキャッシュを無効化
  revalidatePath("/reports");

  // 下書きの場合はメール通知をスキップ
  if (input.isDraft) {
    return {
      success: true,
      reportId: createdReportIds[0],
      reportIds: createdReportIds,
    };
  }

  // メール通知（非同期・エラーは無視）
  try {
    const adminClient = createAdminClient();
    const { data: adminManagerProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .in("role", ["admin", "manager"]);

    if (adminManagerProfiles && adminManagerProfiles.length > 0) {
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const adminIds = new Set(adminManagerProfiles.map((p) => p.id));
      const adminEmails = (authUsers?.users ?? [])
        .filter((u) => adminIds.has(u.id) && u.email)
        .map((u) => u.email!);

      const { data: siteData } = await supabase
        .from("sites")
        .select("name")
        .eq("id", siteId)
        .single();

      const reporterName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "不明";

      notifyReportSubmitted({
        reporterName,
        siteName: siteData?.name ?? "不明な現場",
        reportDate: input.reportDate,
        reportId: createdReportIds[0],
        adminEmails,
      }).catch((err) => console.error("[Email] Notification error:", err));
    }
  } catch (err) {
    console.error("[Email] Failed to send notification:", err);
  }

  return {
    success: true,
    reportId: createdReportIds[0],
    reportIds: createdReportIds,
  };
  } catch (err) {
    console.error("[createDailyReport] Unexpected error:", err);
    return { success: false, error: `予期しないエラーが発生しました: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// 報告の削除（写真アップロード失敗時のロールバック用）
// ---------------------------------------------------------------------------
export async function deleteCreatedReports(reportIds: string[]) {
  if (reportIds.length === 0) return;
  try {
    const supabase = await createClient();
    await supabase.from("daily_reports").delete().in("id", reportIds);
  } catch (err) {
    console.error("[deleteCreatedReports] Failed to rollback:", err);
  }
}

// ---------------------------------------------------------------------------
// 写真・動画のアップロード
// ---------------------------------------------------------------------------
interface UploadPhotosInput {
  reportId: string;
  photos: FormData;
}

interface UploadPhotosResult {
  success: boolean;
  uploadedCount?: number;
  error?: string;
}

export async function uploadReportPhotos(
  input: UploadPhotosInput
): Promise<UploadPhotosResult> {
  try {
  const supabase = await createClient();

  // 認証ユーザーの取得
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // FormDataから写真・動画ファイルとタイプ、キャプションを取得
  const files = input.photos.getAll("photos") as File[];
  const photoTypes = input.photos.getAll("photoTypes") as string[];
  const captions = input.photos.getAll("captions") as string[];
  const processIds = input.photos.getAll("processIds") as string[];
  if (files.length === 0) {
    return { success: true, uploadedCount: 0 };
  }

  // ストレージ同期のため report から site_id を取得
  const { data: report } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", input.reportId)
    .single();
  const siteId = report?.site_id;

  const uploadedPaths: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File) || file.size === 0) continue;

    // メディアタイプの判定
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";
    const VALID_PHOTO_TYPES = ["before", "during", "after", "corner_ne", "corner_nw", "corner_se", "corner_sw"];
    const rawPhotoType = photoTypes[i] || "during";
    const photoType = VALID_PHOTO_TYPES.includes(rawPhotoType) ? rawPhotoType : "during";

    // 動画は50MB制限
    if (mediaType === "video" && file.size > 50 * 1024 * 1024) {
      errors.push(`${file.name}: 動画ファイルは50MB以下にしてください`);
      continue;
    }

    // ファイル名を生成: reports/{reportId}/{timestamp}_{index}.{ext}
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const storagePath = `reports/${input.reportId}/${timestamp}_${i}.${ext}`;

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from("report-photos")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    // report_photosテーブルに保存
    const processId = processIds[i] || null;
    const { error: dbError } = await supabase.from("report_photos").insert({
      report_id: input.reportId,
      storage_path: storagePath,
      photo_type: photoType,
      media_type: mediaType,
      caption: captions[i] || null,
      ...(processId ? { process_id: processId } : {}),
    });

    if (dbError) {
      console.error("[PhotoUpload] DB insert error:", dbError.message, dbError.code, dbError.details);
      errors.push(`${file.name}: DB保存エラー (${dbError.message})`);
      // アップロードしたファイルを削除（ロールバック）
      await supabase.storage.from("report-photos").remove([storagePath]);
      continue;
    }

    uploadedPaths.push(storagePath);

    // ストレージフォルダに自動反映（非同期、失敗しても報告アップロード自体は成功）
    if (siteId) {
      console.log("[StorageSync] Calling sync:", { siteId, processId, photoType, storagePath });
      syncReportPhotoToStorage({
        siteId,
        userId: user.id,
        processId: processId || undefined,
        photoType: photoType,
        storagePath,
        fileName: file.name,
        fileSize: file.size,
      }).then((res) => {
        console.log("[StorageSync] Result:", JSON.stringify(res));
      }).catch((err) => console.error("[StorageSync] Error:", err));
    } else {
      console.log("[StorageSync] Skipped: no siteId. reportId:", input.reportId);
    }
  }

  if (errors.length > 0 && uploadedPaths.length === 0) {
    return {
      success: false,
      error: `アップロードに失敗しました: ${errors[0]}`,
    };
  }

  return {
    success: true,
    uploadedCount: uploadedPaths.length,
  };
  } catch (err) {
    console.error("[uploadReportPhotos] Unexpected error:", err);
    return { success: false, error: `写真アップロード中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// 使用材料の保存
// ---------------------------------------------------------------------------
interface MaterialInput {
  material_name: string;
  product_number: string;
  quantity: string;
  unit: string;
  supplier: string;
  note: string;
}

interface SaveMaterialsResult {
  success: boolean;
  savedCount?: number;
  error?: string;
}

export async function saveReportMaterials(
  reportId: string,
  materials: MaterialInput[]
): Promise<SaveMaterialsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // material_name が空の行はスキップ
  const validMaterials = materials.filter((m) => m.material_name.trim());
  if (validMaterials.length === 0) {
    return { success: true, savedCount: 0 };
  }

  const rows = validMaterials.map((m) => ({
    report_id: reportId,
    material_name: m.material_name.trim(),
    product_number: m.product_number.trim() || null,
    quantity: m.quantity ? parseFloat(m.quantity) : null,
    unit: m.unit.trim() || null,
    supplier: m.supplier.trim() || null,
    note: m.note.trim() || null,
  }));

  const { error: insertError } = await supabase
    .from("report_materials")
    .insert(rows);

  if (insertError) {
    return { success: false, error: `材料保存エラー: ${insertError.message}` };
  }

  return { success: true, savedCount: rows.length };
}

// ---------------------------------------------------------------------------
// 下書き報告の取得（編集用）
// ---------------------------------------------------------------------------
export async function fetchDraftReport(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 下書き報告を取得（自分の報告のみ）
  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(`
      id, site_id, process_id, report_date, work_process, work_content,
      workers, progress_rate, weather, arrival_time, departure_time,
      issues, approval_status,
      sites(id, name),
      processes(id, category, name, progress_rate)
    `)
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("approval_status", "draft")
    .single();

  if (error || !report) return null;
  return report;
}

// ---------------------------------------------------------------------------
// 同日・同報告者の下書きグループを取得
// ---------------------------------------------------------------------------
export async function fetchDraftGroup(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // まず指定の下書き報告を取得
  const { data: baseReport } = await supabase
    .from("daily_reports")
    .select("site_id, report_date, reporter_id")
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("approval_status", "draft")
    .single();

  if (!baseReport) return null;

  // 同日・同現場・同報告者の全下書きを取得
  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select(`
      id, site_id, process_id, report_date, work_process, work_content,
      workers, progress_rate, weather, arrival_time, departure_time,
      issues, approval_status,
      sites(id, name),
      processes(id, category, name, progress_rate)
    `)
    .eq("site_id", baseReport.site_id)
    .eq("report_date", baseReport.report_date)
    .eq("reporter_id", user.id)
    .eq("approval_status", "draft");

  if (error) return null;

  // 写真も取得
  const reportIds = (reports ?? []).map((r) => r.id);
  const { data: photos } = await supabase
    .from("report_photos")
    .select("id, report_id, storage_path, photo_type, media_type, caption, process_id")
    .in("report_id", reportIds);

  return { reports: reports ?? [], photos: photos ?? [] };
}

// ---------------------------------------------------------------------------
// 下書き報告の更新
// ---------------------------------------------------------------------------
interface UpdateDraftInput {
  reportIds: string[]; // 既存の下書きレポートID群
  siteId: string;
  reportDate: string;
  workDescription: string;
  workers: string;
  weather: string;
  arrivalTime: string;
  departureTime: string;
  issues: string;
  processes: Array<{
    processId: string;
    workProcess: string;
    progressRate: string;
    name?: string;
  }>;
}

export async function updateDraftReport(
  input: UpdateDraftInput
): Promise<CreateReportResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: "ログインが必要です" };

    const workersArray = input.workers
      .split(/[、,]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    // 既存の下書きを削除
    if (input.reportIds.length > 0) {
      await supabase.from("daily_reports").delete().in("id", input.reportIds);
    }

    // 新しい下書きとして再作成
    const reportRows = input.processes.map((process) => ({
      site_id: input.siteId,
      process_id: process.processId,
      reporter_id: user.id,
      report_date: input.reportDate,
      work_process: process.workProcess,
      work_content: input.workDescription,
      workers: workersArray,
      progress_rate: Number.parseInt(process.progressRate, 10) || 0,
      weather: input.weather || null,
      arrival_time: input.arrivalTime || null,
      departure_time: input.departureTime || null,
      issues: input.issues || null,
      approval_status: "draft",
    }));

    const { data: createdReports, error: insertError } = await supabase
      .from("daily_reports")
      .insert(reportRows)
      .select("id, process_id");

    if (insertError) {
      return { success: false, error: `下書き更新エラー: ${insertError.message}` };
    }

    revalidatePath("/reports");

    const createdReportIds = (createdReports ?? []).map((r) => r.id);

    // ログ記録
    const action = input.isDraft ? "created" : "submitted";
    for (const rid of createdReportIds) {
      logActivity({
        entityType: "daily_report",
        entityId: rid,
        siteId: input.siteId,
        action,
        actorId: user.id,
      });
    }

    return { success: true, reportId: createdReportIds[0], reportIds: createdReportIds };
  } catch (err) {
    return { success: false, error: `予期しないエラー: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// 下書きの提出（draft → submitted）
// ---------------------------------------------------------------------------
export async function submitDraftReport(
  reportIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: "ログインが必要です" };

    const { error: updateError } = await supabase
      .from("daily_reports")
      .update({ approval_status: "submitted" })
      .in("id", reportIds)
      .eq("reporter_id", user.id)
      .eq("approval_status", "draft");

    if (updateError) {
      return { success: false, error: `提出エラー: ${updateError.message}` };
    }

    revalidatePath("/reports");

    // メール通知
    try {
      const adminClient = createAdminClient();
      const { data: adminManagerProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .in("role", ["admin", "manager"]);

      if (adminManagerProfiles && adminManagerProfiles.length > 0) {
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const adminIds = new Set(adminManagerProfiles.map((p) => p.id));
        const adminEmails = (authUsers?.users ?? [])
          .filter((u) => adminIds.has(u.id) && u.email)
          .map((u) => u.email!);

        // 最初の報告から現場情報を取得
        const { data: reportData } = await supabase
          .from("daily_reports")
          .select("site_id, report_date, sites(name)")
          .eq("id", reportIds[0])
          .single();

        const reporterName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "不明";

        const siteName = (reportData?.sites as { name?: string } | null)?.name ?? "不明な現場";

        notifyReportSubmitted({
          reporterName,
          siteName,
          reportDate: reportData?.report_date ?? "",
          reportId: reportIds[0],
          adminEmails,
        }).catch((err) => console.error("[Email] Notification error:", err));
      }
    } catch (err) {
      console.error("[Email] Failed to send notification:", err);
    }

    // ログ記録
    const { data: reportForLog } = await supabase
      .from("daily_reports")
      .select("site_id")
      .eq("id", reportIds[0])
      .single();
    for (const rid of reportIds) {
      logActivity({
        entityType: "daily_report",
        entityId: rid,
        siteId: reportForLog?.site_id,
        action: "submitted",
        actorId: user.id,
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `予期しないエラー: ${err instanceof Error ? err.message : String(err)}` };
  }
}
