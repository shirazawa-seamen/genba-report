-- migration_v23: client_report_summaries に作業者カラムを追加
-- 2次報告で現場メンバーから作業者を選択して記録する

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_report_summaries'
      AND column_name = 'workers'
  ) THEN
    ALTER TABLE public.client_report_summaries
      ADD COLUMN workers text[] DEFAULT '{}';
  END IF;
END
$$;
