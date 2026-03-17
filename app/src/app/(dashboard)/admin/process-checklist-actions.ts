"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireTemplateManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export interface ChecklistTemplateItem {
  id: string;
  processTemplateId: string;
  name: string;
  sortOrder: number;
}

export async function getChecklistTemplates(
  processTemplateId: string
): Promise<{ success: boolean; items?: ChecklistTemplateItem[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data, error } = await supabase
    .from("process_checklist_templates")
    .select("id, process_template_id, name, sort_order")
    .eq("process_template_id", processTemplateId)
    .order("sort_order");

  if (error) {
    if (error.message?.includes("process_checklist_templates")) {
      return { success: true, items: [] };
    }
    return { success: false, error: `チェックリストの取得に失敗しました: ${error.message}` };
  }

  return {
    success: true,
    items: (data ?? []).map((row) => ({
      id: row.id as string,
      processTemplateId: row.process_template_id as string,
      name: row.name as string,
      sortOrder: row.sort_order as number,
    })),
  };
}

export async function addChecklistTemplate(
  processTemplateId: string,
  name: string
): Promise<{ success: boolean; items?: ChecklistTemplateItem[]; error?: string }> {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error ?? "認証エラー" };
  const supabase = context.supabase;

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "項目名を入力してください" };

  const { data: maxRow } = await supabase
    .from("process_checklist_templates")
    .select("sort_order")
    .eq("process_template_id", processTemplateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.sort_order as number | null) ?? 0) + 1;

  const { error } = await supabase
    .from("process_checklist_templates")
    .insert({
      process_template_id: processTemplateId,
      name: trimmed,
      sort_order: nextOrder,
    });

  if (error) {
    return { success: false, error: `チェックリスト項目の追加に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin");
  return getChecklistTemplates(processTemplateId);
}

export async function deleteChecklistTemplate(
  id: string,
  processTemplateId: string
): Promise<{ success: boolean; items?: ChecklistTemplateItem[]; error?: string }> {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error ?? "認証エラー" };
  const supabase = context.supabase;

  const { error } = await supabase
    .from("process_checklist_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: `チェックリスト項目の削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin");
  return getChecklistTemplates(processTemplateId);
}

export async function reorderChecklistTemplates(
  items: { id: string; sortOrder: number }[]
): Promise<{ success: boolean; error?: string }> {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error ?? "認証エラー" };
  const supabase = context.supabase;

  for (const item of items) {
    const { error } = await supabase
      .from("process_checklist_templates")
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id);

    if (error) {
      return { success: false, error: `並び替えに失敗しました: ${error.message}` };
    }
  }

  revalidatePath("/admin");
  return { success: true };
}
