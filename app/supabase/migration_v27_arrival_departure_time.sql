-- migration_v27_arrival_departure_time.sql
-- daily_reports に arrival_time, departure_time カラムを追加
-- work_hours は既存データ互換のため残す

ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS arrival_time text,
  ADD COLUMN IF NOT EXISTS departure_time text;

COMMENT ON COLUMN daily_reports.arrival_time IS '現場到着時間 (HH:MM形式)';
COMMENT ON COLUMN daily_reports.departure_time IS '現場退出時間 (HH:MM形式)';
