import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PROCESS_TEMPLATES } from "@/lib/constants";

export interface ProcessTemplateRecord {
  id: string;
  phaseKey: "A" | "B" | "C" | "D";
  processCode: string;
  category: string;
  name: string;
  parallelGroup: number | null;
  sortOrder: number;
  parentTemplateId: string | null;
}

export interface ProcessTemplateTreeNode extends ProcessTemplateRecord {
  children: ProcessTemplateTreeNode[];
}

export async function listProcessTemplates(): Promise<ProcessTemplateRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("process_templates")
    .select("id, phase_key, process_code, category, name, parallel_group, sort_order, parent_template_id")
    .order("sort_order");

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

  return (data ?? []).map((item) => ({
    id: item.id,
    phaseKey: item.phase_key,
    processCode: item.process_code,
    category: item.category,
    name: item.name,
    parallelGroup: item.parallel_group,
    sortOrder: item.sort_order,
    parentTemplateId: item.parent_template_id ?? null,
  }));
}

/**
 * フラットなテンプレートリストをツリー構造に変換する。
 * parentTemplateId が null のものがルートノードとなる。
 */
export function buildTemplateTree(
  templates: ProcessTemplateRecord[]
): ProcessTemplateTreeNode[] {
  const nodeMap = new Map<string, ProcessTemplateTreeNode>();
  const roots: ProcessTemplateTreeNode[] = [];

  // まず全ノードを作成
  for (const t of templates) {
    nodeMap.set(t.id, { ...t, children: [] });
  }

  // 親子関係を構築
  for (const t of templates) {
    const node = nodeMap.get(t.id)!;
    if (t.parentTemplateId && nodeMap.has(t.parentTemplateId)) {
      nodeMap.get(t.parentTemplateId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
