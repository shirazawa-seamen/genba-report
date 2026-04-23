-- ============================================================================
-- v39: 孤立ドキュメントの folder_id 修復 + 会社フォルダ階層修復
-- ============================================================================
-- 問題:
--   1. 現場詳細ページ(DocumentManager)からアップロードした書類の folder_id が NULL
--      → ストレージツリーに表示されない
--   2. 一部の現場で会社フォルダが存在せず、site_root が直下にある
-- ============================================================================

-- ─── STEP 1: 会社フォルダが存在しない企業に作成 ───────────────────────────
INSERT INTO storage_folders (workspace_id, name, path, visibility, folder_type, created_by)
SELECT DISTINCT
  c.id,
  c.name,
  c.name,
  'internal',
  'company',
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM storage_folders sf
  WHERE sf.workspace_id = c.id
    AND sf.folder_type = 'company'
    AND sf.deleted_at IS NULL
)
AND c.id IS NOT NULL;

-- ─── STEP 2: site_root の parent_folder_id が NULL のものを会社フォルダに紐付け ──
UPDATE storage_folders sr
SET parent_folder_id = cf.company_folder_id
FROM (
  SELECT sf.id AS company_folder_id, sf.workspace_id
  FROM storage_folders sf
  WHERE sf.folder_type = 'company'
    AND sf.deleted_at IS NULL
) cf
WHERE sr.folder_type = 'site_root'
  AND sr.parent_folder_id IS NULL
  AND sr.deleted_at IS NULL
  AND sr.workspace_id = cf.workspace_id
  AND cf.company_folder_id IS NOT NULL;

-- ─── STEP 3: site_root はあるがドキュメントフォルダが無い現場に作成 ───────
INSERT INTO storage_folders (workspace_id, site_id, parent_folder_id, name, path, visibility, folder_type, created_by)
SELECT
  sr.workspace_id,
  sr.site_id,
  sr.id,
  'ドキュメント',
  sr.path || '/ドキュメント',
  'internal',
  'document',
  sr.created_by
FROM storage_folders sr
WHERE sr.folder_type = 'site_root'
  AND sr.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage_folders df
    WHERE df.parent_folder_id = sr.id
      AND df.folder_type = 'document'
      AND df.deleted_at IS NULL
  );

-- ─── STEP 4: folder_id が NULL の site_documents を「ドキュメント」フォルダに紐付け ──
UPDATE site_documents sd
SET folder_id = df.id
FROM storage_folders df
WHERE sd.folder_id IS NULL
  AND sd.deleted_at IS NULL
  AND sd.site_id IS NOT NULL
  AND df.site_id = sd.site_id
  AND df.folder_type = 'document'
  AND df.deleted_at IS NULL;

-- folder_id がまだ NULL（ドキュメントフォルダが無かった場合）→ site_root に紐付け
UPDATE site_documents sd
SET folder_id = sr.id
FROM storage_folders sr
WHERE sd.folder_id IS NULL
  AND sd.deleted_at IS NULL
  AND sd.site_id IS NOT NULL
  AND sr.site_id = sd.site_id
  AND sr.folder_type = 'site_root'
  AND sr.deleted_at IS NULL;
