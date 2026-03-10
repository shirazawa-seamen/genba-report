"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DocumentType } from "@/lib/types";

export async function createSite(input: {
  name: string;
  siteNumber?: string;
  address: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; siteId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  const { data, error } = await supabase
    .from("sites")
    .insert({
      name: input.name.trim(),
      site_number: input.siteNumber?.trim() || null,
      address: input.address.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "現場の登録に失敗しました" };
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

  const { error } = await supabase
    .from("sites")
    .update({
      name: input.name.trim(),
      site_number: input.siteNumber?.trim() || null,
      address: input.address.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
    })
    .eq("id", input.siteId);

  if (error) {
    return { success: false, error: "現場情報の更新に失敗しました" };
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${input.siteId}`);
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

  // 関連する報告があるか確認
  const { count } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId);

  if (count && count > 0) {
    return { success: false, error: `この現場には ${count} 件の報告があるため削除できません。先に報告を削除してください。` };
  }

  const { error } = await supabase
    .from("sites")
    .delete()
    .eq("id", siteId);

  if (error) {
    return { success: false, error: "現場の削除に失敗しました" };
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
