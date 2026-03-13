import { createClient } from "@/lib/supabase/server";

export interface CompanyRecord {
  id: string;
  name: string;
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  if (error?.message?.includes("companies")) {
    return [];
  }

  if (error) {
    throw error;
  }

  return data ?? [];
}
