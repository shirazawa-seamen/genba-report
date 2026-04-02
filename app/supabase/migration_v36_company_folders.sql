-- ============================================================
-- マイグレーション v36: 会社フォルダ追加
-- storage_folders に folder_type='company' を追加し、
-- 既存サイトフォルダを会社フォルダの子にする
-- ============================================================

-- 1. folder_type に 'company' を追加
ALTER TABLE public.storage_folders
  DROP CONSTRAINT IF EXISTS storage_folders_folder_type_check;

ALTER TABLE public.storage_folders
  ADD CONSTRAINT storage_folders_folder_type_check
  CHECK (folder_type IN ('company', 'site_root', 'document', 'process', 'phase', 'custom'));

-- 2. 既存の会社ごとに会社フォルダを作成
INSERT INTO public.storage_folders (workspace_id, site_id, parent_folder_id, name, path, visibility, folder_type, created_by)
SELECT
    c.id,
    NULL,
    NULL,
    c.name,
    c.name,
    'internal',
    'company',
    NULL
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.storage_folders sf
    WHERE sf.workspace_id = c.id AND sf.folder_type = 'company'
);

-- 3. 既存の site_root フォルダを会社フォルダの子に紐付け
UPDATE public.storage_folders sr
SET parent_folder_id = (
    SELECT cf.id FROM public.storage_folders cf
    WHERE cf.folder_type = 'company'
    AND cf.workspace_id = sr.workspace_id
    LIMIT 1
)
WHERE sr.folder_type = 'site_root'
AND sr.parent_folder_id IS NULL
AND sr.workspace_id IS NOT NULL;
