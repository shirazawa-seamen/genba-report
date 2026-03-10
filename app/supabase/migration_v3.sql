-- ============================================================
-- 現場報告システム マイグレーション v3
-- 工程管理・チェックリスト・メディア対応
--
-- Supabase SQL Editor で以下を順番に実行してください。
-- daily_reports が 0件の前提（データ移行は簡略化）
-- ============================================================

-- ============================================================
-- Step 1: processes テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS public.processes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    category      text NOT NULL,
    name          text NOT NULL,
    progress_rate integer NOT NULL DEFAULT 0 CHECK (progress_rate BETWEEN 0 AND 100),
    status        text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_processes_site_category_name
    ON public.processes(site_id, category, name);
CREATE INDEX IF NOT EXISTS idx_processes_site_id
    ON public.processes(site_id);

-- ============================================================
-- Step 2: processes の RLS ポリシー
-- ============================================================
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processes' AND policyname = '全認証ユーザーが参照可能'
    ) THEN
        CREATE POLICY "全認証ユーザーが参照可能" ON public.processes
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processes' AND policyname = 'worker/supervisorが作成可能'
    ) THEN
        CREATE POLICY "worker/supervisorが作成可能" ON public.processes
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('worker', 'supervisor')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processes' AND policyname = 'supervisorが更新可能'
    ) THEN
        CREATE POLICY "supervisorが更新可能" ON public.processes
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'supervisor'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'supervisor'
                )
            );
    END IF;
END $$;

-- ============================================================
-- Step 3: daily_reports に process_id を追加
-- ============================================================
-- 3a: nullable で追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_reports'
          AND column_name = 'process_id'
    ) THEN
        ALTER TABLE public.daily_reports
            ADD COLUMN process_id uuid REFERENCES public.processes(id);
    END IF;
END $$;

-- 3b: 既存データがある場合のマイグレーション
-- （既存の work_process から processes レコードを自動生成して紐付け）
INSERT INTO public.processes (site_id, category, name, progress_rate)
SELECT DISTINCT
    dr.site_id,
    dr.work_process,
    dr.work_process,
    COALESCE(
        (SELECT dr2.progress_rate FROM public.daily_reports dr2
         WHERE dr2.site_id = dr.site_id AND dr2.work_process = dr.work_process
         ORDER BY dr2.report_date DESC LIMIT 1),
        0
    )
FROM public.daily_reports dr
WHERE dr.work_process IS NOT NULL
  AND dr.work_process != ''
  AND dr.process_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.daily_reports dr
SET process_id = p.id
FROM public.processes p
WHERE dr.process_id IS NULL
  AND p.site_id = dr.site_id
  AND p.category = dr.work_process
  AND p.name = dr.work_process;

-- process_id が NULL のまま残るレコード用のフォールバック
INSERT INTO public.processes (site_id, category, name, progress_rate)
SELECT DISTINCT
    dr.site_id,
    COALESCE(NULLIF(dr.work_process, ''), 'その他'),
    COALESCE(NULLIF(dr.work_process, ''), 'その他'),
    0
FROM public.daily_reports dr
WHERE dr.process_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.daily_reports dr
SET process_id = p.id
FROM public.processes p
WHERE dr.process_id IS NULL
  AND p.site_id = dr.site_id
  AND p.category = COALESCE(NULLIF(dr.work_process, ''), 'その他')
  AND p.name = COALESCE(NULLIF(dr.work_process, ''), 'その他');

-- 3c: NOT NULL 制約追加（全レコードに process_id が設定済みであること）
DO $$ BEGIN
    -- NULL が残っていないか確認
    IF (SELECT count(*) FROM public.daily_reports WHERE process_id IS NULL) = 0 THEN
        -- 既に NOT NULL なら何もしない
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'daily_reports'
              AND column_name = 'process_id'
              AND is_nullable = 'YES'
        ) THEN
            ALTER TABLE public.daily_reports ALTER COLUMN process_id SET NOT NULL;
        END IF;
    ELSE
        RAISE NOTICE 'WARNING: % rows still have NULL process_id',
            (SELECT count(*) FROM public.daily_reports WHERE process_id IS NULL);
    END IF;
END $$;

-- ============================================================
-- Step 4: UNIQUE 制約の変更 (site_id, report_date) → (process_id, report_date)
-- ============================================================
-- 既存の UNIQUE 制約を削除（名前が不明なので複数パターンで試行）
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_site_id_report_date_key;
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_unique_site_date;

-- 新しい UNIQUE 制約を追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_reports_process_id_report_date_key'
          AND conrelid = 'public.daily_reports'::regclass
    ) THEN
        ALTER TABLE public.daily_reports
            ADD CONSTRAINT daily_reports_process_id_report_date_key
            UNIQUE (process_id, report_date);
    END IF;
END $$;

-- process_id 用のインデックス
CREATE INDEX IF NOT EXISTS idx_daily_reports_process_id
    ON public.daily_reports(process_id);

-- ============================================================
-- Step 5: report_photos に media_type 追加 & photo_type に 'during' 追加
-- ============================================================
-- 5a: media_type カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'report_photos'
          AND column_name = 'media_type'
    ) THEN
        ALTER TABLE public.report_photos
            ADD COLUMN media_type text NOT NULL DEFAULT 'photo'
            CHECK (media_type IN ('photo', 'video'));
    END IF;
END $$;

-- 5b: photo_type の CHECK 制約を更新（'during' を追加）
-- 既存の CHECK 制約名を探して削除し、新しい制約を追加
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- photo_type の CHECK 制約を探す
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid
        AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.report_photos'::regclass
      AND con.contype = 'c'
      AND att.attname = 'photo_type'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.report_photos DROP CONSTRAINT ' || constraint_name;
    END IF;

    -- 新しい CHECK 制約を追加（'during' を含む）
    ALTER TABLE public.report_photos
        ADD CONSTRAINT report_photos_photo_type_check
        CHECK (photo_type IN ('before', 'during', 'after', 'corner_ne', 'corner_nw', 'corner_se', 'corner_sw'));
END $$;

-- ============================================================
-- Step 6: process_checklists テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_checklists (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id  uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    item_text   text NOT NULL,
    is_checked  boolean NOT NULL DEFAULT false,
    checked_at  timestamptz,
    checked_by  uuid REFERENCES auth.users(id),
    photo_id    uuid REFERENCES public.report_photos(id),
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_checklists_process_id
    ON public.process_checklists(process_id);

-- ============================================================
-- Step 7: process_checklists の RLS ポリシー
-- ============================================================
ALTER TABLE public.process_checklists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'process_checklists' AND policyname = 'checklists_select_authenticated'
    ) THEN
        CREATE POLICY "checklists_select_authenticated" ON public.process_checklists
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'process_checklists' AND policyname = 'checklists_insert_worker_supervisor'
    ) THEN
        CREATE POLICY "checklists_insert_worker_supervisor" ON public.process_checklists
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('worker', 'supervisor')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'process_checklists' AND policyname = 'checklists_update_worker_supervisor'
    ) THEN
        CREATE POLICY "checklists_update_worker_supervisor" ON public.process_checklists
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('worker', 'supervisor')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('worker', 'supervisor')
                )
            );
    END IF;
END $$;

-- ============================================================
-- 検証クエリ（マイグレーション後に実行して確認）
-- ============================================================
-- SELECT count(*) FROM public.processes;
-- SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'daily_reports' AND column_name = 'process_id';
-- SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'report_photos' AND column_name = 'media_type';
-- SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'daily_reports' AND constraint_type = 'UNIQUE';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.report_photos'::regclass AND contype = 'c';
-- SELECT count(*) FROM information_schema.tables WHERE table_name = 'process_checklists';
