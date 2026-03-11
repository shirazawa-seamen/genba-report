-- ============================================================
-- 現場報告システム マイグレーション v11
-- 標準工程マスタのフローチャート編集用カラム追加
--
-- Supabase SQL Editor で実行してください
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_templates' AND column_name = 'phase_key'
    ) THEN
        ALTER TABLE public.process_templates ADD COLUMN phase_key text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_templates' AND column_name = 'process_code'
    ) THEN
        ALTER TABLE public.process_templates ADD COLUMN process_code text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_templates' AND column_name = 'parallel_group'
    ) THEN
        ALTER TABLE public.process_templates ADD COLUMN parallel_group integer;
    END IF;
END $$;

UPDATE public.process_templates
SET
    process_code = split_part(name, ' ', 1),
    name = CASE
        WHEN strpos(name, ' ') > 0 THEN substr(name, strpos(name, ' ') + 1)
        ELSE name
    END
WHERE process_code IS NULL;

UPDATE public.process_templates
SET phase_key = left(process_code, 1)
WHERE phase_key IS NULL
  AND process_code IS NOT NULL
  AND left(process_code, 1) IN ('A', 'B', 'C', 'D');

DELETE FROM public.process_templates
WHERE process_code = 'A-1' AND name = '図面確定';

WITH desired(phase_key, process_code, category, name, parallel_group, sort_order) AS (
    VALUES
        ('A', 'A-1', 'foundation', '地盤調査', NULL, 1),
        ('A', 'A-2', 'foundation', '地盤改良', NULL, 2),
        ('A', 'A-3-1', 'electrical', '仮設電気', 1, 3),
        ('A', 'A-3-2', 'plumbing', '仮設水道', 1, 4),
        ('A', 'A-4', 'foundation', '基礎工事', NULL, 5),
        ('A', 'A-5', 'foundation', '防蟻処理', NULL, 6),
        ('A', 'A-6', 'framing', '土台敷き', NULL, 7),
        ('A', 'A-7', 'plumbing', '先行配管（給排水）', NULL, 8),
        ('A', 'A-8', 'framing', '仮設足場', NULL, 9),
        ('A', 'A-9', 'framing', '建て方・上棟', NULL, 10),
        ('A', 'A-10', 'framing', '屋根下地（ルーフィング）', NULL, 11),
        ('B', 'B-1-1', 'exterior', '屋根仕上げ', 2, 12),
        ('B', 'B-1-2', 'exterior', 'サッシ取り付け', 2, 13),
        ('B', 'B-2', 'exterior', '透湿防水シート', NULL, 14),
        ('B', 'B-3', 'exterior', 'バルコニー防水', NULL, 15),
        ('B', 'B-4-1', 'exterior', '外壁施工', 3, 16),
        ('B', 'B-4-2', 'electrical', '電気 外回り', 3, 17),
        ('B', 'B-5', 'exterior', 'コーキング', NULL, 18),
        ('B', 'B-6', 'exterior', '塗装', NULL, 19),
        ('B', 'B-7', 'exterior', '雨トイ', NULL, 20),
        ('B', 'B-8', 'exterior', '外部周りチェック', NULL, 21),
        ('B', 'B-9', 'exterior', '足場バラシ', NULL, 22),
        ('B', 'B-10', 'exterior', '外構', NULL, 23),
        ('C', 'C-1', 'interior', '断熱材施工', NULL, 24),
        ('C', 'C-2-1', 'electrical', '電気配線', 4, 25),
        ('C', 'C-2-2', 'plumbing', '水道配管', 4, 26),
        ('C', 'C-2-3', 'plumbing', 'ガス配管', 4, 27),
        ('C', 'C-3', 'interior', 'ユニットバス搬入・設置', NULL, 28),
        ('C', 'C-4', 'interior', '天井ボード', NULL, 29),
        ('C', 'C-5', 'interior', '壁ボード', NULL, 30),
        ('C', 'C-6', 'interior', '床下地・フローリング', NULL, 31),
        ('C', 'C-7', 'interior', '内装・クロス', NULL, 32),
        ('C', 'C-8-1', 'interior', 'キッチン設置', 5, 33),
        ('C', 'C-8-2', 'interior', 'トイレ設置', 5, 34),
        ('C', 'C-8-3', 'interior', '洗面台設置', 5, 35),
        ('C', 'C-9', 'finishing', '建具取り付け', NULL, 36),
        ('C', 'C-10', 'finishing', '巾木・廻り縁', NULL, 37),
        ('C', 'C-11', 'electrical', '電気器具取り付け', NULL, 38),
        ('C', 'C-12', 'cleanup', 'ハウスクリーニング', NULL, 39),
        ('D', 'D-1', 'finishing', '完了検査', NULL, 40),
        ('D', 'D-2', 'finishing', '引き渡し', NULL, 41)
)
UPDATE public.process_templates pt
SET
    phase_key = desired.phase_key,
    process_code = desired.process_code,
    category = desired.category,
    name = desired.name,
    parallel_group = desired.parallel_group,
    sort_order = desired.sort_order
FROM desired
WHERE pt.process_code = desired.process_code
   OR (pt.category = desired.category AND pt.name = desired.name);

INSERT INTO public.process_templates (phase_key, process_code, category, name, parallel_group, sort_order)
SELECT desired.phase_key, desired.process_code, desired.category, desired.name, desired.parallel_group, desired.sort_order
FROM (
    VALUES
        ('A', 'A-1', 'foundation', '地盤調査', NULL, 1),
        ('A', 'A-2', 'foundation', '地盤改良', NULL, 2),
        ('A', 'A-3-1', 'electrical', '仮設電気', 1, 3),
        ('A', 'A-3-2', 'plumbing', '仮設水道', 1, 4),
        ('A', 'A-4', 'foundation', '基礎工事', NULL, 5),
        ('A', 'A-5', 'foundation', '防蟻処理', NULL, 6),
        ('A', 'A-6', 'framing', '土台敷き', NULL, 7),
        ('A', 'A-7', 'plumbing', '先行配管（給排水）', NULL, 8),
        ('A', 'A-8', 'framing', '仮設足場', NULL, 9),
        ('A', 'A-9', 'framing', '建て方・上棟', NULL, 10),
        ('A', 'A-10', 'framing', '屋根下地（ルーフィング）', NULL, 11),
        ('B', 'B-1-1', 'exterior', '屋根仕上げ', 2, 12),
        ('B', 'B-1-2', 'exterior', 'サッシ取り付け', 2, 13),
        ('B', 'B-2', 'exterior', '透湿防水シート', NULL, 14),
        ('B', 'B-3', 'exterior', 'バルコニー防水', NULL, 15),
        ('B', 'B-4-1', 'exterior', '外壁施工', 3, 16),
        ('B', 'B-4-2', 'electrical', '電気 外回り', 3, 17),
        ('B', 'B-5', 'exterior', 'コーキング', NULL, 18),
        ('B', 'B-6', 'exterior', '塗装', NULL, 19),
        ('B', 'B-7', 'exterior', '雨トイ', NULL, 20),
        ('B', 'B-8', 'exterior', '外部周りチェック', NULL, 21),
        ('B', 'B-9', 'exterior', '足場バラシ', NULL, 22),
        ('B', 'B-10', 'exterior', '外構', NULL, 23),
        ('C', 'C-1', 'interior', '断熱材施工', NULL, 24),
        ('C', 'C-2-1', 'electrical', '電気配線', 4, 25),
        ('C', 'C-2-2', 'plumbing', '水道配管', 4, 26),
        ('C', 'C-2-3', 'plumbing', 'ガス配管', 4, 27),
        ('C', 'C-3', 'interior', 'ユニットバス搬入・設置', NULL, 28),
        ('C', 'C-4', 'interior', '天井ボード', NULL, 29),
        ('C', 'C-5', 'interior', '壁ボード', NULL, 30),
        ('C', 'C-6', 'interior', '床下地・フローリング', NULL, 31),
        ('C', 'C-7', 'interior', '内装・クロス', NULL, 32),
        ('C', 'C-8-1', 'interior', 'キッチン設置', 5, 33),
        ('C', 'C-8-2', 'interior', 'トイレ設置', 5, 34),
        ('C', 'C-8-3', 'interior', '洗面台設置', 5, 35),
        ('C', 'C-9', 'finishing', '建具取り付け', NULL, 36),
        ('C', 'C-10', 'finishing', '巾木・廻り縁', NULL, 37),
        ('C', 'C-11', 'electrical', '電気器具取り付け', NULL, 38),
        ('C', 'C-12', 'cleanup', 'ハウスクリーニング', NULL, 39),
        ('D', 'D-1', 'finishing', '完了検査', NULL, 40),
        ('D', 'D-2', 'finishing', '引き渡し', NULL, 41)
) AS desired(phase_key, process_code, category, name, parallel_group, sort_order)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.process_templates pt
    WHERE pt.process_code = desired.process_code
);

ALTER TABLE public.process_templates
    ALTER COLUMN phase_key SET NOT NULL;

ALTER TABLE public.process_templates
    ALTER COLUMN process_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_process_templates_process_code
    ON public.process_templates(process_code);

CREATE INDEX IF NOT EXISTS idx_process_templates_phase_sort
    ON public.process_templates(phase_key, sort_order);

COMMENT ON COLUMN public.process_templates.phase_key IS 'A:基礎・躯体 B:外装 C:内装 D:引き渡し';
COMMENT ON COLUMN public.process_templates.process_code IS '工程ID';
COMMENT ON COLUMN public.process_templates.parallel_group IS '並行して進める工程グループ番号';
