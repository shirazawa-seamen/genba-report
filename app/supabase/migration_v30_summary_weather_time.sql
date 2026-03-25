-- migration_v30: client_report_summariesに天気・現場時間を追加

ALTER TABLE public.client_report_summaries
  ADD COLUMN IF NOT EXISTS weather text;

ALTER TABLE public.client_report_summaries
  ADD COLUMN IF NOT EXISTS arrival_time text;

ALTER TABLE public.client_report_summaries
  ADD COLUMN IF NOT EXISTS departure_time text;
