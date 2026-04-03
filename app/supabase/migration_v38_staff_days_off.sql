-- ============================================================
-- マイグレーション v38: staff_days_off テーブル新規作成
-- スタッフの休み予定をカレンダーに表示
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. staff_days_off テーブル新規作成
CREATE TABLE IF NOT EXISTS public.staff_days_off (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date          date        NOT NULL,
    reason        text,
    registered_by uuid        REFERENCES auth.users(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

-- 2. インデックス
CREATE INDEX IF NOT EXISTS idx_staff_days_off_date ON public.staff_days_off(date);
CREATE INDEX IF NOT EXISTS idx_staff_days_off_user ON public.staff_days_off(user_id);

-- 3. RLS
ALTER TABLE public.staff_days_off ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザーは閲覧可能
DROP POLICY IF EXISTS "staff_days_off_select" ON public.staff_days_off;
CREATE POLICY "staff_days_off_select" ON public.staff_days_off FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

-- INSERT: 本人 or admin/manager
DROP POLICY IF EXISTS "staff_days_off_insert" ON public.staff_days_off;
CREATE POLICY "staff_days_off_insert" ON public.staff_days_off FOR INSERT
    WITH CHECK (
        user_id = (select auth.uid())
        OR public.get_user_role() IN ('admin', 'manager')
    );

-- DELETE: 本人 or admin/manager
DROP POLICY IF EXISTS "staff_days_off_delete" ON public.staff_days_off;
CREATE POLICY "staff_days_off_delete" ON public.staff_days_off FOR DELETE
    USING (
        user_id = (select auth.uid())
        OR public.get_user_role() IN ('admin', 'manager')
    );
