-- ============================================================
-- 現場報告システム マイグレーション v9
-- ロール体系リニューアル + manager追加 + 外注現場制限
--
-- 新ロール: admin, manager, worker_internal, worker_external, client
-- 承認フロー: worker → manager/admin → client
-- ステータス: draft, submitted, approved, client_confirmed, rejected
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ============================================================
-- Step 1: profiles.role の CHECK 制約を更新
-- ============================================================
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid
        AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.profiles'::regclass
      AND con.contype = 'c'
      AND att.attname = 'role'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 旧ロール値を新ロール値に変換
UPDATE public.profiles SET role = 'worker_internal' WHERE role = 'worker';
UPDATE public.profiles SET role = 'admin' WHERE role = 'supervisor';
UPDATE public.profiles SET role = 'client' WHERE role IN ('orderer', 'client');

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'manager', 'worker_internal', 'worker_external', 'client'));

-- ============================================================
-- Step 2: is_active カラム追加（未適用の場合）
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- ============================================================
-- Step 3: sites にカラム追加（未適用の場合）
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'has_blueprint') THEN
        ALTER TABLE public.sites ADD COLUMN has_blueprint boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'has_specification') THEN
        ALTER TABLE public.sites ADD COLUMN has_specification boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'has_purchase_order') THEN
        ALTER TABLE public.sites ADD COLUMN has_purchase_order boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'has_schedule') THEN
        ALTER TABLE public.sites ADD COLUMN has_schedule boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'is_monitor') THEN
        ALTER TABLE public.sites ADD COLUMN is_monitor boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'site_number') THEN
        ALTER TABLE public.sites ADD COLUMN site_number text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'status') THEN
        ALTER TABLE public.sites ADD COLUMN status text NOT NULL DEFAULT 'active';
    END IF;
END $$;

-- ============================================================
-- Step 4: daily_reports に承認フローカラム追加（未適用の場合）
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'approval_status') THEN
        ALTER TABLE public.daily_reports ADD COLUMN approval_status text NOT NULL DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'approved_by') THEN
        ALTER TABLE public.daily_reports ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'approved_at') THEN
        ALTER TABLE public.daily_reports ADD COLUMN approved_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'rejection_comment') THEN
        ALTER TABLE public.daily_reports ADD COLUMN rejection_comment text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'admin_notes') THEN
        ALTER TABLE public.daily_reports ADD COLUMN admin_notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'edited_by_admin') THEN
        ALTER TABLE public.daily_reports ADD COLUMN edited_by_admin boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- 承認ステータスの移行
UPDATE public.daily_reports SET approval_status = 'approved' WHERE approval_status = 'admin_approved';
UPDATE public.daily_reports SET approval_status = 'client_confirmed' WHERE approval_status = 'orderer_confirmed';

-- 承認ステータスのCHECK制約を更新
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid
        AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.daily_reports'::regclass
      AND con.contype = 'c'
      AND att.attname = 'approval_status'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.daily_reports DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

ALTER TABLE public.daily_reports
    ADD CONSTRAINT daily_reports_approval_status_check
    CHECK (approval_status IN ('draft', 'submitted', 'approved', 'client_confirmed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_daily_reports_approval_status ON public.daily_reports(approval_status);

-- ============================================================
-- Step 5: site_documents テーブル作成（未適用の場合）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    document_type   text        NOT NULL CHECK (document_type IN ('blueprint', 'specification', 'purchase_order', 'schedule', 'other')),
    title           text        NOT NULL,
    description     text,
    storage_path    text        NOT NULL,
    file_name       text        NOT NULL,
    file_size       bigint,
    version         integer     NOT NULL DEFAULT 1,
    uploaded_by     uuid        NOT NULL REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_documents_site_id ON public.site_documents(site_id);
CREATE INDEX IF NOT EXISTS idx_site_documents_type ON public.site_documents(document_type);
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 6: process_checklists に inspection_phase 追加（未適用の場合）
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'process_checklists' AND column_name = 'inspection_phase') THEN
        ALTER TABLE public.process_checklists ADD COLUMN inspection_phase text NOT NULL DEFAULT 'during' CHECK (inspection_phase IN ('acceptance', 'during', 'post'));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_process_checklists_inspection_phase ON public.process_checklists(inspection_phase);

-- ============================================================
-- Step 7: report_materials テーブル作成（未適用の場合）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_materials (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       uuid        NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    material_name   text        NOT NULL,
    product_number  text,
    quantity        numeric(10,2) CHECK (quantity >= 0),
    unit            text,
    supplier        text,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_materials_report_id ON public.report_materials(report_id);
ALTER TABLE public.report_materials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 8: site_members テーブル作成（外注職人の現場制限用）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_members (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by  uuid        REFERENCES auth.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(site_id, user_id)
);
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 9: RLS ポリシー全面再構築
-- ============================================================

-- ----- profiles -----
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_by_admin_orderer" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_by_supervisor_client" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "自分自身のプロフィールは参照可能" ON public.profiles;
DROP POLICY IF EXISTS "supervisor/clientは全プロフィール参照可能" ON public.profiles;
DROP POLICY IF EXISTS "自分自身のプロフィールのみ更新可能" ON public.profiles;
DROP POLICY IF EXISTS "ユーザー登録時にプロフィール作成可能" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_all_by_admin_manager_client" ON public.profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'client')));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_admin_manager" ON public.profiles FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));
CREATE POLICY "profiles_insert_admin_manager" ON public.profiles FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- ----- sites -----
DROP POLICY IF EXISTS "sites_select_authenticated" ON public.sites;
DROP POLICY IF EXISTS "sites_insert_admin" ON public.sites;
DROP POLICY IF EXISTS "sites_update_admin" ON public.sites;
DROP POLICY IF EXISTS "sites_insert_supervisor" ON public.sites;
DROP POLICY IF EXISTS "sites_update_supervisor" ON public.sites;
DROP POLICY IF EXISTS "全認証ユーザーが参照可能" ON public.sites;
DROP POLICY IF EXISTS "supervisorが作成可能" ON public.sites;
DROP POLICY IF EXISTS "supervisorが更新可能" ON public.sites;

CREATE POLICY "sites_select_authenticated" ON public.sites FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sites_insert_admin_manager" ON public.sites FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));
CREATE POLICY "sites_update_admin_manager" ON public.sites FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));

-- ----- site_documents -----
DROP POLICY IF EXISTS "site_documents_select_authenticated" ON public.site_documents;
DROP POLICY IF EXISTS "site_documents_insert_admin" ON public.site_documents;
DROP POLICY IF EXISTS "site_documents_update_admin" ON public.site_documents;
DROP POLICY IF EXISTS "site_documents_delete_admin" ON public.site_documents;

CREATE POLICY "site_documents_select_authenticated" ON public.site_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_documents_insert_admin_manager" ON public.site_documents FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "site_documents_update_admin_manager" ON public.site_documents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "site_documents_delete_admin_manager" ON public.site_documents FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- ----- site_members -----
DROP POLICY IF EXISTS "site_members_select" ON public.site_members;
DROP POLICY IF EXISTS "site_members_insert_admin_manager" ON public.site_members;
DROP POLICY IF EXISTS "site_members_delete_admin_manager" ON public.site_members;

CREATE POLICY "site_members_select" ON public.site_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "site_members_insert_admin_manager" ON public.site_members FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "site_members_delete_admin_manager" ON public.site_members FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- ----- processes -----
DROP POLICY IF EXISTS "全認証ユーザーが参照可能" ON public.processes;
DROP POLICY IF EXISTS "processes_insert_worker_admin" ON public.processes;
DROP POLICY IF EXISTS "processes_update_admin" ON public.processes;
DROP POLICY IF EXISTS "worker/supervisorが作成可能" ON public.processes;
DROP POLICY IF EXISTS "supervisorが更新可能" ON public.processes;

CREATE POLICY "processes_select_authenticated" ON public.processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "processes_insert_worker_admin_manager" ON public.processes FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'worker_internal', 'worker_external')));
CREATE POLICY "processes_update_admin_manager" ON public.processes FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- ----- daily_reports -----
DROP POLICY IF EXISTS "daily_reports_select_own_worker" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_select_all_by_admin_orderer" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_select_all_by_supervisor_client" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert_worker_admin" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert_worker_supervisor" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_update_own" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_update_admin_approval" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_update_orderer_confirm" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_delete_own" ON public.daily_reports;
DROP POLICY IF EXISTS "workerは自分の報告のみ参照可能" ON public.daily_reports;
DROP POLICY IF EXISTS "supervisor/clientは全報告参照可能" ON public.daily_reports;
DROP POLICY IF EXISTS "worker/supervisorが報告作成可能" ON public.daily_reports;
DROP POLICY IF EXISTS "報告者本人のみ更新可能" ON public.daily_reports;
DROP POLICY IF EXISTS "報告者本人のみ削除可能" ON public.daily_reports;

-- worker: 自分の報告のみ参照
CREATE POLICY "daily_reports_select_own_worker" ON public.daily_reports FOR SELECT
    USING (reporter_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('worker_internal', 'worker_external')));
-- admin/manager/client: 全報告参照
CREATE POLICY "daily_reports_select_all_by_admin_manager_client" ON public.daily_reports FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'client')));
-- worker/admin: 報告作成（managerは報告作成不可）
CREATE POLICY "daily_reports_insert_worker_admin" ON public.daily_reports FOR INSERT
    WITH CHECK (reporter_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'worker_internal', 'worker_external')));
-- 報告者本人: 更新可能
CREATE POLICY "daily_reports_update_own" ON public.daily_reports FOR UPDATE USING (reporter_id = auth.uid());
-- admin/manager: 承認用UPDATE
CREATE POLICY "daily_reports_update_admin_manager_approval" ON public.daily_reports FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')));
-- client: 確認用UPDATE（approvedステータスのみ）
CREATE POLICY "daily_reports_update_client_confirm" ON public.daily_reports FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'client') AND approval_status = 'approved')
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'client'));
-- 報告者本人: 削除可能
CREATE POLICY "daily_reports_delete_own" ON public.daily_reports FOR DELETE USING (reporter_id = auth.uid());

-- ----- report_photos -----
DROP POLICY IF EXISTS "report_photos_select_via_report" ON public.report_photos;
DROP POLICY IF EXISTS "report_photos_insert_reporter" ON public.report_photos;
DROP POLICY IF EXISTS "report_photos_delete_reporter" ON public.report_photos;

CREATE POLICY "report_photos_select_via_report" ON public.report_photos FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.daily_reports dr
        WHERE dr.id = report_photos.report_id
          AND (dr.reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'client')))
    ));
CREATE POLICY "report_photos_insert_reporter" ON public.report_photos FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = report_photos.report_id AND dr.reporter_id = auth.uid()));
CREATE POLICY "report_photos_delete_reporter" ON public.report_photos FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = report_photos.report_id AND dr.reporter_id = auth.uid()));

-- ----- report_materials -----
DROP POLICY IF EXISTS "report_materials_select_via_report" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_insert_reporter" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_update_reporter" ON public.report_materials;
DROP POLICY IF EXISTS "report_materials_delete_reporter" ON public.report_materials;

CREATE POLICY "report_materials_select_via_report" ON public.report_materials FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.daily_reports dr
        WHERE dr.id = report_materials.report_id
          AND (dr.reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'client')))
    ));
CREATE POLICY "report_materials_insert_reporter" ON public.report_materials FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = report_materials.report_id AND dr.reporter_id = auth.uid()));
CREATE POLICY "report_materials_update_reporter" ON public.report_materials FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = report_materials.report_id AND dr.reporter_id = auth.uid()));
CREATE POLICY "report_materials_delete_reporter" ON public.report_materials FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = report_materials.report_id AND dr.reporter_id = auth.uid()));

-- ----- process_checklists -----
DROP POLICY IF EXISTS "checklists_select_authenticated" ON public.process_checklists;
DROP POLICY IF EXISTS "checklists_insert_worker_admin" ON public.process_checklists;
DROP POLICY IF EXISTS "checklists_update_worker_admin" ON public.process_checklists;
DROP POLICY IF EXISTS "checklists_insert_worker_supervisor" ON public.process_checklists;
DROP POLICY IF EXISTS "checklists_update_worker_supervisor" ON public.process_checklists;

CREATE POLICY "checklists_select_authenticated" ON public.process_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklists_insert_worker_admin_manager" ON public.process_checklists FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'worker_internal', 'worker_external')));
CREATE POLICY "checklists_update_worker_admin_manager" ON public.process_checklists FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'worker_internal', 'worker_external')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager', 'worker_internal', 'worker_external')));

-- ============================================================
-- Step 10: handle_new_user() トリガー更新
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'worker_internal')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 11: Comments 更新
-- ============================================================
COMMENT ON COLUMN public.profiles.role IS 'ロール: admin=全権管理者, manager=現場管理者, worker_internal=社内職人, worker_external=外注職人, client=元請け';
COMMENT ON COLUMN public.daily_reports.approval_status IS '承認状態: draft=下書き, submitted=提出済み, approved=承認済み, client_confirmed=元請け確認済み, rejected=差戻し';
COMMENT ON TABLE public.site_members IS '現場メンバー（外注職人の現場アクセス制御用）';

-- ============================================================
-- 検証クエリ（マイグレーション後に実行して確認）
-- ============================================================
-- SELECT role, count(*) FROM public.profiles GROUP BY role;
-- SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- SELECT * FROM public.site_members LIMIT 10;
