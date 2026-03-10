-- ============================================================
-- 現場報告システム マイグレーション v8
-- sites テーブルに site_number（現場番号）カラム追加
-- Supabase SQL Editor で実行してください
-- ============================================================

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_number text;

-- 現場番号のインデックス（検索用）
CREATE INDEX IF NOT EXISTS idx_sites_site_number ON public.sites(site_number);
