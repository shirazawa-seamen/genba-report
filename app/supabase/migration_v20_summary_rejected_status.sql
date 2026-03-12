-- migration_v20: client_report_summaries の status に 'rejected' を追加
DO $$
BEGIN
  ALTER TABLE public.client_report_summaries
    DROP CONSTRAINT IF EXISTS client_report_summaries_status_check;

  ALTER TABLE public.client_report_summaries
    ADD CONSTRAINT client_report_summaries_status_check
    CHECK (status IN ('draft', 'submitted', 'client_confirmed', 'rejected'));
END
$$;
