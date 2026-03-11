"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listProcessCategories } from "@/lib/processCategories";

function formatCategoryActionError(message: string, fallback: string) {
  if (message.includes("process_categories") || message.includes("schema cache")) {
    return "工程種別マスターが未初期化です。Supabase に migration_v12_process_categories.sql を適用してください";
  }
  return `${fallback}: ${message}`;
}

async function requireCategoryManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "認証エラー", supabase: null as Awaited<ReturnType<typeof createClient>> | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { error: "権限がありません", supabase: null as Awaited<ReturnType<typeof createClient>> | null };
  }

  return { supabase, error: null as string | null };
}

async function revalidateCategoryPages() {
  revalidatePath("/admin/process-templates");
  revalidatePath("/sites");
}

export async function createProcessCategory(label: string) {
  const context = await requireCategoryManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { success: false, error: "工程種別名を入力してください" };

  const categories = await listProcessCategories();
  const duplicate = categories.find(
    (category) => category.label === trimmedLabel || category.value === trimmedLabel
  );
  if (duplicate) {
    return { success: false, error: "同じ工程種別がすでに存在します" };
  }

  const nextSortOrder = (categories.at(-1)?.sortOrder ?? 0) + 1;
  const value = `custom_${Date.now()}`;

  const { error } = await supabase.from("process_categories").insert({
    value,
    label: trimmedLabel,
    sort_order: nextSortOrder,
  });

  if (error) {
    return {
      success: false,
      error: formatCategoryActionError(error.message, "工程種別の追加に失敗しました"),
    };
  }

  await revalidateCategoryPages();
  return { success: true, categories: await listProcessCategories() };
}

export async function updateProcessCategory(input: {
  categoryId: string;
  label: string;
}) {
  const context = await requireCategoryManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedLabel = input.label.trim();
  if (!trimmedLabel) return { success: false, error: "工程種別名を入力してください" };

  const { error } = await supabase
    .from("process_categories")
    .update({ label: trimmedLabel })
    .eq("id", input.categoryId);

  if (error) {
    return {
      success: false,
      error: formatCategoryActionError(error.message, "工程種別の更新に失敗しました"),
    };
  }

  await revalidateCategoryPages();
  return { success: true, categories: await listProcessCategories() };
}

export async function deleteProcessCategory(input: {
  categoryId: string;
  value: string;
}) {
  const context = await requireCategoryManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const [{ count: templateCount }, { count: processCount }] = await Promise.all([
    supabase
      .from("process_templates")
      .select("*", { head: true, count: "exact" })
      .eq("category", input.value),
    supabase
      .from("processes")
      .select("*", { head: true, count: "exact" })
      .eq("category", input.value),
  ]);

  if ((templateCount ?? 0) > 0 || (processCount ?? 0) > 0) {
    return {
      success: false,
      error: "使用中の工程種別は削除できません。標準工程や現場工程で未使用にしてから削除してください",
    };
  }

  const { error } = await supabase
    .from("process_categories")
    .delete()
    .eq("id", input.categoryId);

  if (error) {
    return {
      success: false,
      error: formatCategoryActionError(error.message, "工程種別の削除に失敗しました"),
    };
  }

  const categories = await listProcessCategories();
  await Promise.all(
    categories.map((category, index) =>
      supabase
        .from("process_categories")
        .update({ sort_order: index + 1 })
        .eq("id", category.id)
    )
  );

  await revalidateCategoryPages();
  return { success: true, categories: await listProcessCategories() };
}
