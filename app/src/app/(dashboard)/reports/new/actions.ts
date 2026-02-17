"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface CreateReportInput {
  siteName: string;
  reportDate: string;
  workProcess: string;
  workDescription: string;
  workers: string;
  progressRate: string;
}

interface CreateReportResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// 現場の取得または作成
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
    // supervisorでない場合はRLSエラーになる可能性
    if (insertError.code === "42501") {
      return { error: "現場の新規登録権限がありません。監督者に現場登録を依頼してください。" };
    }
    return { error: `現場作成エラー: ${insertError.message}` };
  }

  return { id: newSite.id };
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

  // 現場の取得または作成
  const siteResult = await getOrCreateSite(supabase, input.siteName.trim());
  if ("error" in siteResult) {
    return { success: false, error: siteResult.error };
  }

  // 作業者リストをパース（読点区切り）
  const workersArray = input.workers
    .split(/[、,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  // 日次報告の作成
  const { data: report, error: insertError } = await supabase
    .from("daily_reports")
    .insert({
      site_id: siteResult.id,
      reporter_id: user.id,
      report_date: input.reportDate,
      work_process: input.workProcess,
      work_content: input.workDescription,
      workers: workersArray,
      progress_rate: parseInt(input.progressRate, 10),
    })
    .select("id")
    .single();

  if (insertError) {
    // 重複エラーのハンドリング
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "この現場・日付の報告は既に存在します",
      };
    }
    return { success: false, error: `報告作成エラー: ${insertError.message}` };
  }

  // 報告一覧のキャッシュを無効化
  revalidatePath("/reports");

  return { success: true, reportId: report.id };
}

// ---------------------------------------------------------------------------
// 写真のアップロード
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

  // FormDataから写真ファイルを取得
  const files = input.photos.getAll("photos") as File[];
  if (files.length === 0) {
    return { success: true, uploadedCount: 0 };
  }

  const uploadedPaths: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File) || file.size === 0) continue;

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
      photo_type: "after", // デフォルト: 施工後
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
      error: `写真のアップロードに失敗しました: ${errors[0]}`,
    };
  }

  return {
    success: true,
    uploadedCount: uploadedPaths.length,
  };
}
