-- テンプレート用チェックリスト項目
CREATE TABLE IF NOT EXISTS public.process_checklist_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_process ON public.process_checklist_templates(process_template_id);

-- RLS
ALTER TABLE public.process_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_templates_select_auth" ON public.process_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_templates_insert_admin" ON public.process_checklist_templates FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));
CREATE POLICY "checklist_templates_update_admin" ON public.process_checklist_templates FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));
CREATE POLICY "checklist_templates_delete_admin" ON public.process_checklist_templates FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- 現場工程用チェックリスト項目
CREATE TABLE IF NOT EXISTS public.process_checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    name text NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL,
    completed_at timestamptz,
    completed_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_process ON public.process_checklist_items(process_id);

-- RLS
ALTER TABLE public.process_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_items_select_auth" ON public.process_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_items_insert_auth" ON public.process_checklist_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "checklist_items_update_auth" ON public.process_checklist_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "checklist_items_delete_auth" ON public.process_checklist_items FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- チェック状態変更時に工程の進捗率を自動更新するトリガー
CREATE OR REPLACE FUNCTION fn_update_process_progress_from_checklist()
RETURNS TRIGGER AS $$
DECLARE
    total_count integer;
    completed_count integer;
    new_progress integer;
    parent_pid uuid;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = true)
    INTO total_count, completed_count
    FROM public.process_checklist_items
    WHERE process_id = COALESCE(NEW.process_id, OLD.process_id);

    IF total_count > 0 THEN
        new_progress := ROUND((completed_count::numeric / total_count) * 100);
    ELSE
        new_progress := 0;
    END IF;

    UPDATE public.processes
    SET progress_rate = new_progress
    WHERE id = COALESCE(NEW.process_id, OLD.process_id)
    RETURNING parent_process_id INTO parent_pid;

    -- 親工程の進捗も更新
    IF parent_pid IS NOT NULL THEN
        UPDATE public.processes
        SET progress_rate = (
            SELECT COALESCE(ROUND(AVG(progress_rate)), 0)
            FROM public.processes
            WHERE parent_process_id = parent_pid
        )
        WHERE id = parent_pid;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checklist_progress ON public.process_checklist_items;
CREATE TRIGGER trg_checklist_progress
    AFTER INSERT OR UPDATE OF is_completed OR DELETE ON public.process_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_process_progress_from_checklist();
