-- ============================================================
-- マイグレーション v36: site_documents.site_id を nullable に変更
-- 会社フォルダ直下など、現場に紐付かないファイルのアップロードを可能にする
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. NOT NULL 制約を削除
ALTER TABLE public.site_documents
  ALTER COLUMN site_id DROP NOT NULL;

-- 2. ON DELETE CASCADE を維持しつつ nullable にするため、既存のFKを再作成
-- （既存FKがCASCADE付きなので変更不要。NOT NULL削除のみで十分）
