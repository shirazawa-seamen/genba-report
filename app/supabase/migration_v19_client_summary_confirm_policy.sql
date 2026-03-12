-- migration_v19: クライアントが client_report_summaries の確認操作を行えるようにする
-- 現状: UPDATE は admin/manager のみ許可 → クライアントの「確認する」ボタンが RLS でブロックされている

-- クライアント用の UPDATE ポリシー（status を client_confirmed に変更する操作のみ）
DO $$
BEGIN
  DROP POLICY IF EXISTS "client_report_summaries_confirm_by_client" ON public.client_report_summaries;

  CREATE POLICY "client_report_summaries_confirm_by_client"
    ON public.client_report_summaries
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'client'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'client'
      )
      AND status = 'client_confirmed'
    );
END
$$;
