import { createClient } from "@/lib/supabase/server";
import { WORK_PROCESS_OPTIONS } from "@/lib/constants";

export interface ProcessCategoryRecord {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export async function listProcessCategories(): Promise<ProcessCategoryRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("process_categories")
    .select("id, value, label, sort_order")
    .order("sort_order");

  if (error) {
    if (error.message?.includes("process_categories") || error.message?.includes("schema cache")) {
      return WORK_PROCESS_OPTIONS.map((option, index) => ({
        id: `fallback-${index + 1}`,
        value: option.value,
        label: option.label,
        sortOrder: index + 1,
      }));
    }
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    value: item.value,
    label: item.label,
    sortOrder: item.sort_order,
  }));
}
