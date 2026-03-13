-- migration_v21: 会社全体の材料カタログテーブル
CREATE TABLE IF NOT EXISTS public.material_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  product_number text,
  unit text,
  supplier text,
  category text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_catalog_company
  ON public.material_catalog(company_id);

CREATE INDEX IF NOT EXISTS idx_material_catalog_name
  ON public.material_catalog(material_name);

ALTER TABLE public.material_catalog ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが閲覧可能
DROP POLICY IF EXISTS "material_catalog_select_authenticated" ON public.material_catalog;
CREATE POLICY "material_catalog_select_authenticated"
  ON public.material_catalog
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 管理者/マネージャーのみ変更可能
DROP POLICY IF EXISTS "material_catalog_modify_admin_manager" ON public.material_catalog;
CREATE POLICY "material_catalog_modify_admin_manager"
  ON public.material_catalog
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

-- site_materials にカタログ参照カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'site_materials'
      AND column_name = 'catalog_id'
  ) THEN
    ALTER TABLE public.site_materials
      ADD COLUMN catalog_id uuid REFERENCES public.material_catalog(id) ON DELETE SET NULL;
  END IF;
END
$$;
