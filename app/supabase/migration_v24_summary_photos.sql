-- migration_v24: 2次報告（client_report_summaries）に写真・動画を添付する
-- report_photos と同構造の summary_photos テーブルを作成

CREATE TABLE IF NOT EXISTS public.summary_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid NOT NULL REFERENCES public.client_report_summaries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  photo_type text DEFAULT 'during',
  caption text,
  media_type text DEFAULT 'photo',
  source_report_id uuid REFERENCES public.daily_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.summary_photos ENABLE ROW LEVEL SECURITY;

-- admin/manager は全操作可能
DROP POLICY IF EXISTS "summary_photos_admin_manager_all" ON public.summary_photos;
CREATE POLICY "summary_photos_admin_manager_all"
  ON public.summary_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- client は閲覧のみ（提出済みサマリーの写真）
DROP POLICY IF EXISTS "summary_photos_client_select" ON public.summary_photos;
CREATE POLICY "summary_photos_client_select"
  ON public.summary_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_report_summaries cs
      WHERE cs.id = summary_photos.summary_id
        AND cs.status IN ('submitted', 'client_confirmed')
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'client'
    )
  );

-- インデックス
CREATE INDEX IF NOT EXISTS idx_summary_photos_summary_id ON public.summary_photos(summary_id);
