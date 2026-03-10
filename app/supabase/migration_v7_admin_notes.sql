-- ============================================================
-- 現場報告システム マイグレーション v7
-- 管理者による報告編集機能の追加
-- Supabase SQL Editor で実行してください
-- ============================================================

-- admin_notes カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'admin_notes'
    ) THEN
        ALTER TABLE public.daily_reports ADD COLUMN admin_notes text;
    END IF;
END $$;

-- edited_by_admin フラグ追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'edited_by_admin'
    ) THEN
        ALTER TABLE public.daily_reports ADD COLUMN edited_by_admin boolean NOT NULL DEFAULT false;
    END IF;
END $$;
