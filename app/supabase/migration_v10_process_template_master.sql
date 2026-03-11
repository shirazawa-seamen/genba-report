-- ============================================================
-- 現場報告システム マイグレーション v10
-- 標準工程マスタ + 現場工程の並び順
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ============================================================
-- Step 1: 標準工程マスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.process_templates (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    category    text        NOT NULL,
    name        text        NOT NULL,
    sort_order  integer     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(category, name),
    UNIQUE(sort_order)
);

CREATE INDEX IF NOT EXISTS idx_process_templates_sort_order
    ON public.process_templates(sort_order);

ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "process_templates_select_authenticated" ON public.process_templates;
DROP POLICY IF EXISTS "process_templates_insert_admin_manager" ON public.process_templates;
DROP POLICY IF EXISTS "process_templates_update_admin_manager" ON public.process_templates;
DROP POLICY IF EXISTS "process_templates_delete_admin_manager" ON public.process_templates;

CREATE POLICY "process_templates_select_authenticated" ON public.process_templates FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "process_templates_insert_admin_manager" ON public.process_templates FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

CREATE POLICY "process_templates_update_admin_manager" ON public.process_templates FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

CREATE POLICY "process_templates_delete_admin_manager" ON public.process_templates FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    ));

-- ============================================================
-- Step 2: 現場工程の並び順
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'processes' AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.processes ADD COLUMN order_index integer;
    END IF;
END $$;

WITH ordered AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY site_id
            ORDER BY created_at, name, id
        ) AS seq
    FROM public.processes
)
UPDATE public.processes p
SET order_index = ordered.seq
FROM ordered
WHERE p.id = ordered.id
  AND (p.order_index IS NULL OR p.order_index <= 0);

ALTER TABLE public.processes
    ALTER COLUMN order_index SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processes_site_order_index
    ON public.processes(site_id, order_index);

-- ============================================================
-- Step 3: 初期マスタ投入
-- ============================================================
INSERT INTO public.process_templates (category, name, sort_order)
VALUES
    ('foundation', 'A-1 図面確定', 1),
    ('foundation', 'A-2 地盤調査', 2),
    ('foundation', 'A-3 地盤改良', 3),
    ('electrical', 'A-4-1 仮設電気', 4),
    ('plumbing', 'A-4-2 仮設水道', 5),
    ('foundation', 'A-5 基礎工事', 6),
    ('foundation', 'A-6 防蟻処理', 7),
    ('framing', 'A-7 土台敷き', 8),
    ('plumbing', 'A-8 先行配管（給排水）', 9),
    ('framing', 'A-9 仮設足場', 10),
    ('framing', 'A-10 建て方・上棟', 11),
    ('framing', 'A-11 屋根下地（ルーフィング）', 12),
    ('exterior', 'B-1-1 屋根仕上げ', 13),
    ('exterior', 'B-1-2 サッシ取り付け', 14),
    ('exterior', 'B-2 透湿防水シート', 15),
    ('exterior', 'B-3 バルコニー防水', 16),
    ('exterior', 'B-4-1 外壁施工', 17),
    ('electrical', 'B-4-2 電気 外回り', 18),
    ('exterior', 'B-5 コーキング', 19),
    ('exterior', 'B-6 塗装', 20),
    ('exterior', 'B-7 雨トイ', 21),
    ('exterior', 'B-8 外部周りチェック', 22),
    ('exterior', 'B-9 足場バラシ', 23),
    ('exterior', 'B-10 外構', 24),
    ('interior', 'C-1 断熱材施工', 25),
    ('electrical', 'C-2-1 電気配線', 26),
    ('plumbing', 'C-2-2 水道配管', 27),
    ('plumbing', 'C-2-3 ガス配管', 28),
    ('interior', 'C-3 ユニットバス搬入・設置', 29),
    ('interior', 'C-4 天井ボード', 30),
    ('interior', 'C-5 壁ボード', 31),
    ('interior', 'C-6 床下地・フローリング', 32),
    ('interior', 'C-7 内装・クロス', 33),
    ('interior', 'C-8-1 キッチン設置', 34),
    ('interior', 'C-8-2 トイレ設置', 35),
    ('interior', 'C-8-3 洗面台設置', 36),
    ('finishing', 'C-9 建具取り付け', 37),
    ('finishing', 'C-10 巾木・廻り縁', 38),
    ('electrical', 'C-11 電気器具取り付け', 39),
    ('cleanup', 'C-12 ハウスクリーニング', 40),
    ('finishing', 'D-1 完了検査', 41),
    ('finishing', 'D-2 引き渡し', 42)
ON CONFLICT (category, name) DO NOTHING;

COMMENT ON TABLE public.process_templates IS '一般住宅の標準工程マスタ';
COMMENT ON COLUMN public.processes.order_index IS '現場ごとの工程表示順';
