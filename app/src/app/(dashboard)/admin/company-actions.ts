"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listCompanies } from "@/lib/companies";

function formatCompanyActionError(message: string, fallback: string) {
  if (message.includes("companies") || message.includes("schema cache")) {
    return "会社マスターが未初期化です。Supabase に migration_v14_companies.sql を適用してください";
  }
  return `${fallback}: ${message}`;
}

async function requireCompanyManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      error: "認証エラー",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return {
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      error: "権限がありません",
    };
  }

  return { supabase, error: null as string | null };
}

async function revalidateCompanyPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  revalidatePath("/sites");
}

export async function createCompany(name: string) {
  const context = await requireCompanyManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "会社名を入力してください" };
  }

  const { error } = await supabase.from("companies").insert({ name: trimmedName });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "同じ会社名がすでに登録されています" };
    }
    return {
      success: false,
      error: formatCompanyActionError(error.message, "会社名の追加に失敗しました"),
    };
  }

  await revalidateCompanyPages();
  return { success: true, companies: await listCompanies() };
}

export async function updateCompany(input: { companyId: string; name: string }) {
  const context = await requireCompanyManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { success: false, error: "会社名を入力してください" };
  }

  const { error } = await supabase
    .from("companies")
    .update({ name: trimmedName })
    .eq("id", input.companyId);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "同じ会社名がすでに登録されています" };
    }
    return {
      success: false,
      error: formatCompanyActionError(error.message, "会社名の更新に失敗しました"),
    };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", input.companyId)
    .maybeSingle();

  if (company?.name) {
    await Promise.all([
      supabase.from("sites").update({ client_name: company.name }).eq("company_id", input.companyId),
      supabase.from("profiles").update({ name: company.name }).eq("company_id", input.companyId).eq("role", "client"),
    ]);
  }

  await revalidateCompanyPages();
  return { success: true, companies: await listCompanies() };
}

export async function deleteCompany(companyId: string) {
  const context = await requireCompanyManager();
  if (!context.supabase) return { success: false, error: context.error };
  const supabase = context.supabase;

  const [{ count: siteCount, error: siteError }, { count: profileCount, error: profileError }] =
    await Promise.all([
      supabase.from("sites").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    ]);

  if (siteError) {
    return {
      success: false,
      error: formatCompanyActionError(siteError.message, "会社の使用状況確認に失敗しました"),
    };
  }

  if (profileError) {
    return {
      success: false,
      error: formatCompanyActionError(profileError.message, "会社の使用状況確認に失敗しました"),
    };
  }

  if ((siteCount ?? 0) > 0 || (profileCount ?? 0) > 0) {
    return {
      success: false,
      error: "ユーザーまたは現場で使用中の会社は削除できません",
    };
  }

  const { error } = await supabase.from("companies").delete().eq("id", companyId);

  if (error) {
    return {
      success: false,
      error: formatCompanyActionError(error.message, "会社名の削除に失敗しました"),
    };
  }

  await revalidateCompanyPages();
  return { success: true, companies: await listCompanies() };
}
