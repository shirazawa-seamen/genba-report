-- ============================================================
-- v32: ドキュメント種別追加（契約書・現調写真）
-- ============================================================

-- 1. document_type の CHECK 制約を更新
ALTER TABLE public.site_documents DROP CONSTRAINT IF EXISTS site_documents_document_type_check;
ALTER TABLE public.site_documents ADD CONSTRAINT site_documents_document_type_check
  CHECK (document_type IN ('blueprint', 'specification', 'purchase_order', 'schedule', 'contract', 'site_survey_photo', 'other'));

-- 2. sites テーブルにチェックリスト用カラム追加
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS has_contract boolean NOT NULL DEFAULT false;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS has_site_survey_photo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sites.has_contract IS '契約書ありフラグ';
COMMENT ON COLUMN public.sites.has_site_survey_photo IS '現調写真ありフラグ';
