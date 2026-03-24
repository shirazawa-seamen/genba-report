-- ============================================================
-- Migration v28: Storage バケット作成 & RLS ポリシー設定
-- 画像添付エラー修正 (TSK-1)
-- ============================================================
-- 問題: report-photos / site-documents バケットの storage.objects に
--       RLS ポリシーが設定されておらず、アップロード・ダウンロードが
--       権限エラーで失敗していた。
-- ============================================================

-- 1. バケット作成（存在しない場合のみ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  false,
  52428800,  -- 50MB
  ARRAY['image/jpeg','image/png','image/heic','image/heif','image/webp','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-documents',
  'site-documents',
  false,
  52428800,  -- 50MB
  NULL       -- 全 MIME タイプ許可
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. storage.objects RLS ポリシー: report-photos
-- ============================================================

-- 既存ポリシーがあれば削除
DROP POLICY IF EXISTS "report_photos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "report_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "report_photos_storage_delete" ON storage.objects;

-- SELECT: ログイン済みユーザーなら report-photos バケットのオブジェクトを読み取り可
-- (実際のデータアクセス制御は report_photos テーブルの RLS で行う。
--  signed URL 生成にはこのポリシーが必要)
CREATE POLICY "report_photos_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'report-photos');

-- INSERT: ログイン済みユーザーがアップロード可能
-- (report_photos テーブルの INSERT ポリシーで報告者チェックを行う)
CREATE POLICY "report_photos_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-photos');

-- DELETE: ログイン済みユーザーが削除可能
-- (report_photos テーブルの DELETE ポリシーで報告者チェックを行う)
CREATE POLICY "report_photos_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-photos');

-- ============================================================
-- 3. storage.objects RLS ポリシー: site-documents
-- ============================================================

DROP POLICY IF EXISTS "site_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "site_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "site_documents_storage_delete" ON storage.objects;

CREATE POLICY "site_documents_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-documents');

CREATE POLICY "site_documents_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-documents');

CREATE POLICY "site_documents_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-documents');
