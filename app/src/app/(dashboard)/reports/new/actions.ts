"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface CreateReportInput {
  siteName: string; // 既存（後方互換のため残す）
  siteId?: string; // 新規追加: 現場ID（ドロップダウンから選択時）
  processId: string; // 新規追加: 工程ID
  reportDate: string;
  workProcess: string;
  workDescription: string;
  workers: string;
  progressRate: string;
  weather: string;
  workHours: string;
  issues: string;
}

interface CreateReportResult {
  success: boolean;
  reportId?: string;
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
  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// 指定現場の工程一覧を取得（カテゴリでグルーピング）
// ---------------------------------------------------------------------------
export async function fetchProcesses(siteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .select("id, category, name, progress_rate, status")
    .eq("site_id", siteId)
    .order("category")
    .order("name");
  if (error) throw error;
  return data;
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

  // 作業者リストをパース（読点区切り）
  const workersArray = input.workers
    .split(/[、,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const progressRate = parseInt(input.progressRate, 10);

  // 日次報告の作成
  const { data: report, error: insertError } = await supabase
    .from("daily_reports")
    .insert({
      site_id: siteId,
      process_id: input.processId,
      reporter_id: user.id,
      report_date: input.reportDate,
      work_process: input.workProcess,
      work_content: input.workDescription,
      workers: workersArray,
      progress_rate: progressRate,
      weather: input.weather || null,
      work_hours: input.workHours ? parseFloat(input.workHours) : null,
      issues: input.issues || null,
      approval_status: "submitted",
    })
    .select("id")
    .single();

  if (insertError) {
    // 重複エラーのハンドリング
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "この工程・日付の報告は既に存在します",
      };
    }
    return { success: false, error: `報告作成エラー: ${insertError.message}` };
  }

  // processes テーブルの progress_rate と status を更新
  const newStatus = progressRate >= 100 ? "completed" : "in_progress";
  const { error: processUpdateError } = await supabase
    .from("processes")
    .update({
      progress_rate: progressRate,
      status: newStatus,
    })
    .eq("id", input.processId);

  if (processUpdateError) {
    // 工程更新エラーは報告自体の成功には影響させない（ログのみ）
    console.error("工程進捗率の更新エラー:", processUpdateError.message);
  }

  // 報告一覧のキャッシュを無効化
  revalidatePath("/reports");

  return { success: true, reportId: report.id };
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
  const supabase = await createClient();

  // 認証ユーザーの取得
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // FormDataから写真・動画ファイルとタイプを取得
  const files = input.photos.getAll("photos") as File[];
  const photoTypes = input.photos.getAll("photoTypes") as string[];
  if (files.length === 0) {
    return { success: true, uploadedCount: 0 };
  }

  const uploadedPaths: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File) || file.size === 0) continue;

    // メディアタイプの判定
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";
    const photoType = photoTypes[i] || "after";

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
    const { error: dbError } = await supabase.from("report_photos").insert({
      report_id: input.reportId,
      storage_path: storagePath,
      photo_type: photoType,
      media_type: mediaType,
      caption: null,
    });

    if (dbError) {
      errors.push(`${file.name}: DB保存エラー`);
      // アップロードしたファイルを削除（ロールバック）
      await supabase.storage.from("report-photos").remove([storagePath]);
      continue;
    }

    uploadedPaths.push(storagePath);
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
