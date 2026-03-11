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
}

export async function listProcessTemplates(): Promise<ProcessTemplateRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("process_templates")
    .select("id, phase_key, process_code, category, name, parallel_group, sort_order")
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
  }));
}
