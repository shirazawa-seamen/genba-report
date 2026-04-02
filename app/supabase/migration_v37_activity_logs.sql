-- ============================================================
-- マイグレーション v37: activity_logs テーブル新規作成
-- 報告の承認・差し戻し・提出などの操作履歴を記録
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. activity_logs テーブル新規作成
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 対象エンティティ
    entity_type  text        NOT NULL CHECK (entity_type IN ('daily_report', 'client_report_summary', 'site_document', 'storage_folder')),
    entity_id    uuid        NOT NULL,
    -- 関連情報
    site_id      uuid        REFERENCES public.sites(id) ON DELETE SET NULL,
    -- アクション
    action       text        NOT NULL CHECK (action IN (
        'created', 'submitted', 'approved', 'rejected', 'resubmitted',
        'revision_requested', 'client_confirmed',
        'edited', 'deleted', 'restored',
        'uploaded', 'renamed', 'moved'
    )),
    -- 実行者
    actor_id     uuid        NOT NULL REFERENCES auth.users(id),
    -- 詳細（差し戻し理由、変更内容など）
    detail       jsonb,
    -- タイムスタンプ
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. インデックス
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_site ON public.activity_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- 3. RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザーは閲覧可能（アプリ側でフィルタ）
DROP POLICY IF EXISTS "activity_logs_select_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_select_authenticated" ON public.activity_logs FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

-- INSERT: 認証済みユーザーは書き込み可能
DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- DELETE: 不可（ログは削除しない）
