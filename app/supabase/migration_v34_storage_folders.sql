-- ============================================================
-- 現場報告システム マイグレーション v34
-- ストレージ機能 Phase A: storage_folders テーブル新設
--
-- 変更内容:
-- 1. storage_folders テーブル新規作成（実体フォルダ管理）
-- 2. RLS ポリシー設定
-- 3. site_documents に folder_id カラム追加
-- 4. 既存サイト用バックフィル（site_root + ドキュメントフォルダ自動生成）
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ============================================================
-- 1. storage_folders テーブル新規作成
-- ============================================================

CREATE TABLE IF NOT EXISTS public.storage_folders (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
    site_id          uuid        REFERENCES public.sites(id) ON DELETE CASCADE,
    parent_folder_id uuid        REFERENCES public.storage_folders(id) ON DELETE CASCADE,
    name             text        NOT NULL,
    path             text        NOT NULL,
    visibility       text        NOT NULL DEFAULT 'internal'
                                 CHECK (visibility IN ('internal', 'all')),
    folder_type      text        NOT NULL DEFAULT 'custom'
                                 CHECK (folder_type IN ('site_root', 'document', 'process', 'phase', 'custom')),
    created_by       uuid        REFERENCES auth.users(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz
);

-- ============================================================
-- 2. インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_storage_folders_site_id ON public.storage_folders(site_id);
CREATE INDEX IF NOT EXISTS idx_storage_folders_parent ON public.storage_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_storage_folders_path ON public.storage_folders(path);
CREATE INDEX IF NOT EXISTS idx_storage_folders_workspace ON public.storage_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_storage_folders_deleted_at ON public.storage_folders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storage_folders_type ON public.storage_folders(folder_type);

-- ============================================================
-- 3. RLS 有効化 + ポリシー
-- ============================================================

ALTER TABLE public.storage_folders ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザー全員（Phase Cで公開設定ベースに細分化）
DROP POLICY IF EXISTS "storage_folders_select_authenticated" ON public.storage_folders;
CREATE POLICY "storage_folders_select_authenticated" ON public.storage_folders FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

-- INSERT: admin/manager + worker（担当現場のフォルダ作成用）
DROP POLICY IF EXISTS "storage_folders_insert_authenticated" ON public.storage_folders;
CREATE POLICY "storage_folders_insert_authenticated" ON public.storage_folders FOR INSERT
    WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'worker_internal', 'worker_external'));

-- UPDATE: admin/manager のみ（公開設定変更、リネーム等）
DROP POLICY IF EXISTS "storage_folders_update_admin_manager" ON public.storage_folders;
CREATE POLICY "storage_folders_update_admin_manager" ON public.storage_folders FOR UPDATE
    USING (public.get_user_role() IN ('admin', 'manager'))
    WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

-- DELETE: admin/manager のみ
DROP POLICY IF EXISTS "storage_folders_delete_admin_manager" ON public.storage_folders;
CREATE POLICY "storage_folders_delete_admin_manager" ON public.storage_folders FOR DELETE
    USING (public.get_user_role() IN ('admin', 'manager'));

-- ============================================================
-- 4. site_documents に folder_id カラム追加
-- ============================================================

ALTER TABLE public.site_documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.storage_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_documents_folder_id ON public.site_documents(folder_id);

-- ============================================================
-- 5. 既存サイト用バックフィル
--    各サイトに site_root フォルダ + ドキュメントサブフォルダを自動生成
-- ============================================================

-- 5a. サイトルートフォルダを作成（まだ存在しないサイト分）
-- sites に created_by がないため、site_members の最初のメンバーを作成者とする
INSERT INTO public.storage_folders (workspace_id, site_id, parent_folder_id, name, path, visibility, folder_type, created_by)
SELECT
    s.company_id,
    s.id,
    NULL,
    s.name,
    s.name,
    'internal',
    'site_root',
    (SELECT sm.user_id FROM public.site_members sm WHERE sm.site_id = s.id ORDER BY sm.created_at ASC LIMIT 1)
FROM public.sites s
WHERE NOT EXISTS (
    SELECT 1 FROM public.storage_folders sf
    WHERE sf.site_id = s.id AND sf.folder_type = 'site_root'
);

-- 5b. ドキュメントサブフォルダを作成
INSERT INTO public.storage_folders (workspace_id, site_id, parent_folder_id, name, path, visibility, folder_type, created_by)
SELECT
    sf.workspace_id,
    sf.site_id,
    sf.id,
    'ドキュメント',
    sf.path || '/ドキュメント',
    'internal',
    'document',
    sf.created_by
FROM public.storage_folders sf
WHERE sf.folder_type = 'site_root'
AND NOT EXISTS (
    SELECT 1 FROM public.storage_folders child
    WHERE child.parent_folder_id = sf.id AND child.folder_type = 'document'
);

-- 5c. 既存 site_documents をドキュメントフォルダに紐付け
UPDATE public.site_documents sd
SET folder_id = (
    SELECT sf.id FROM public.storage_folders sf
    WHERE sf.site_id = sd.site_id AND sf.folder_type = 'document'
    LIMIT 1
)
WHERE sd.folder_id IS NULL
AND sd.folder_path LIKE '書類/%';
