-- migration_v22: client_report_summaries に修正依頼機能を追加
DO $$
BEGIN
  -- status に 'revision_requested' を追加
  ALTER TABLE public.client_report_summaries
    DROP CONSTRAINT IF EXISTS client_report_summaries_status_check;

  ALTER TABLE public.client_report_summaries
    ADD CONSTRAINT client_report_summaries_status_check
    CHECK (status IN ('draft', 'submitted', 'client_confirmed', 'rejected', 'revision_requested'));

  -- 修正依頼コメントカラムを追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_report_summaries'
      AND column_name = 'revision_comment'
  ) THEN
    ALTER TABLE public.client_report_summaries ADD COLUMN revision_comment text;
  END IF;

  -- 修正依頼者カラムを追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_report_summaries'
      AND column_name = 'revision_requested_by'
  ) THEN
    ALTER TABLE public.client_report_summaries
      ADD COLUMN revision_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- 修正依頼日時カラムを追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_report_summaries'
      AND column_name = 'revision_requested_at'
  ) THEN
    ALTER TABLE public.client_report_summaries ADD COLUMN revision_requested_at timestamptz;
  END IF;
END
$$;

-- クライアントが status を 'client_confirmed' または 'revision_requested' に変更できる RLS ポリシー
DROP POLICY IF EXISTS "client_report_summaries_client_update" ON public.client_report_summaries;
CREATE POLICY "client_report_summaries_client_update"
  ON public.client_report_summaries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'client'
    )
    AND status IN ('client_confirmed', 'revision_requested')
  );

COMMENT ON COLUMN public.client_report_summaries.revision_comment IS 'クライアントからの修正依頼コメント';
COMMENT ON COLUMN public.client_report_summaries.revision_requested_by IS '修正依頼を行ったクライアントのID';
COMMENT ON COLUMN public.client_report_summaries.revision_requested_at IS '修正依頼日時';
