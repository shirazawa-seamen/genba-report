-- ============================================================================
-- migration_v25_process_template_hierarchy.sql
-- 工程テンプレートおよび工程に親子関係を追加
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. process_templates に parent_template_id カラムを追加
-- ---------------------------------------------------------------------------
ALTER TABLE process_templates
  ADD COLUMN IF NOT EXISTS parent_template_id uuid
    REFERENCES process_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_process_templates_parent
  ON process_templates(parent_template_id);

-- ---------------------------------------------------------------------------
-- 2. processes に parent_process_id カラムを追加
-- ---------------------------------------------------------------------------
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS parent_process_id uuid
    REFERENCES processes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_processes_parent
  ON processes(parent_process_id);

-- ---------------------------------------------------------------------------
-- 3. 子工程の進捗変更時に親工程の進捗を自動計算するトリガー
--    親工程の progress は子工程の progress の平均値（小数点以下切り捨て）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_parent_process_progress()
RETURNS trigger AS $$
DECLARE
  v_parent_id uuid;
  v_avg_progress integer;
BEGIN
  -- 変更された行の parent_process_id を取得
  v_parent_id := COALESCE(NEW.parent_process_id, OLD.parent_process_id);

  -- parent_process_id が NULL の場合は何もしない
  IF v_parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 子工程の平均進捗率を計算
  SELECT COALESCE(FLOOR(AVG(progress))::integer, 0)
    INTO v_avg_progress
    FROM processes
   WHERE parent_process_id = v_parent_id;

  -- 親工程の進捗率を更新
  UPDATE processes
     SET progress = v_avg_progress,
         updated_at = now()
   WHERE id = v_parent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーがあれば削除してから作成
DROP TRIGGER IF EXISTS trg_update_parent_process_progress ON processes;

CREATE TRIGGER trg_update_parent_process_progress
  AFTER INSERT OR UPDATE OF progress OR DELETE
  ON processes
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_parent_process_progress();
