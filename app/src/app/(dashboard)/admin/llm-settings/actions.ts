"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  clearSecureSetting,
  getSecureSettingMeta,
  setSecureSetting,
} from "@/lib/secureSettings";

const CLAUDE_API_KEY = "claude_api_key";

function formatSettingError(message: string, fallback: string) {
  if (message.includes("secure_settings") || message.includes("schema cache")) {
    return "APIキー設定が未初期化です。Supabase に migration_v15_llm_api_settings.sql を適用してください";
  }
  if (message.includes("APP_SECRETS_MASTER_KEY")) {
    return "暗号化キーが未設定です。APP_SECRETS_MASTER_KEY を環境変数に設定してください";
  }
  return `${fallback}: ${message}`;
}

async function requireAdminManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: "認証エラー" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { user: null, error: "権限がありません" };
  }

  return { user, error: null as string | null };
}

async function revalidatePages() {
  revalidatePath("/admin");
  revalidatePath("/admin/llm-settings");
}

export async function saveClaudeApiKey(value: string) {
  const context = await requireAdminManager();
  if (!context.user) {
    return { success: false, error: context.error };
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { success: false, error: "APIキーを入力してください" };
  }

  try {
    await setSecureSetting({
      key: CLAUDE_API_KEY,
      value: trimmedValue,
      updatedBy: context.user.id,
    });
    await revalidatePages();
    return {
      success: true,
      meta: await getSecureSettingMeta(CLAUDE_API_KEY),
    };
  } catch (error) {
    return {
      success: false,
      error: formatSettingError(
        error instanceof Error ? error.message : String(error),
        "APIキーの保存に失敗しました"
      ),
    };
  }
}

export async function deleteClaudeApiKey() {
  const context = await requireAdminManager();
  if (!context.user) {
    return { success: false, error: context.error };
  }

  try {
    await clearSecureSetting(CLAUDE_API_KEY);
    await revalidatePages();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatSettingError(
        error instanceof Error ? error.message : String(error),
        "APIキーの削除に失敗しました"
      ),
    };
  }
}
