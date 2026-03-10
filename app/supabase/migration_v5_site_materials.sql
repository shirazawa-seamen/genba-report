-- ============================================================
-- 現場報告システム マイグレーション v5
-- site_materials テーブル作成
-- Supabase SQL Editor で実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_materials (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    material_name   text        NOT NULL,
    product_number  text,
    quantity        numeric(10,2) CHECK (quantity >= 0),
    unit            text,
    supplier        text,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_materials_site_id ON public.site_materials(site_id);

ALTER TABLE public.site_materials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_materials' AND policyname = 'site_materials_select_authenticated') THEN
        CREATE POLICY "site_materials_select_authenticated" ON public.site_materials
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_materials' AND policyname = 'site_materials_insert_admin') THEN
        CREATE POLICY "site_materials_insert_admin" ON public.site_materials
            FOR INSERT TO authenticated
            WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_materials' AND policyname = 'site_materials_delete_admin') THEN
        CREATE POLICY "site_materials_delete_admin" ON public.site_materials
            FOR DELETE TO authenticated
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
    END IF;
END $$;
