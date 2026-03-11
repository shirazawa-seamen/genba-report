-- ============================================================
-- 現場報告システム マイグレーション v12
-- 工程種別マスタ
--
-- Supabase SQL Editor で実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS public.process_categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    value       text        NOT NULL UNIQUE,
    label       text        NOT NULL UNIQUE,
    sort_order  integer     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_categories_sort_order
    ON public.process_categories(sort_order);

ALTER TABLE public.process_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "process_categories_select_authenticated" ON public.process_categories;
DROP POLICY IF EXISTS "process_categories_insert_admin_manager" ON public.process_categories;
DROP POLICY IF EXISTS "process_categories_update_admin_manager" ON public.process_categories;
DROP POLICY IF EXISTS "process_categories_delete_admin_manager" ON public.process_categories;

CREATE POLICY "process_categories_select_authenticated" ON public.process_categories FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "process_categories_insert_admin_manager" ON public.process_categories FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

CREATE POLICY "process_categories_update_admin_manager" ON public.process_categories FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

CREATE POLICY "process_categories_delete_admin_manager" ON public.process_categories FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

INSERT INTO public.process_categories (value, label, sort_order)
VALUES
    ('foundation', '基礎工事', 1),
    ('framing', '躯体工事', 2),
    ('exterior', '外装工事', 3),
    ('interior', '内装工事', 4),
    ('electrical', '電気工事', 5),
    ('plumbing', '配管工事', 6),
    ('finishing', '仕上げ工事', 7),
    ('cleanup', '清掃・片付け', 8)
ON CONFLICT (value) DO UPDATE
SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

COMMENT ON TABLE public.process_categories IS '工程種別マスタ';
