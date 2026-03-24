-- ============================================================================
-- migration_v29: トリガーバグ修正 + report_photosにprocess_id追加
-- TSK-25/14/24 対応
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. migration_v25のトリガーバグ修正
--    `progress` → `progress_rate` に修正
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_parent_process_progress()
RETURNS trigger AS $$
DECLARE
  v_parent_id uuid;
  v_avg_progress integer;
BEGIN
  v_parent_id := COALESCE(NEW.parent_process_id, OLD.parent_process_id);

  IF v_parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(FLOOR(AVG(progress_rate))::integer, 0)
    INTO v_avg_progress
    FROM processes
   WHERE parent_process_id = v_parent_id;

  UPDATE processes
     SET progress_rate = v_avg_progress
   WHERE id = v_parent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_parent_process_progress ON processes;

CREATE TRIGGER trg_update_parent_process_progress
  AFTER INSERT OR UPDATE OF progress_rate OR DELETE
  ON processes
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_parent_process_progress();

-- ---------------------------------------------------------------------------
-- 2. report_photos に process_id カラムを追加（工程別写真紐付け用）
-- ---------------------------------------------------------------------------
ALTER TABLE public.report_photos
  ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_report_photos_process_id
  ON public.report_photos(process_id);

COMMENT ON COLUMN public.report_photos.process_id IS '紐付け工程ID（任意）';

-- ---------------------------------------------------------------------------
-- 3. processesに updated_at が無い場合追加（トリガーで使用）
-- ---------------------------------------------------------------------------
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
