"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listProcessTemplates } from "@/lib/processTemplates";

function formatTemplateActionError(message: string, fallback: string) {
  if (
    message.includes("process_templates") ||
    message.includes("schema cache") ||
    message.includes("phase_key") ||
    message.includes("process_code") ||
    message.includes("parallel_group")
  ) {
    return "標準工程マスターが未初期化です。Supabase に migration_v10_process_template_master.sql と migration_v11_process_template_flowchart.sql を適用してください";
  }
  return `${fallback}: ${message}`;
}

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

async function revalidateTemplatePages() {
  revalidatePath("/admin");
  revalidatePath("/admin/process-templates");
  revalidatePath("/sites");
}

export async function createProcessTemplate(input: {
  phaseKey: "A" | "B" | "C" | "D";
  processCode: string;
  category: string;
  name: string;
  parallelGroup: number | null;
  parentTemplateId?: string | null;
}) {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedCode = input.processCode.trim();
  const trimmedName = input.name.trim();
  if (!trimmedCode) return { success: false, error: "工程IDを入力してください" };
  if (!trimmedName) return { success: false, error: "工程名を入力してください" };

  const { data: maxRow } = await supabase
    .from("process_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insertData: Record<string, unknown> = {
    phase_key: input.phaseKey,
    process_code: trimmedCode,
    category: input.category,
    name: trimmedName,
    parallel_group: input.parallelGroup,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
  };
  if (input.parentTemplateId) {
    insertData.parent_template_id = input.parentTemplateId;
  }

  const { error } = await supabase
    .from("process_templates")
    .insert(insertData);

  if (error) {
    return {
      success: false,
      error: formatTemplateActionError(error.message, "標準工程の追加に失敗しました"),
    };
  }

  await revalidateTemplatePages();
  return { success: true, templates: await listProcessTemplates() };
}

export async function updateProcessTemplate(input: {
  templateId: string;
  phaseKey: "A" | "B" | "C" | "D";
  processCode: string;
  category: string;
  name: string;
  parallelGroup: number | null;
  parentTemplateId?: string | null;
}) {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedCode = input.processCode.trim();
  const trimmedName = input.name.trim();
  if (!trimmedCode) return { success: false, error: "工程IDを入力してください" };
  if (!trimmedName) return { success: false, error: "工程名を入力してください" };

  const updateData: Record<string, unknown> = {
    phase_key: input.phaseKey,
    process_code: trimmedCode,
    category: input.category,
    name: trimmedName,
    parallel_group: input.parallelGroup,
  };
  if (input.parentTemplateId !== undefined) {
    updateData.parent_template_id = input.parentTemplateId ?? null;
  }

  const { error } = await supabase
    .from("process_templates")
    .update(updateData)
    .eq("id", input.templateId);

  if (error) {
    return {
      success: false,
      error: formatTemplateActionError(error.message, "標準工程の更新に失敗しました"),
    };
  }

  await revalidateTemplatePages();
  return { success: true, templates: await listProcessTemplates() };
}

export async function deleteProcessTemplate(templateId: string) {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const { error } = await supabase
    .from("process_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    return {
      success: false,
      error: formatTemplateActionError(error.message, "標準工程の削除に失敗しました"),
    };
  }

  const templates = await listProcessTemplates();
  await Promise.all(
    templates.map((template, index) =>
      supabase
        .from("process_templates")
        .update({ sort_order: index + 1 })
        .eq("id", template.id)
    )
  );

  await revalidateTemplatePages();
  return { success: true, templates: await listProcessTemplates() };
}

export async function moveProcessTemplate(input: {
  templateId: string;
  direction: "up" | "down";
}) {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const templates = await listProcessTemplates();
  const currentIndex = templates.findIndex((template) => template.id === input.templateId);
  if (currentIndex === -1) return { success: false, error: "標準工程が見つかりません" };

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= templates.length) {
    return { success: true, templates };
  }

  const swapped = [...templates];
  [swapped[currentIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[currentIndex]];

  for (let index = 0; index < swapped.length; index += 1) {
    const template = swapped[index];
    const { error } = await supabase
      .from("process_templates")
      .update({ sort_order: index + 1 })
      .eq("id", template.id);
    if (error) {
      return {
        success: false,
        error: formatTemplateActionError(error.message, "標準工程の並び替えに失敗しました"),
      };
    }
  }

  await revalidateTemplatePages();
  return { success: true, templates: await listProcessTemplates() };
}

export async function bulkCreateChildTemplates(input: {
  parentTemplateId: string;
  children: Array<{
    phaseKey: "A" | "B" | "C" | "D";
    processCode: string;
    category: string;
    name: string;
    parallelGroup: number | null;
  }>;
}) {
  const context = await requireTemplateManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  if (input.children.length === 0) {
    return { success: false, error: "子工程が指定されていません" };
  }

  const { data: maxRow } = await supabase
    .from("process_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const rows = input.children.map((child) => {
    const row = {
      phase_key: child.phaseKey,
      process_code: child.processCode.trim(),
      category: child.category,
      name: child.name.trim(),
      parallel_group: child.parallelGroup,
      sort_order: nextSortOrder,
      parent_template_id: input.parentTemplateId,
    };
    nextSortOrder += 1;
    return row;
  });

  const { error } = await supabase.from("process_templates").insert(rows);

  if (error) {
    return {
      success: false,
      error: formatTemplateActionError(error.message, "子工程の一括追加に失敗しました"),
    };
  }

  await revalidateTemplatePages();
  return { success: true, templates: await listProcessTemplates() };
}
