import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PROCESS_TEMPLATES } from "@/lib/constants";

// 型と共通ユーティリティを再エクスポート（後方互換性維持）
export type { ProcessTemplateRecord, ProcessTemplateTreeNode } from "./processTemplateTypes";
export { buildTemplateTree } from "./processTemplateTypes";

import type { ProcessTemplateRecord } from "./processTemplateTypes";

export async function listProcessTemplates(): Promise<ProcessTemplateRecord[]> {
  const supabase = await createClient();

  // parent_template_id カラム込みで取得を試行
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null = null;
  let error: { message: string } | null = null;

  const primary = await supabase
    .from("process_templates")
    .select("id, phase_key, process_code, category, name, parallel_group, sort_order, parent_template_id")
    .order("sort_order");
  data = primary.data;
  error = primary.error;

  // parent_template_id カラムが未追加の場合、カラムなしで再試行
  if (error?.message?.includes("parent_template_id")) {
    const fallback = await supabase
      .from("process_templates")
      .select("id, phase_key, process_code, category, name, parallel_group, sort_order")
      .order("sort_order");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (
      error.message?.includes("process_templates") ||
      error.message?.includes("phase_key") ||
      error.message?.includes("process_code") ||
      error.message?.includes("parallel_group")
    ) {
      return DEFAULT_PROCESS_TEMPLATES.map((item, index) => ({
        id: `fallback-${index + 1}`,
        phaseKey: item.phaseKey,
        processCode: item.processCode,
        category: item.category,
        name: item.name,
        parallelGroup: item.parallelGroup,
        sortOrder: item.sortOrder,
        parentTemplateId: item.parentTemplateId,
      }));
    }
    throw error;
  }

  return (data ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    phaseKey: item.phase_key as "A" | "B" | "C" | "D",
    processCode: item.process_code as string,
    category: item.category as string,
    name: item.name as string,
    parallelGroup: (item.parallel_group as number | null) ?? null,
    sortOrder: item.sort_order as number,
    parentTemplateId: (item.parent_template_id as string | null) ?? null,
  }));
}
