"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdminOrManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      user: null,
      error: "認証エラー",
    };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return {
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      user: null,
      error: "権限がありません",
    };
  }

  return { supabase, user, error: null as string | null };
}

export async function getMaterialCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_catalog")
    .select("*")
    .order("category", { ascending: true })
    .order("material_name", { ascending: true });

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data ?? [] };
}

export async function addMaterialCatalogItem(input: {
  materialName: string;
  productNumber?: string;
  unit?: string;
  supplier?: string;
  category?: string;
  note?: string;
  companyId?: string;
}) {
  const context = await requireAdminOrManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  const { error } = await context.supabase.from("material_catalog").insert({
    material_name: input.materialName.trim(),
    product_number: input.productNumber?.trim() || null,
    unit: input.unit?.trim() || null,
    supplier: input.supplier?.trim() || null,
    category: input.category?.trim() || null,
    note: input.note?.trim() || null,
    company_id: input.companyId || null,
  });

  if (error) {
    return { success: false, error: `材料の追加に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/materials");
  return { success: true };
}

export async function updateMaterialCatalogItem(
  id: string,
  input: {
    materialName: string;
    productNumber?: string;
    unit?: string;
    supplier?: string;
    category?: string;
    note?: string;
  }
) {
  const context = await requireAdminOrManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  const { error } = await context.supabase
    .from("material_catalog")
    .update({
      material_name: input.materialName.trim(),
      product_number: input.productNumber?.trim() || null,
      unit: input.unit?.trim() || null,
      supplier: input.supplier?.trim() || null,
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/materials");
  return { success: true };
}

export async function deleteMaterialCatalogItem(id: string) {
  const context = await requireAdminOrManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  const { error } = await context.supabase
    .from("material_catalog")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/materials");
  return { success: true };
}
