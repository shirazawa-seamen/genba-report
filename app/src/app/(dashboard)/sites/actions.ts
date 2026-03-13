"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DocumentType } from "@/lib/types";

async function insertSiteWithFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
) {
  const workingPayload = { ...payload };
  let result = await supabase.from("sites").insert(workingPayload).select("id").single();

  if (result.error?.message?.includes("client_name")) {
    delete workingPayload.client_name;
    result = await supabase.from("sites").insert(workingPayload).select("id").single();
  }

  if (result.error?.message?.includes("company_id")) {
    delete workingPayload.company_id;
    result = await supabase.from("sites").insert(workingPayload).select("id").single();
  }

  if (result.error?.message?.includes("site_color")) {
    delete workingPayload.site_color;
    result = await supabase.from("sites").insert(workingPayload).select("id").single();
  }

  return result;
}

async function updateSiteWithFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  siteId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
) {
  const workingPayload = { ...payload };
  let result = await supabase.from("sites").update(workingPayload).eq("id", siteId);

  if (result.error?.message?.includes("client_name")) {
    delete workingPayload.client_name;
    result = await supabase.from("sites").update(workingPayload).eq("id", siteId);
  }

  if (result.error?.message?.includes("company_id")) {
    delete workingPayload.company_id;
    result = await supabase.from("sites").update(workingPayload).eq("id", siteId);
  }

  if (result.error?.message?.includes("site_color")) {
    delete workingPayload.site_color;
    result = await supabase.from("sites").update(workingPayload).eq("id", siteId);
  }

  return result;
}

export async function createSite(input: {
  name: string;
  siteNumber?: string;
  address: string;
  startDate?: string;
  endDate?: string;
  companyId?: string;
  siteColor?: string;
}): Promise<{ success: boolean; siteId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  let companyName: string | null = null;
  if (input.companyId) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", input.companyId)
      .maybeSingle();
    if (companyError && !companyError.message?.includes("companies")) {
      return { success: false, error: `会社情報の取得に失敗しました: ${companyError.message}` };
    }
    companyName = company?.name ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: Record<string, any> = {
    name: input.name.trim(),
    site_number: input.siteNumber?.trim() || null,
    address: input.address.trim(),
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    site_color: input.siteColor || "#0EA5E9",
    company_id: input.companyId || null,
  };
  if (companyName) {
    insertData.client_name = companyName;
  }

  const { data, error } = await insertSiteWithFallback(supabase, insertData);

  if (error) {
    return { success: false, error: `現場の登録に失敗しました: ${error.message}` };
  }

  revalidatePath("/sites");
  return { success: true, siteId: data.id };
}

// ---------------------------------------------------------------------------
// 現場情報更新
// ---------------------------------------------------------------------------
export async function updateSite(input: {
  siteId: string;
  name: string;
  siteNumber?: string;
  address: string;
  startDate?: string;
  endDate?: string;
  companyId?: string;
  siteColor?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  if (!input.name.trim()) {
    return { success: false, error: "現場名を入力してください" };
  }

  let companyName: string | null = null;
  if (input.companyId) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", input.companyId)
      .maybeSingle();
    if (companyError && !companyError.message?.includes("companies")) {
      return { success: false, error: `会社情報の取得に失敗しました: ${companyError.message}` };
    }
    companyName = company?.name ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    name: input.name.trim(),
    site_number: input.siteNumber?.trim() || null,
    address: input.address.trim(),
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    site_color: input.siteColor || "#0EA5E9",
    company_id: input.companyId || null,
  };
  updateData.client_name = companyName;

  const { error } = await updateSiteWithFallback(supabase, input.siteId, updateData);

  if (error) {
    return { success: false, error: `現場情報の更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
  return { success: true };
}

export async function saveSiteEditDraft(input: {
  siteId: string;
  name: string;
  siteNumber?: string;
  address: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  siteColor?: string;
  hasBlueprint: boolean;
  hasSpecification: boolean;
  hasPurchaseOrder: boolean;
  hasSchedule: boolean;
  isMonitor: boolean;
  processes: {
    id?: string;
    category: string;
    name: string;
  }[];
  workPeriods: {
    id?: string;
    startDate: string;
    endDate: string;
  }[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  if (!input.name.trim()) {
    return { success: false, error: "現場名を入力してください" };
  }

  const processKeys = new Set<string>();
  for (const process of input.processes) {
    const category = process.category.trim();
    const name = process.name.trim();
    if (!category || !name) {
      return { success: false, error: "工程種別と工程名を入力してください" };
    }
    const key = `${category}::${name}`;
    if (processKeys.has(key)) {
      return { success: false, error: `「${name}」が重複しています` };
    }
    processKeys.add(key);
  }

  for (const period of input.workPeriods) {
    if (!period.startDate || !period.endDate) {
      return { success: false, error: "稼働期間の日付を入力してください" };
    }
    if (period.startDate > period.endDate) {
      return { success: false, error: "稼働期間の日付の並びが不正です" };
    }
  }

  let companyName: string | null = null;
  if (input.companyId) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", input.companyId)
      .maybeSingle();
    if (companyError && !companyError.message?.includes("companies")) {
      return { success: false, error: `会社情報の取得に失敗しました: ${companyError.message}` };
    }
    companyName = company?.name ?? null;
  }

  const baseSiteUpdate: Record<string, string | boolean | null> = {
    name: input.name.trim(),
    site_number: input.siteNumber?.trim() || null,
    address: input.address.trim(),
    company_id: input.companyId || null,
    client_name: companyName,
    site_color: input.siteColor || "#0EA5E9",
    has_blueprint: input.hasBlueprint,
    has_specification: input.hasSpecification,
    has_purchase_order: input.hasPurchaseOrder,
    has_schedule: input.hasSchedule,
    is_monitor: input.isMonitor,
  };

  if (input.workPeriods.length === 0) {
    baseSiteUpdate.start_date = input.startDate || null;
    baseSiteUpdate.end_date = input.endDate || null;
  }

  const updateResult = await updateSiteWithFallback(
    supabase,
    input.siteId,
    baseSiteUpdate
  );
  const siteUpdateError = updateResult.error;

  if (siteUpdateError) {
    return {
      success: false,
      error: `現場情報の更新に失敗しました: ${siteUpdateError.message}`,
    };
  }

  const { data: existingProcesses, error: processFetchError } = await supabase
    .from("processes")
    .select("id, category, name")
    .eq("site_id", input.siteId)
    .order("order_index");

  if (processFetchError) {
    return { success: false, error: `工程の取得に失敗しました: ${processFetchError.message}` };
  }

  const existingProcessRows = existingProcesses ?? [];
  const draftProcessIds = new Set(
    input.processes.map((process) => process.id).filter((id): id is string => Boolean(id))
  );
  const processIdsToDelete = existingProcessRows
    .filter((process) => !draftProcessIds.has(process.id))
    .map((process) => process.id);

  for (const processId of processIdsToDelete) {
    const { count, error: reportCountError } = await supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("process_id", processId);

    if (reportCountError) {
      return { success: false, error: "工程に紐づく報告の確認に失敗しました" };
    }

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: "報告が紐づく工程は削除できません",
      };
    }
  }

  for (const [index, process] of input.processes.entries()) {
    const payload = {
      category: process.category.trim(),
      name: process.name.trim(),
      order_index: index + 1,
    };

    if (process.id) {
      const { error: updateProcessError } = await supabase
        .from("processes")
        .update(payload)
        .eq("id", process.id)
        .eq("site_id", input.siteId);

      if (updateProcessError) {
        if (updateProcessError.code === "23505") {
          return { success: false, error: "同じ工程が重複しています" };
        }
        return {
          success: false,
          error: `工程の更新に失敗しました: ${updateProcessError.message}`,
        };
      }
      continue;
    }

    const { error: insertProcessError } = await supabase
      .from("processes")
      .insert({
        site_id: input.siteId,
        ...payload,
      });

    if (insertProcessError) {
      if (insertProcessError.code === "23505") {
        return { success: false, error: "同じ工程が重複しています" };
      }
      return {
        success: false,
        error: `工程の追加に失敗しました: ${insertProcessError.message}`,
      };
    }
  }

  if (processIdsToDelete.length > 0) {
    const { error: deleteProcessError } = await supabase
      .from("processes")
      .delete()
      .in("id", processIdsToDelete);

    if (deleteProcessError) {
      return {
        success: false,
        error: `工程の削除に失敗しました: ${deleteProcessError.message}`,
      };
    }
  }

  const { data: existingPeriods, error: periodFetchError } = await supabase
    .from("site_work_periods")
    .select("id")
    .eq("site_id", input.siteId)
    .order("start_date");

  if (periodFetchError) {
    return { success: false, error: `稼働期間の取得に失敗しました: ${periodFetchError.message}` };
  }

  const draftPeriodIds = new Set(
    input.workPeriods.map((period) => period.id).filter((id): id is string => Boolean(id))
  );
  const periodIdsToDelete = (existingPeriods ?? [])
    .filter((period) => !draftPeriodIds.has(period.id))
    .map((period) => period.id);

  for (const period of input.workPeriods) {
    const payload = {
      start_date: period.startDate,
      end_date: period.endDate,
    };

    if (period.id) {
      const { error: updatePeriodError } = await supabase
        .from("site_work_periods")
        .update(payload)
        .eq("id", period.id)
        .eq("site_id", input.siteId);

      if (updatePeriodError) {
        return {
          success: false,
          error: `稼働期間の更新に失敗しました: ${updatePeriodError.message}`,
        };
      }
      continue;
    }

    const { error: insertPeriodError } = await supabase
      .from("site_work_periods")
      .insert({
        site_id: input.siteId,
        ...payload,
      });

    if (insertPeriodError) {
      return {
        success: false,
        error: `稼働期間の追加に失敗しました: ${insertPeriodError.message}`,
      };
    }
  }

  if (periodIdsToDelete.length > 0) {
    const { error: deletePeriodError } = await supabase
      .from("site_work_periods")
      .delete()
      .in("id", periodIdsToDelete);

    if (deletePeriodError) {
      return {
        success: false,
        error: `稼働期間の削除に失敗しました: ${deletePeriodError.message}`,
      };
    }
  }

  if (input.workPeriods.length > 0) {
    await syncSiteDatesFromPeriods(supabase, input.siteId);
  } else {
    const { error: syncSiteDateError } = await supabase
      .from("sites")
      .update({
        start_date: input.startDate || null,
        end_date: input.endDate || null,
      })
      .eq("id", input.siteId);

    if (syncSiteDateError) {
      return {
        success: false,
        error: `現場日付の更新に失敗しました: ${syncSiteDateError.message}`,
      };
    }
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
  revalidatePath("/calendar");
  revalidatePath("/reports/new");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 現場削除
// ---------------------------------------------------------------------------
export async function deleteSite(
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  // 関連する報告の写真・材料を先に削除（FK制約対応）
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("site_id", siteId);

  if (reports && reports.length > 0) {
    const reportIds = reports.map((r) => r.id);
    await supabase.from("report_photos").delete().in("report_id", reportIds);
    await supabase.from("report_materials").delete().in("report_id", reportIds);
    await supabase.from("daily_reports").delete().eq("site_id", siteId);
  }

  // 関連データを削除
  await supabase.from("processes").delete().eq("site_id", siteId);
  await supabase.from("site_documents").delete().eq("site_id", siteId);
  await supabase.from("site_members").delete().eq("site_id", siteId);

  const { error } = await supabase
    .from("sites")
    .delete()
    .eq("id", siteId);

  if (error) {
    console.error("Site delete error:", error);
    return { success: false, error: `現場の削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/sites");
  return { success: true };
}

// ---------------------------------------------------------------------------
// セットアップチェック更新
// ---------------------------------------------------------------------------
export async function updateSetupCheck(
  siteId: string,
  field: "has_blueprint" | "has_specification" | "has_purchase_order" | "has_schedule" | "is_monitor",
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { error } = await supabase
    .from("sites")
    .update({ [field]: value })
    .eq("id", siteId);

  if (error) {
    return { success: false, error: "更新に失敗しました" };
  }

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 現場メンバー一覧取得
// ---------------------------------------------------------------------------
export async function getSiteMembers(siteId: string): Promise<{
  success: boolean;
  members?: { id: string; userId: string; name: string; role: string; createdAt: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data, error } = await supabase
    .from("site_members")
    .select("id, user_id, created_at")
    .eq("site_id", siteId)
    .order("created_at");

  if (error) return { success: false, error: "メンバーの取得に失敗しました" };

  const userIds = (data ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const members = (data ?? []).map((member) => {
    const profile = profileMap.get(member.user_id);
    return {
      id: member.id,
      userId: member.user_id,
      name: profile?.full_name || "不明",
      role: profile?.role || "worker_external",
      createdAt: member.created_at,
    };
  });

  return { success: true, members };
}

// ---------------------------------------------------------------------------
// 現場メンバー追加（外注職人を現場に招待）
// ---------------------------------------------------------------------------
export async function addSiteMember(
  siteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { error } = await supabase
    .from("site_members")
    .insert({ site_id: siteId, user_id: userId, invited_by: user.id });

  if (error) {
    if (error.code === "23505") return { success: false, error: "このユーザーは既に追加されています" };
    return { success: false, error: "メンバーの追加に失敗しました" };
  }

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

export async function addSiteMembers(
  siteId: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };
  if (userIds.length === 0) return { success: false, error: "招待対象がありません" };

  const uniqueUserIds = [...new Set(userIds)];
  const { error } = await supabase
    .from("site_members")
    .insert(
      uniqueUserIds.map((userId) => ({
        site_id: siteId,
        user_id: userId,
        invited_by: user.id,
      }))
    );

  if (error) {
    if (error.code === "23505") return { success: false, error: "選択した一部ユーザーは既に追加されています" };
    return { success: false, error: "メンバーの追加に失敗しました" };
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 現場メンバー削除
// ---------------------------------------------------------------------------
export async function removeSiteMember(
  memberId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { error } = await supabase
    .from("site_members")
    .delete()
    .eq("id", memberId);

  if (error) return { success: false, error: "メンバーの削除に失敗しました" };

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 招待可能なユーザー一覧取得（全ロール対応）
// ---------------------------------------------------------------------------
export async function getInvitableUsers(siteId: string): Promise<{
  success: boolean;
  users?: { id: string; name: string; role: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: site } = await supabase
    .from("sites")
    .select("company_id")
    .eq("id", siteId)
    .maybeSingle();

  // 既にメンバーのユーザーIDを取得
  const { data: existingMembers } = await supabase
    .from("site_members")
    .select("user_id")
    .eq("site_id", siteId);
  const existingIds = new Set((existingMembers ?? []).map((m) => m.user_id));

  // 全ロールのアクティブユーザーを取得（自分自身を除く）
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("is_active", true);

  if (error) return { success: false, error: "ユーザーの取得に失敗しました" };

  const users = (profiles ?? [])
    .filter((p) => !existingIds.has(p.id) && p.id !== user.id)
    .filter((p) => {
      if (p.role !== "client") return true;
      // company_id が設定されている場合のみ会社で絞り込み
      if (site?.company_id) return p.company_id === site.company_id;
      // company_id 未設定の現場にはすべてのクライアントを招待可能
      return true;
    })
    .map((p) => ({ id: p.id, name: p.full_name || "名前未設定", role: p.role }));

  return { success: true, users };
}

// ---------------------------------------------------------------------------
// ドキュメント一覧取得
// ---------------------------------------------------------------------------
export async function getSiteDocuments(siteId: string): Promise<{
  success: boolean;
  documents?: {
    id: string;
    document_type: string;
    title: string;
    description: string | null;
    storage_path: string;
    file_name: string;
    file_size: number | null;
    version: number;
    created_at: string;
  }[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data, error } = await supabase
    .from("site_documents")
    .select("id, document_type, title, description, storage_path, file_name, file_size, version, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: "ドキュメントの取得に失敗しました" };
  }

  return { success: true, documents: data };
}

// ---------------------------------------------------------------------------
// ドキュメントアップロード用URL生成
// ---------------------------------------------------------------------------
export async function getUploadUrl(
  siteId: string,
  fileName: string,
  documentType: DocumentType
): Promise<{
  success: boolean;
  uploadUrl?: string;
  storagePath?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `site-documents/${siteId}/${documentType}/${timestamp}-${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from("site-documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return { success: false, error: "アップロードURLの生成に失敗しました" };
  }

  return {
    success: true,
    uploadUrl: data.signedUrl,
    storagePath,
  };
}

// ---------------------------------------------------------------------------
// ドキュメント作成
// ---------------------------------------------------------------------------
export async function createSiteDocument(input: {
  siteId: string;
  documentType: DocumentType;
  title: string;
  description?: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
}): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data, error } = await supabase
    .from("site_documents")
    .insert({
      site_id: input.siteId,
      document_type: input.documentType,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "ドキュメントの登録に失敗しました" };
  }

  // 対応するセットアップチェックを自動でオンにする
  const fieldMap: Record<DocumentType, string> = {
    blueprint: "has_blueprint",
    specification: "has_specification",
    purchase_order: "has_purchase_order",
    schedule: "has_schedule",
    other: "",
  };

  const field = fieldMap[input.documentType];
  if (field) {
    await supabase
      .from("sites")
      .update({ [field]: true })
      .eq("id", input.siteId);
  }

  revalidatePath(`/sites/${input.siteId}`);
  return { success: true, documentId: data.id };
}

// ---------------------------------------------------------------------------
// ドキュメント削除
// ---------------------------------------------------------------------------
export async function deleteSiteDocument(
  documentId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  // ドキュメント情報を取得してstorage_pathを得る
  const { data: doc } = await supabase
    .from("site_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  // ストレージから削除
  if (doc?.storage_path) {
    await supabase.storage.from("site-documents").remove([doc.storage_path]);
  }

  // DBから削除
  const { error } = await supabase
    .from("site_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    return { success: false, error: "ドキュメントの削除に失敗しました" };
  }

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// ドキュメントダウンロードURL取得
// ---------------------------------------------------------------------------
export async function getDownloadUrl(
  storagePath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data, error } = await supabase.storage
    .from("site-documents")
    .createSignedUrl(storagePath, 3600); // 1時間有効

  if (error || !data) {
    return { success: false, error: "ダウンロードURLの生成に失敗しました" };
  }

  return { success: true, url: data.signedUrl };
}

// ---------------------------------------------------------------------------
// 使用材料一覧取得（現場単位）
// ---------------------------------------------------------------------------
export async function getSiteMaterials(siteId: string): Promise<{
  success: boolean;
  materials?: {
    id: string;
    material_name: string;
    product_number: string | null;
    quantity: number | null;
    unit: string | null;
    supplier: string | null;
    note: string | null;
    created_at: string;
  }[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data, error } = await supabase
    .from("site_materials")
    .select("id, material_name, product_number, quantity, unit, supplier, note, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) {
    return { success: false, error: "材料の取得に失敗しました" };
  }

  return { success: true, materials: data };
}

// ---------------------------------------------------------------------------
// 使用材料追加（現場単位）
// ---------------------------------------------------------------------------
export async function addSiteMaterial(input: {
  siteId: string;
  materialName: string;
  productNumber?: string;
  quantity?: number;
  unit?: string;
  supplier?: string;
  note?: string;
}): Promise<{ success: boolean; materialId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  if (!input.materialName.trim()) {
    return { success: false, error: "材料名を入力してください" };
  }

  const { data, error } = await supabase
    .from("site_materials")
    .insert({
      site_id: input.siteId,
      material_name: input.materialName.trim(),
      product_number: input.productNumber?.trim() || null,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() || null,
      supplier: input.supplier?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "材料の追加に失敗しました" };
  }

  revalidatePath(`/sites/${input.siteId}`);
  return { success: true, materialId: data.id };
}

// ---------------------------------------------------------------------------
// 使用材料削除（現場単位）
// ---------------------------------------------------------------------------
export async function deleteSiteMaterial(
  materialId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { error } = await supabase
    .from("site_materials")
    .delete()
    .eq("id", materialId);

  if (error) {
    return { success: false, error: "材料の削除に失敗しました" };
  }

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 現場ステータス更新（完了/稼働中の切り替え）
// ---------------------------------------------------------------------------
export async function updateSiteStatus(
  siteId: string,
  status: "active" | "completed"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("sites")
    .update({ status })
    .eq("id", siteId);

  if (error) {
    return { success: false, error: `ステータスの更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/calendar");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 稼働期間の一覧取得
// ---------------------------------------------------------------------------
export async function getSiteWorkPeriods(siteId: string): Promise<{
  success: boolean;
  periods?: { id: string; startDate: string; endDate: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data, error } = await supabase
    .from("site_work_periods")
    .select("id, start_date, end_date")
    .eq("site_id", siteId)
    .order("start_date");

  if (error) return { success: false, error: "稼働期間の取得に失敗しました" };

  return {
    success: true,
    periods: (data ?? []).map((p) => ({ id: p.id, startDate: p.start_date, endDate: p.end_date })),
  };
}

// ---------------------------------------------------------------------------
// 稼働期間の追加
// ---------------------------------------------------------------------------
export async function addSiteWorkPeriod(input: {
  siteId: string;
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; periodId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { data, error } = await supabase
    .from("site_work_periods")
    .insert({ site_id: input.siteId, start_date: input.startDate, end_date: input.endDate })
    .select("id")
    .single();

  if (error) return { success: false, error: `稼働期間の追加に失敗しました: ${error.message}` };

  // Update site start/end dates based on all periods
  await syncSiteDatesFromPeriods(supabase, input.siteId);

  revalidatePath("/calendar");
  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
  return { success: true, periodId: data.id };
}

// ---------------------------------------------------------------------------
// 稼働期間の更新
// ---------------------------------------------------------------------------
export async function updateSiteWorkPeriod(input: {
  periodId: string;
  siteId: string;
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("site_work_periods")
    .update({ start_date: input.startDate, end_date: input.endDate })
    .eq("id", input.periodId);

  if (error) return { success: false, error: `稼働期間の更新に失敗しました: ${error.message}` };

  await syncSiteDatesFromPeriods(supabase, input.siteId);

  revalidatePath("/calendar");
  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 稼働期間の削除
// ---------------------------------------------------------------------------
export async function deleteSiteWorkPeriod(
  periodId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("site_work_periods")
    .delete()
    .eq("id", periodId);

  if (error) return { success: false, error: "稼働期間の削除に失敗しました" };

  await syncSiteDatesFromPeriods(supabase, siteId);

  revalidatePath("/calendar");
  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Helper: Sync site start_date/end_date from work periods
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSiteDatesFromPeriods(supabase: any, siteId: string) {
  const { data: periods } = await supabase
    .from("site_work_periods")
    .select("start_date, end_date")
    .eq("site_id", siteId)
    .order("start_date");

  if (periods && periods.length > 0) {
    const firstStart = periods[0].start_date;
    const lastEnd = periods[periods.length - 1].end_date;
    await supabase.from("sites").update({ start_date: firstStart, end_date: lastEnd }).eq("id", siteId);
  }
}

// ---------------------------------------------------------------------------
// 工程一覧取得
// ---------------------------------------------------------------------------
export async function getSiteProcesses(siteId: string): Promise<{
  success: boolean;
  processes?: { id: string; category: string; name: string; orderIndex: number; progressRate: number; status: string; createdAt: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  let data: {
    id: string;
    category: string;
    name: string;
    order_index?: number;
    progress_rate: number;
    status: string;
    created_at: string;
  }[] | null = null;
  let error: Error | null = null;

  const primary = await supabase
    .from("processes")
    .select("id, category, name, order_index, progress_rate, status, created_at")
    .eq("site_id", siteId)
    .order("order_index");

  data = primary.data;
  error = primary.error;

  if (error?.message?.includes("order_index")) {
    const fallback = await supabase
      .from("processes")
      .select("id, category, name, progress_rate, status, created_at")
      .eq("site_id", siteId)
      .order("category")
      .order("name");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return { success: false, error: "工程の取得に失敗しました" };

  return {
    success: true,
    processes: (data ?? []).map((p) => ({
      id: p.id,
      category: p.category,
      name: p.name,
      orderIndex: "order_index" in p ? (p.order_index ?? 0) : 0,
      progressRate: p.progress_rate,
      status: p.status,
      createdAt: p.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// 工程追加
// ---------------------------------------------------------------------------
export async function addSiteProcess(input: {
  siteId: string;
  category: string;
  name: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; processId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  if (!input.name.trim()) return { success: false, error: "工程名を入力してください" };

  let orderIndex = 1;
  const existingResult = await supabase
    .from("processes")
    .select("id, order_index")
    .eq("site_id", input.siteId)
    .order("order_index");

  if (!existingResult.error) {
    const existing = existingResult.data ?? [];
    const insertAt = Math.max(0, Math.min(input.insertAtIndex ?? existing.length, existing.length));
    orderIndex = insertAt + 1;

    for (let index = insertAt; index < existing.length; index += 1) {
      const row = existing[index];
      await supabase
        .from("processes")
        .update({ order_index: index + 2 })
        .eq("id", row.id);
    }
  }

  const { data, error } = await supabase
    .from("processes")
    .insert({ site_id: input.siteId, category: input.category, name: input.name.trim(), order_index: orderIndex })
    .select("id")
    .single();

  if (error) {
    if (error.message?.includes("order_index")) {
      const fallback = await supabase
        .from("processes")
        .insert({ site_id: input.siteId, category: input.category, name: input.name.trim() })
        .select("id")
        .single();
      if (fallback.error) {
        if (fallback.error.code === "23505") return { success: false, error: "同じ工程が既に存在します" };
        return { success: false, error: `工程の追加に失敗しました: ${fallback.error.message}` };
      }
      revalidatePath(`/sites/${input.siteId}`);
      return { success: true, processId: fallback.data.id };
    }
    if (error.code === "23505") return { success: false, error: "同じ工程が既に存在します" };
    return { success: false, error: `工程の追加に失敗しました: ${error.message}` };
  }

  revalidatePath(`/sites/${input.siteId}`);
  return { success: true, processId: data.id };
}

export async function moveSiteProcess(input: {
  siteId: string;
  processId: string;
  direction: "up" | "down";
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { data, error } = await supabase
    .from("processes")
    .select("id, order_index")
    .eq("site_id", input.siteId)
    .order("order_index");

  if (error) {
    return { success: false, error: "工程の並び替えに失敗しました" };
  }

  const rows = data ?? [];
  const currentIndex = rows.findIndex((row) => row.id === input.processId);
  if (currentIndex === -1) return { success: false, error: "工程が見つかりません" };

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) return { success: true };

  const current = rows[currentIndex];
  const target = rows[targetIndex];

  const firstUpdate = await supabase
    .from("processes")
    .update({ order_index: -1 })
    .eq("id", current.id);
  if (firstUpdate.error) return { success: false, error: `工程の並び替えに失敗しました: ${firstUpdate.error.message}` };

  const secondUpdate = await supabase
    .from("processes")
    .update({ order_index: current.order_index })
    .eq("id", target.id);
  if (secondUpdate.error) return { success: false, error: `工程の並び替えに失敗しました: ${secondUpdate.error.message}` };

  const thirdUpdate = await supabase
    .from("processes")
    .update({ order_index: target.order_index })
    .eq("id", current.id);
  if (thirdUpdate.error) return { success: false, error: `工程の並び替えに失敗しました: ${thirdUpdate.error.message}` };

  revalidatePath(`/sites/${input.siteId}`);
  revalidatePath("/reports/new");
  return { success: true };
}

export async function reorderSiteProcesses(input: {
  siteId: string;
  orderedProcessIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { data, error } = await supabase
    .from("processes")
    .select("id, order_index")
    .eq("site_id", input.siteId)
    .order("order_index");

  if (error) {
    if (error.message?.includes("order_index")) {
      return { success: false, error: "並び順の保存に必要な列がありません。migration_v10_process_template_master.sql を適用してください" };
    }
    return { success: false, error: `工程の並び替えに失敗しました: ${error.message}` };
  }

  const existingIds = (data ?? []).map((row) => row.id);
  if (
    existingIds.length !== input.orderedProcessIds.length ||
    existingIds.some((id) => !input.orderedProcessIds.includes(id))
  ) {
    return { success: false, error: "工程一覧が最新ではありません。再読み込みしてください" };
  }

  const rows = (data ?? []).map((row, index) => ({
    id: row.id,
    orderIndex:
      typeof row.order_index === "number" && row.order_index > 0
        ? row.order_index
        : index + 1,
  }));

  const swapRows = async (firstId: string, secondId: string, firstOrder: number, secondOrder: number) => {
    const firstUpdate = await supabase
      .from("processes")
      .update({ order_index: -1 })
      .eq("id", firstId)
      .eq("site_id", input.siteId);

    if (firstUpdate.error) {
      return firstUpdate.error.message?.includes("order_index")
        ? "並び順の保存に必要な列がありません"
        : `工程の並び替えに失敗しました: ${firstUpdate.error.message}`;
    }

    const secondUpdate = await supabase
      .from("processes")
      .update({ order_index: firstOrder })
      .eq("id", secondId)
      .eq("site_id", input.siteId);

    if (secondUpdate.error) {
      return secondUpdate.error.message?.includes("order_index")
        ? "並び順の保存に必要な列がありません"
        : `工程の並び替えに失敗しました: ${secondUpdate.error.message}`;
    }

    const thirdUpdate = await supabase
      .from("processes")
      .update({ order_index: secondOrder })
      .eq("id", firstId)
      .eq("site_id", input.siteId);

    if (thirdUpdate.error) {
      return thirdUpdate.error.message?.includes("order_index")
        ? "並び順の保存に必要な列がありません"
        : `工程の並び替えに失敗しました: ${thirdUpdate.error.message}`;
    }

    return null;
  };

  for (let targetIndex = 0; targetIndex < input.orderedProcessIds.length; targetIndex += 1) {
    const processId = input.orderedProcessIds[targetIndex];
    let currentIndex = rows.findIndex((row) => row.id === processId);

    while (currentIndex > targetIndex) {
      const currentRow = rows[currentIndex];
      const previousRow = rows[currentIndex - 1];
      const swapError = await swapRows(
        currentRow.id,
        previousRow.id,
        currentRow.orderIndex,
        previousRow.orderIndex
      );

      if (swapError) {
        return { success: false, error: swapError };
      }

      rows[currentIndex] = previousRow;
      rows[currentIndex - 1] = currentRow;
      rows[currentIndex].orderIndex = currentIndex + 1;
      rows[currentIndex - 1].orderIndex = currentIndex;
      currentIndex -= 1;
    }
  }

  revalidatePath(`/sites/${input.siteId}`);
  revalidatePath("/reports/new");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 工程更新（名前・カテゴリ変更）
// ---------------------------------------------------------------------------
export async function updateSiteProcess(input: {
  processId: string;
  siteId: string;
  category: string;
  name: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  if (!input.name.trim()) return { success: false, error: "工程名を入力してください" };

  const { error } = await supabase
    .from("processes")
    .update({ category: input.category, name: input.name.trim() })
    .eq("id", input.processId);

  if (error) {
    if (error.code === "23505") return { success: false, error: "同じ工程が既に存在します" };
    return { success: false, error: `工程の更新に失敗しました: ${error.message}` };
  }

  revalidatePath(`/sites/${input.siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 工程削除
// ---------------------------------------------------------------------------
export async function deleteSiteProcess(
  processId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  // 関連する報告があるか確認
  const { count } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("process_id", processId);

  if (count && count > 0) {
    return { success: false, error: `この工程には${count}件の報告が紐づいているため削除できません` };
  }

  const { error } = await supabase
    .from("processes")
    .delete()
    .eq("id", processId);

  if (error) return { success: false, error: "工程の削除に失敗しました" };

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Gantt用: 現場日程のみ更新
// ---------------------------------------------------------------------------
export async function updateSiteDates(input: {
  siteId: string;
  startDate: string | null;
  endDate: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "認証エラー" };

  // admin or manager only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      start_date: input.startDate || null,
      end_date: input.endDate || null,
    })
    .eq("id", input.siteId);

  if (error) {
    return { success: false, error: "日程の更新に失敗しました" };
  }

  revalidatePath("/calendar");
  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
  return { success: true };
}
