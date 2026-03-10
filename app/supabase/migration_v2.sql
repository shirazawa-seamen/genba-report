-- ============================================================
-- 現場報告システム マイグレーション v2
-- 「現場 → 工程 → 日報」3階層構造の実現
--
-- Supabase SQL Editor で以下を順番に実行してください。
-- 各Stepを個別に実行するか、全体を一括で実行できます。
-- ============================================================

-- ============================================================
-- Step 1: processes テーブル作成
-- ============================================================
CREATE TABLE public.processes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    category      text NOT NULL,
    name          text NOT NULL,
    progress_rate integer NOT NULL DEFAULT 0 CHECK (progress_rate BETWEEN 0 AND 100),
    status        text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_processes_site_category_name ON public.processes(site_id, category, name);
CREATE INDEX idx_processes_site_id ON public.processes(site_id);

-- ============================================================
-- Step 2: processes の RLS ポリシー
-- ============================================================
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "全認証ユーザーが参照可能" ON public.processes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "worker/supervisorが作成可能" ON public.processes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('worker', 'supervisor')
        )
    );

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

-- ============================================================
-- Step 3: daily_reports に process_id を nullable で追加
-- ============================================================
ALTER TABLE public.daily_reports ADD COLUMN process_id uuid REFERENCES public.processes(id);

-- ============================================================
-- Step 4: 既存データのマイグレーション
-- ============================================================
-- 既存データから processes レコードを生成
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
WHERE dr.work_process IS NOT NULL AND dr.work_process != ''
ON CONFLICT DO NOTHING;

-- daily_reports の process_id を更新
UPDATE public.daily_reports dr
SET process_id = p.id
FROM public.processes p
WHERE p.site_id = dr.site_id
AND p.category = dr.work_process
AND p.name = dr.work_process;

-- ============================================================
-- Step 5: NULLチェック & process_id を NOT NULL に変更
-- ============================================================
-- まず確認（0件であることを確認してから次へ進む）
-- SELECT count(*) FROM public.daily_reports WHERE process_id IS NULL;

-- NULLが残っている場合は以下を実行してデフォルトprocessを作成・紐付け
-- （0件なら以下はスキップしてOK）
/*
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
*/

-- NOT NULL制約追加
ALTER TABLE public.daily_reports ALTER COLUMN process_id SET NOT NULL;

-- ============================================================
-- Step 6: UNIQUE制約の変更
-- ============================================================
-- 既存の UNIQUE 制約を削除
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_site_id_report_date_key;
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_unique_site_date;

-- 新しい UNIQUE 制約を追加
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_process_id_report_date_key UNIQUE (process_id, report_date);

-- ============================================================
-- Step 7: report_photos に media_type 追加
-- ============================================================
ALTER TABLE public.report_photos ADD COLUMN media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video'));

-- ============================================================
-- 検証クエリ（マイグレーション後に実行して確認）
-- ============================================================
-- SELECT count(*) FROM public.processes;
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'daily_reports' AND column_name = 'process_id';
-- SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'report_photos' AND column_name = 'media_type';
-- SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'daily_reports' AND constraint_type = 'UNIQUE';
