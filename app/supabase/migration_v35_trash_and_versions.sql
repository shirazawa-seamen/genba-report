-- ============================================================
-- 現場報告システム マイグレーション v35
-- Phase D: ゴミ箱（soft delete）+ バージョン管理
--
-- 変更内容:
-- 1. site_documents に deleted_at, deleted_by カラム追加
-- 2. storage_file_versions テーブル新規作成
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ============================================================
-- 1. site_documents に soft delete 用カラム追加
-- ============================================================

ALTER TABLE public.site_documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.site_documents
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_site_documents_deleted_at ON public.site_documents(deleted_at);

-- ============================================================
-- 2. storage_file_versions テーブル新規作成
-- ============================================================

CREATE TABLE IF NOT EXISTS public.storage_file_versions (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  uuid        NOT NULL REFERENCES public.site_documents(id) ON DELETE CASCADE,
    version      integer     NOT NULL DEFAULT 1,
    storage_path text        NOT NULL,
    file_size    bigint,
    uploaded_by  uuid        REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_file_versions_document_id ON public.storage_file_versions(document_id);

-- RLS
ALTER TABLE public.storage_file_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_versions_select_authenticated" ON public.storage_file_versions;
CREATE POLICY "file_versions_select_authenticated" ON public.storage_file_versions FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "file_versions_insert_authenticated" ON public.storage_file_versions;
CREATE POLICY "file_versions_insert_authenticated" ON public.storage_file_versions FOR INSERT
    WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'worker_internal', 'worker_external'));

DROP POLICY IF EXISTS "file_versions_delete_admin_manager" ON public.storage_file_versions;
CREATE POLICY "file_versions_delete_admin_manager" ON public.storage_file_versions FOR DELETE
    USING (public.get_user_role() IN ('admin', 'manager'));
