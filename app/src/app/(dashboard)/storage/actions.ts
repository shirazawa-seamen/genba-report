"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { StorageFolder, FolderVisibility } from "@/lib/types";

// ---------------------------------------------------------------------------
// 共通ヘルパー: ユーザー認証 + プロフィール取得
// ---------------------------------------------------------------------------
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { supabase, user, profile };
}

// ---------------------------------------------------------------------------
// 共通ヘルパー: ユーザーが指定 site_id にアクセス可能か検証
// admin/manager は全現場アクセス可、worker/client は site_members で検証
// ---------------------------------------------------------------------------
async function canAccessSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string,
  siteId: string
): Promise<boolean> {
  if (role === "admin" || role === "manager") return true;
  const { data } = await supabase
    .from("site_members")
    .select("id")
    .eq("user_id", userId)
    .eq("site_id", siteId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// 共通ヘルパー: フォルダの site_id を取得し、アクセス権を検証
// ---------------------------------------------------------------------------
async function canAccessFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string,
  folderId: string
): Promise<{ allowed: boolean; folder?: { id: string; site_id: string | null; folder_type: string; visibility: string } }> {
  const { data: folder } = await supabase
    .from("storage_folders")
    .select("id, site_id, folder_type, visibility")
    .eq("id", folderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!folder) return { allowed: false };

  // company フォルダ（site_id = null）は認証済みユーザーなら閲覧可（中身は別途フィルタ）
  if (!folder.site_id) return { allowed: true, folder };

  // client は visibility='all' のフォルダのみ
  if (role === "client" && folder.visibility !== "all") return { allowed: false };

  const allowed = await canAccessSite(supabase, userId, role, folder.site_id);
  return { allowed, folder };
}

// ---------------------------------------------------------------------------
// ルートフォルダ一覧（サイトルートフォルダ）取得
// ---------------------------------------------------------------------------
export async function getRootFolders(): Promise<{
  success: boolean;
  folders?: (StorageFolder & { site_name?: string; client_name?: string | null })[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  // ユーザーのロールを取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { success: false, error: "プロフィール取得エラー" };

  // 会社フォルダがあればそれをルートに表示、なければ site_root を表示
  let query = supabase
    .from("storage_folders")
    .select("*")
    .in("folder_type", ["company", "site_root"])
    .is("parent_folder_id", null)
    .is("deleted_at", null)
    .order("name");

  // worker / client は担当現場に関連する会社フォルダ（+ 親なし site_root）を表示
  if (["worker_internal", "worker_external", "client"].includes(profile.role)) {
    const { data: memberSites } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", user.id);
    const siteIds = memberSites?.map((m) => m.site_id) ?? [];
    if (siteIds.length === 0) {
      return { success: true, folders: [] };
    }

    // 担当現場の site_root フォルダを取得
    let siteQuery = supabase
      .from("storage_folders")
      .select("*")
      .eq("folder_type", "site_root")
      .in("site_id", siteIds)
      .is("deleted_at", null);

    if (profile.role === "client") {
      siteQuery = siteQuery.eq("visibility", "all");
    }

    const { data: siteRoots, error: siteError } = await siteQuery;
    if (siteError) {
      return { success: false, error: `フォルダの取得に失敗しました: ${siteError.message}` };
    }

    // 親会社フォルダIDを収集
    const companyFolderIds = [...new Set(
      (siteRoots ?? []).map((d) => d.parent_folder_id).filter(Boolean)
    )] as string[];

    // 親なし site_root（会社フォルダに属さないもの）
    const orphanRoots = (siteRoots ?? []).filter((d) => !d.parent_folder_id);

    // 会社フォルダを取得
    let companyFolders: typeof orphanRoots = [];
    if (companyFolderIds.length > 0) {
      const { data: cFolders } = await supabase
        .from("storage_folders")
        .select("*")
        .in("id", companyFolderIds)
        .is("deleted_at", null)
        .order("name");
      companyFolders = cFolders ?? [];
    }

    const allFolders = [...companyFolders, ...orphanRoots].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // クライアント名を取得
    const folderSiteIds = [...new Set(allFolders.map((d) => d.site_id).filter(Boolean))];
    const clientMap2 = new Map<string, string>();
    if (folderSiteIds.length > 0) {
      const { data: sites } = await supabase
        .from("sites")
        .select("id, client_name")
        .in("id", folderSiteIds);
      for (const s of sites ?? []) {
        if (s.client_name) clientMap2.set(s.id, s.client_name);
      }
    }

    const folders = allFolders.map((d) => ({
      id: d.id,
      workspace_id: d.workspace_id,
      site_id: d.site_id,
      parent_folder_id: d.parent_folder_id,
      name: d.name,
      path: d.path,
      visibility: d.visibility as FolderVisibility,
      folder_type: d.folder_type as StorageFolder["folder_type"],
      created_by: d.created_by,
      created_at: d.created_at,
      updated_at: d.updated_at,
      deleted_at: d.deleted_at,
      site_name: d.name,
      client_name: d.site_id ? clientMap2.get(d.site_id) ?? null : null,
    }));

    return { success: true, folders };
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: `フォルダの取得に失敗しました: ${error.message}` };
  }

  // サイトのクライアント名を取得
  const siteIds = [...new Set((data ?? []).map((d) => d.site_id).filter(Boolean))];
  const clientMap = new Map<string, string>();
  if (siteIds.length > 0) {
    const { data: sites } = await supabase
      .from("sites")
      .select("id, client_name")
      .in("id", siteIds);
    for (const s of sites ?? []) {
      if (s.client_name) clientMap.set(s.id, s.client_name);
    }
  }

  const folders = (data ?? []).map((d) => ({
    id: d.id,
    workspace_id: d.workspace_id,
    site_id: d.site_id,
    parent_folder_id: d.parent_folder_id,
    name: d.name,
    path: d.path,
    visibility: d.visibility as FolderVisibility,
    folder_type: d.folder_type as StorageFolder["folder_type"],
    created_by: d.created_by,
    created_at: d.created_at,
    updated_at: d.updated_at,
    deleted_at: d.deleted_at,
    site_name: d.name,
    client_name: d.site_id ? clientMap.get(d.site_id) ?? null : null,
  }));

  return { success: true, folders };
}

// ---------------------------------------------------------------------------
// フォルダ詳細 + パンくず祖先取得
// ---------------------------------------------------------------------------
export async function getStorageFolder(folderId: string): Promise<{
  success: boolean;
  folder?: StorageFolder;
  breadcrumbs?: { id: string; name: string }[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, user, profile } = ctx;

  // アクセス権チェック
  const access = await canAccessFolder(supabase, user.id, profile.role, folderId);
  if (!access.allowed) {
    return { success: false, error: "フォルダが見つかりません" };
  }

  const { data, error } = await supabase
    .from("storage_folders")
    .select("*")
    .eq("id", folderId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return { success: false, error: "フォルダが見つかりません" };
  }

  // パンくず構築: 親を辿る
  const breadcrumbs: { id: string; name: string }[] = [];
  let currentParentId = data.parent_folder_id;
  while (currentParentId) {
    const { data: parent } = await supabase
      .from("storage_folders")
      .select("id, name, parent_folder_id")
      .eq("id", currentParentId)
      .single();
    if (!parent) break;
    breadcrumbs.unshift({ id: parent.id, name: parent.name });
    currentParentId = parent.parent_folder_id;
  }

  return {
    success: true,
    folder: data as StorageFolder,
    breadcrumbs,
  };
}

// ---------------------------------------------------------------------------
// フォルダ内コンテンツ取得（子フォルダ + ファイル）
// ---------------------------------------------------------------------------
export async function getFolderContents(folderId: string): Promise<{
  success: boolean;
  childFolders?: StorageFolder[];
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
    thumbnail_url: string | null;
    folder_path: string | null;
    process_id: string | null;
    photo_type: string | null;
    uploaded_by: string;
    uploader_name: string | null;
    folder_id: string | null;
  }[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, user, profile } = ctx;

  // フォルダへのアクセス権チェック
  const access = await canAccessFolder(supabase, user.id, profile.role, folderId);
  if (!access.allowed) {
    return { success: false, error: "アクセス権がありません" };
  }

  // 子フォルダ取得
  let folderQuery = supabase
    .from("storage_folders")
    .select("*")
    .eq("parent_folder_id", folderId)
    .is("deleted_at", null)
    .order("folder_type")
    .order("name");

  // worker / client は担当現場のフォルダのみ
  if (["worker_internal", "worker_external", "client"].includes(profile.role)) {
    const { data: memberSites } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", user.id);
    const siteIds = memberSites?.map((m) => m.site_id) ?? [];
    if (siteIds.length > 0) {
      // site_id が null（会社フォルダ直下の場合）または担当現場のフォルダのみ
      folderQuery = folderQuery.or(`site_id.is.null,site_id.in.(${siteIds.join(",")})`);
    }
    if (profile.role === "client") {
      folderQuery = folderQuery.eq("visibility", "all");
    }
  }

  const { data: childFoldersData, error: foldersError } = await folderQuery;

  if (foldersError) {
    return { success: false, error: "フォルダの取得に失敗しました" };
  }

  // ファイル取得（folder_id でフィルタ）
  const { data: docsData, error: docsError } = await supabase
    .from("site_documents")
    .select("id, document_type, title, description, storage_path, file_name, file_size, version, created_at, uploaded_by, folder_path, process_id, photo_type, folder_id")
    .eq("folder_id", folderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (docsError) {
    return { success: false, error: "ファイルの取得に失敗しました" };
  }

  // アップロード者名を一括取得
  const uploaderIds = [...new Set((docsData ?? []).map((d) => d.uploaded_by))];
  const nameMap = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    if (profiles) {
      for (const p of profiles) {
        if (p.full_name) nameMap.set(p.id, p.full_name);
      }
    }
  }

  // 画像サムネイル用signed URL
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp)$/i;
  const imagePaths = (docsData ?? [])
    .filter((d) => IMAGE_EXT.test(d.file_name))
    .map((d) => d.storage_path);

  const urlMap = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("site-documents")
      .createSignedUrls(imagePaths, 3600);
    if (signed) {
      for (const s of signed) {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      }
    }
    const missing = imagePaths.filter((p) => !urlMap.has(p));
    if (missing.length > 0) {
      const { data: signed2 } = await supabase.storage
        .from("report-photos")
        .createSignedUrls(missing, 3600);
      if (signed2) {
        for (const s of signed2) {
          if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
        }
      }
    }
  }

  const documents = (docsData ?? []).map((d) => ({
    id: d.id,
    document_type: d.document_type,
    title: d.title,
    description: d.description,
    storage_path: d.storage_path,
    file_name: d.file_name,
    file_size: d.file_size,
    version: d.version,
    created_at: d.created_at,
    uploaded_by: d.uploaded_by,
    folder_path: d.folder_path,
    process_id: d.process_id,
    photo_type: d.photo_type,
    uploader_name: nameMap.get(d.uploaded_by) ?? null,
    thumbnail_url: urlMap.get(d.storage_path) ?? null,
    folder_id: d.folder_id,
  }));

  return {
    success: true,
    childFolders: (childFoldersData ?? []) as StorageFolder[],
    documents,
  };
}

// ---------------------------------------------------------------------------
// カスタムサブフォルダ作成
// ---------------------------------------------------------------------------
export async function createStorageFolder(input: {
  name: string;
  parentFolderId: string;
  siteId?: string;
  visibility?: FolderVisibility;
}): Promise<{ success: boolean; folderId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  // 親フォルダ情報を取得
  const { data: parent, error: parentError } = await supabase
    .from("storage_folders")
    .select("id, path, site_id, workspace_id")
    .eq("id", input.parentFolderId)
    .single();

  if (parentError || !parent) {
    return { success: false, error: "親フォルダが見つかりません" };
  }

  const newPath = `${parent.path}/${input.name.trim()}`;

  const { data, error } = await supabase
    .from("storage_folders")
    .insert({
      workspace_id: parent.workspace_id,
      site_id: input.siteId ?? parent.site_id,
      parent_folder_id: input.parentFolderId,
      name: input.name.trim(),
      path: newPath,
      visibility: input.visibility ?? "internal",
      folder_type: "custom",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: `フォルダの作成に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true, folderId: data.id };
}

// ---------------------------------------------------------------------------
// ファイルリネーム
// ---------------------------------------------------------------------------
export async function renameDocument(
  documentId: string,
  newTitle: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, user, profile } = ctx;

  // admin/manager は全て、worker は自分のファイルのみ
  if (!["admin", "manager"].includes(profile.role)) {
    const { data: doc } = await supabase
      .from("site_documents")
      .select("uploaded_by")
      .eq("id", documentId)
      .single();
    if (!doc || doc.uploaded_by !== user.id) {
      return { success: false, error: "権限がありません" };
    }
  }

  const trimmed = newTitle.trim();
  if (!trimmed) return { success: false, error: "ファイル名を入力してください" };

  const { error } = await supabase
    .from("site_documents")
    .update({ title: trimmed })
    .eq("id", documentId)
    .is("deleted_at", null);

  if (error) {
    return { success: false, error: `リネームに失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// ゴミ箱: ファイルをゴミ箱に移動（soft delete）
// ---------------------------------------------------------------------------
export async function trashDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, user, profile } = ctx;

  // admin/manager のみ削除可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("site_documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", documentId);

  if (error) {
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// ゴミ箱: ファイルを復元
// ---------------------------------------------------------------------------
export async function restoreDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, profile } = ctx;

  // admin/manager のみ復元可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("site_documents")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", documentId);

  if (error) {
    return { success: false, error: `復元に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// ゴミ箱: 完全削除（ストレージからも削除）
// ---------------------------------------------------------------------------
export async function permanentDeleteDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, profile } = ctx;

  // admin/manager のみ完全削除可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  // ドキュメント情報を取得
  const { data: doc } = await supabase
    .from("site_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  // ストレージから削除
  if (doc?.storage_path) {
    await supabase.storage.from("site-documents").remove([doc.storage_path]);
    // report-photos バケットからも試行（報告写真の場合）
    await supabase.storage.from("report-photos").remove([doc.storage_path]);
  }

  // DBから完全削除
  const { error } = await supabase
    .from("site_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    return { success: false, error: `完全削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// ゴミ箱: ゴミ箱内のファイル一覧取得
// ---------------------------------------------------------------------------
export async function getTrashItems(): Promise<{
  success: boolean;
  documents?: {
    id: string;
    title: string;
    file_name: string;
    file_size: number | null;
    deleted_at: string;
    deleted_by_name: string | null;
    folder_path: string | null;
    site_name: string | null;
  }[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, user, profile } = ctx;

  // admin/manager のみゴミ箱にアクセス可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  // 自社のサイトIDを取得してフィルタ（テナント分離）
  const { data: companySites } = await supabase
    .from("sites")
    .select("id")
    .eq("company_id", profile.company_id);
  const companySiteIds = (companySites ?? []).map((s) => s.id);

  let query = supabase
    .from("site_documents")
    .select("id, title, file_name, file_size, deleted_at, deleted_by, folder_path, site_id")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (companySiteIds.length > 0) {
    query = query.or(`site_id.in.(${companySiteIds.join(",")}),site_id.is.null`);
  } else {
    query = query.is("site_id", null);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: "ゴミ箱の取得に失敗しました" };
  }

  // サイト名とユーザー名を取得
  const siteIds = [...new Set((data ?? []).map((d) => d.site_id).filter(Boolean))];
  const userIds = [...new Set((data ?? []).map((d) => d.deleted_by).filter(Boolean))];

  const siteMap = new Map<string, string>();
  if (siteIds.length > 0) {
    const { data: sites } = await supabase.from("sites").select("id, name").in("id", siteIds);
    for (const s of sites ?? []) siteMap.set(s.id, s.name);
  }

  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) if (p.full_name) nameMap.set(p.id, p.full_name);
  }

  const documents = (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    file_name: d.file_name,
    file_size: d.file_size,
    deleted_at: d.deleted_at!,
    deleted_by_name: d.deleted_by ? nameMap.get(d.deleted_by) ?? null : null,
    folder_path: d.folder_path,
    site_name: d.site_id ? siteMap.get(d.site_id) ?? null : null,
  }));

  return { success: true, documents };
}

// ---------------------------------------------------------------------------
// フォルダリネーム（manager のみ）
// ---------------------------------------------------------------------------
export async function renameFolder(
  folderId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, profile } = ctx;

  // admin/manager のみリネーム可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  // 現在のフォルダ情報を取得
  const { data: folder } = await supabase
    .from("storage_folders")
    .select("id, path, parent_folder_id")
    .eq("id", folderId)
    .single();
  if (!folder) return { success: false, error: "フォルダが見つかりません" };

  // パスを更新（親のパス + 新しい名前）
  const pathParts = folder.path.split("/");
  pathParts[pathParts.length - 1] = newName.trim();
  const newPath = pathParts.join("/");

  const { error } = await supabase
    .from("storage_folders")
    .update({ name: newName.trim(), path: newPath, updated_at: new Date().toISOString() })
    .eq("id", folderId);

  if (error) {
    return { success: false, error: `リネームに失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// フォルダ削除（soft delete、manager のみ）
// ---------------------------------------------------------------------------
export async function trashFolder(
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, profile } = ctx;

  // admin/manager のみ削除可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  // site_root フォルダは削除不可
  const { data: folder } = await supabase
    .from("storage_folders")
    .select("folder_type")
    .eq("id", folderId)
    .single();
  if (folder?.folder_type === "site_root") {
    return { success: false, error: "現場ルートフォルダは削除できません" };
  }

  const { error } = await supabase
    .from("storage_folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", folderId);

  if (error) {
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// フォルダ公開設定変更（manager のみ）
// ---------------------------------------------------------------------------
export async function updateFolderVisibility(
  folderId: string,
  visibility: FolderVisibility
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { success: false, error: "認証エラー" };
  const { supabase, profile } = ctx;

  // admin/manager のみ変更可能
  if (!["admin", "manager"].includes(profile.role)) {
    return { success: false, error: "権限がありません" };
  }

  const { error } = await supabase
    .from("storage_folders")
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq("id", folderId);

  if (error) {
    return { success: false, error: `公開設定の変更に失敗しました: ${error.message}` };
  }

  revalidatePath("/storage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// サイト作成時のストレージフォルダ自動生成
// ---------------------------------------------------------------------------
export async function createSiteStorageFolders(
  siteId: string,
  siteName: string,
  companyId?: string | null
): Promise<{ success: boolean; rootFolderId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  // 会社フォルダを取得/作成
  let companyFolderId: string | null = null;
  let companyPath = "";
  if (companyId) {
    const { data: existingCompanyFolder } = await supabase
      .from("storage_folders")
      .select("id, path")
      .eq("workspace_id", companyId)
      .eq("folder_type", "company")
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCompanyFolder) {
      companyFolderId = existingCompanyFolder.id;
      companyPath = existingCompanyFolder.path;
    } else {
      // 会社名を取得して会社フォルダを作成
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();
      const companyName = company?.name ?? "不明な会社";
      const { data: newCompanyFolder } = await supabase
        .from("storage_folders")
        .insert({
          workspace_id: companyId,
          site_id: null,
          parent_folder_id: null,
          name: companyName,
          path: companyName,
          visibility: "internal",
          folder_type: "company",
          created_by: user.id,
        })
        .select("id, path")
        .single();
      if (newCompanyFolder) {
        companyFolderId = newCompanyFolder.id;
        companyPath = newCompanyFolder.path;
      }
    }
  }

  const sitePath = companyPath ? `${companyPath}/${siteName}` : siteName;

  // サイトルートフォルダ作成
  const { data: rootFolder, error: rootError } = await supabase
    .from("storage_folders")
    .insert({
      workspace_id: companyId ?? null,
      site_id: siteId,
      parent_folder_id: companyFolderId,
      name: siteName,
      path: sitePath,
      visibility: "internal",
      folder_type: "site_root",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (rootError) {
    return { success: false, error: `フォルダの自動生成に失敗しました: ${rootError.message}` };
  }

  // ドキュメントサブフォルダ作成
  await supabase.from("storage_folders").insert({
    workspace_id: companyId ?? null,
    site_id: siteId,
    parent_folder_id: rootFolder.id,
    name: "ドキュメント",
    path: `${sitePath}/ドキュメント`,
    visibility: "internal",
    folder_type: "document",
    created_by: user.id,
  });

  return { success: true, rootFolderId: rootFolder.id };
}

// ---------------------------------------------------------------------------
// サイトのルートフォルダID取得（サイト詳細→ストレージリンク用）
// ---------------------------------------------------------------------------
export async function getSiteRootFolderId(siteId: string): Promise<{
  success: boolean;
  folderId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data } = await supabase
    .from("storage_folders")
    .select("id")
    .eq("site_id", siteId)
    .eq("folder_type", "site_root")
    .is("deleted_at", null)
    .maybeSingle();

  return { success: true, folderId: data?.id ?? undefined };
}

// ---------------------------------------------------------------------------
// 報告写真アップロード時のフォルダ自動生成 + ストレージ反映
// Phase B: 工程/フェーズフォルダを自動作成し、site_documents にも登録
// ---------------------------------------------------------------------------
const PHOTO_TYPE_FOLDER_NAME: Record<string, string> = {
  before: "施工前",
  during: "施工中",
  after: "施工後",
};

export async function syncReportPhotoToStorage(input: {
  siteId: string;
  userId?: string;
  processId?: string | null;
  processName?: string | null;
  photoType?: string | null;
  storagePath: string;
  fileName: string;
  fileSize: number;
}): Promise<{ success: boolean; error?: string }> {
  // Admin クライアントを使用（呼び出し元の認証コンテキストに依存しない）
  console.log("[syncReportPhotoToStorage] Called with:", JSON.stringify(input));
  const supabase = createAdminClient();

  // userId が渡されなかった場合は認証コンテキストから取得
  let userId = input.userId;
  if (!userId) {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    userId = user?.id ?? undefined;
  }

  // 1. サイトルートフォルダを取得（なければ作成）
  let { data: rootFolder } = await supabase
    .from("storage_folders")
    .select("id, path, workspace_id")
    .eq("site_id", input.siteId)
    .eq("folder_type", "site_root")
    .is("deleted_at", null)
    .maybeSingle();

  if (!rootFolder) {
    // サイト情報を取得してルートフォルダを作成
    const { data: site } = await supabase
      .from("sites")
      .select("name, company_id")
      .eq("id", input.siteId)
      .single();
    if (!site) return { success: false, error: "現場が見つかりません" };

    const result = await createSiteStorageFolders(input.siteId, site.name, site.company_id);
    if (!result.success || !result.rootFolderId) {
      return { success: false, error: result.error };
    }

    const { data: created } = await supabase
      .from("storage_folders")
      .select("id, path, workspace_id")
      .eq("id", result.rootFolderId)
      .single();
    rootFolder = created;
  }

  if (!rootFolder) return { success: false, error: "ルートフォルダの取得に失敗" };

  // 工程IDがない場合はルートフォルダ直下に配置
  let targetFolderId = rootFolder.id;

  // 2. 工程フォルダを取得/作成（processId がある場合）
  if (input.processId) {
    // 工程名を取得
    let processName = input.processName;
    if (!processName) {
      const { data: process } = await supabase
        .from("processes")
        .select("name")
        .eq("id", input.processId)
        .single();
      processName = process?.name ?? "不明な工程";
    }

    let { data: processFolder } = await supabase
      .from("storage_folders")
      .select("id, path")
      .eq("site_id", input.siteId)
      .eq("folder_type", "process")
      .eq("name", processName)
      .eq("parent_folder_id", rootFolder.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!processFolder) {
      const { data: created } = await supabase
        .from("storage_folders")
        .insert({
          workspace_id: rootFolder.workspace_id,
          site_id: input.siteId,
          parent_folder_id: rootFolder.id,
          name: processName,
          path: `${rootFolder.path}/${processName}`,
          visibility: "internal",
          folder_type: "process",
          created_by: userId ?? null,
        })
        .select("id, path")
        .single();
      processFolder = created;
    }

    if (processFolder) {
      targetFolderId = processFolder.id;

      // 3. フェーズフォルダを取得/作成（photoType がある場合）
      const phaseName = input.photoType
        ? PHOTO_TYPE_FOLDER_NAME[input.photoType]
        : null;

      if (phaseName) {
        let { data: phaseFolder } = await supabase
          .from("storage_folders")
          .select("id")
          .eq("site_id", input.siteId)
          .eq("folder_type", "phase")
          .eq("name", phaseName)
          .eq("parent_folder_id", processFolder.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (!phaseFolder) {
          const { data: created } = await supabase
            .from("storage_folders")
            .insert({
              workspace_id: rootFolder.workspace_id,
              site_id: input.siteId,
              parent_folder_id: processFolder.id,
              name: phaseName,
              path: `${processFolder.path}/${phaseName}`,
              visibility: "internal",
              folder_type: "phase",
              created_by: userId ?? null,
            })
            .select("id")
            .single();
          phaseFolder = created;
        }

        if (phaseFolder) {
          targetFolderId = phaseFolder.id;
        }
      }
    }
  }

  // 4. site_documents にレコード作成（ストレージに反映）
  const folderPath = input.processId
    ? input.photoType && PHOTO_TYPE_FOLDER_NAME[input.photoType]
      ? `工程写真/${input.processName ?? ""}/${PHOTO_TYPE_FOLDER_NAME[input.photoType]}`
      : `工程写真/${input.processName ?? ""}`
    : "報告写真";

  await supabase.from("site_documents").insert({
    site_id: input.siteId,
    document_type: "other",
    title: input.fileName,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size: input.fileSize,
    uploaded_by: userId ?? "",
    folder_path: folderPath,
    folder_id: targetFolderId,
    process_id: input.processId || null,
    photo_type: input.photoType || null,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// グローバル検索: フォルダ・ファイルを横断検索
// ---------------------------------------------------------------------------
export async function searchStorage(query: string): Promise<{
  folders: { id: string; name: string; path: string; site_name: string | null }[];
  documents: { id: string; title: string; file_name: string; storage_path: string; file_size: number | null; folder_id: string | null; site_name: string | null; created_at: string }[];
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { folders: [], documents: [] };
  const { supabase, user, profile } = ctx;

  const q = query.trim();
  if (!q || q.length < 2) return { folders: [], documents: [] };

  const pattern = `%${q}%`;

  // フォルダ検索
  let folderQuery = supabase
    .from("storage_folders")
    .select("id, name, path, site_id, sites(name)")
    .ilike("name", pattern)
    .is("deleted_at", null)
    .limit(20);

  // ファイル検索（タイトルまたはファイル名）
  let docQuery = supabase
    .from("site_documents")
    .select("id, title, file_name, storage_path, file_size, folder_id, created_at, site_id, sites(name)")
    .is("deleted_at", null)
    .or(`title.ilike.${pattern},file_name.ilike.${pattern}`)
    .limit(30);

  // ロールベースのフィルタ
  if (profile.role === "worker_internal" || profile.role === "worker_external" || profile.role === "client") {
    const { data: memberships } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", user.id);
    const siteIds = (memberships ?? []).map((m) => m.site_id);
    if (siteIds.length === 0) return { folders: [], documents: [] };

    folderQuery = folderQuery.in("site_id", siteIds);
    docQuery = docQuery.in("site_id", siteIds);

    if (profile.role === "client") {
      folderQuery = folderQuery.eq("visibility", "all");
    }
  }

  const [foldersResult, docsResult] = await Promise.all([folderQuery, docQuery]);

  const folders = (foldersResult.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    path: f.path,
    site_name: (f.sites as unknown as { name: string } | null)?.name ?? null,
  }));

  const documents = (docsResult.data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    file_name: d.file_name,
    storage_path: d.storage_path,
    file_size: d.file_size,
    folder_id: d.folder_id ?? null,
    site_name: (d.sites as unknown as { name: string } | null)?.name ?? null,
    created_at: d.created_at,
  }));

  return { folders, documents };
}
