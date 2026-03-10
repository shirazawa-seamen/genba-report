-- ============================================================
-- 現場報告システム マイグレーション v4
-- ロール変更・承認フロー・ドキュメント管理・材料報告対応
--
-- Supabase SQL Editor で実行してください
-- 冪等性を確保（複数回実行可能）
-- ============================================================

-- ============================================================
-- Step 1: profiles.role の CHECK 制約を更新（新ロール対応）
-- ============================================================
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- 既存の CHECK 制約を探して削除
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

    -- 新しい CHECK 制約を追加
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check
            CHECK (role IN ('worker_internal', 'worker_external', 'admin', 'orderer'));
    END IF;
END $$;

-- ============================================================
-- Step 2: 既存データのロール移行
-- ============================================================
UPDATE public.profiles
SET role = CASE
    WHEN role = 'worker' THEN 'worker_internal'
    WHEN role = 'supervisor' THEN 'admin'
    WHEN role = 'client' THEN 'orderer'
    ELSE role
END
WHERE role IN ('worker', 'supervisor', 'client');

-- ============================================================
-- Step 3: daily_reports に承認フローカラム追加
-- ============================================================
-- 3a: approval_status カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_reports'
          AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE public.daily_reports
            ADD COLUMN approval_status text NOT NULL DEFAULT 'draft'
            CHECK (approval_status IN ('draft', 'submitted', 'admin_approved', 'orderer_confirmed', 'rejected'));
    END IF;
END $$;

-- 3b: approved_by カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_reports'
          AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE public.daily_reports
            ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- 3c: approved_at カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_reports'
          AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE public.daily_reports
            ADD COLUMN approved_at timestamptz;
    END IF;
END $$;

-- 3d: rejection_comment カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_reports'
          AND column_name = 'rejection_comment'
    ) THEN
        ALTER TABLE public.daily_reports
            ADD COLUMN rejection_comment text;
    END IF;
END $$;

-- 3e: approval_status 用インデックス
CREATE INDEX IF NOT EXISTS idx_daily_reports_approval_status
    ON public.daily_reports(approval_status);

-- ============================================================
-- Step 4: sites にドキュメント管理フラグ追加
-- ============================================================
-- 4a: has_blueprint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sites'
          AND column_name = 'has_blueprint'
    ) THEN
        ALTER TABLE public.sites
            ADD COLUMN has_blueprint boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- 4b: has_specification
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sites'
          AND column_name = 'has_specification'
    ) THEN
        ALTER TABLE public.sites
            ADD COLUMN has_specification boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- 4c: has_purchase_order
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sites'
          AND column_name = 'has_purchase_order'
    ) THEN
        ALTER TABLE public.sites
            ADD COLUMN has_purchase_order boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- 4d: has_schedule
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sites'
          AND column_name = 'has_schedule'
    ) THEN
        ALTER TABLE public.sites
            ADD COLUMN has_schedule boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- 4e: is_monitor
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sites'
          AND column_name = 'is_monitor'
    ) THEN
        ALTER TABLE public.sites
            ADD COLUMN is_monitor boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- ============================================================
-- Step 5: site_documents テーブル作成
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

CREATE INDEX IF NOT EXISTS idx_site_documents_site_id
    ON public.site_documents(site_id);
CREATE INDEX IF NOT EXISTS idx_site_documents_type
    ON public.site_documents(document_type);

COMMENT ON TABLE public.site_documents IS '現場ドキュメント（図面・仕様書・工程表等）';
COMMENT ON COLUMN public.site_documents.id IS 'ドキュメントID（UUID）';
COMMENT ON COLUMN public.site_documents.site_id IS '現場ID（外部キー）';
COMMENT ON COLUMN public.site_documents.document_type IS 'ドキュメント種別: blueprint=図面, specification=仕様書, purchase_order=発注書, schedule=工程表, other=その他';
COMMENT ON COLUMN public.site_documents.title IS 'ドキュメントタイトル';
COMMENT ON COLUMN public.site_documents.description IS '説明・備考';
COMMENT ON COLUMN public.site_documents.storage_path IS 'Supabase Storageのオブジェクトパス';
COMMENT ON COLUMN public.site_documents.file_name IS '元のファイル名';
COMMENT ON COLUMN public.site_documents.file_size IS 'ファイルサイズ（バイト）';
COMMENT ON COLUMN public.site_documents.version IS 'バージョン番号';
COMMENT ON COLUMN public.site_documents.uploaded_by IS 'アップロード者ユーザーID';
COMMENT ON COLUMN public.site_documents.created_at IS '作成日時';
COMMENT ON COLUMN public.site_documents.updated_at IS '更新日時';

-- ============================================================
-- Step 6: site_documents の RLS ポリシー
-- ============================================================
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'site_documents' AND policyname = 'site_documents_select_authenticated'
    ) THEN
        CREATE POLICY "site_documents_select_authenticated" ON public.site_documents
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'site_documents' AND policyname = 'site_documents_insert_admin'
    ) THEN
        CREATE POLICY "site_documents_insert_admin" ON public.site_documents
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'site_documents' AND policyname = 'site_documents_update_admin'
    ) THEN
        CREATE POLICY "site_documents_update_admin" ON public.site_documents
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'site_documents' AND policyname = 'site_documents_delete_admin'
    ) THEN
        CREATE POLICY "site_documents_delete_admin" ON public.site_documents
            FOR DELETE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- ============================================================
-- Step 7: process_checklists に inspection_phase 追加
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'process_checklists'
          AND column_name = 'inspection_phase'
    ) THEN
        ALTER TABLE public.process_checklists
            ADD COLUMN inspection_phase text NOT NULL DEFAULT 'during'
            CHECK (inspection_phase IN ('acceptance', 'during', 'post'));
    END IF;
END $$;

-- inspection_phase 用インデックス
CREATE INDEX IF NOT EXISTS idx_process_checklists_inspection_phase
    ON public.process_checklists(inspection_phase);

-- ============================================================
-- Step 8: report_materials テーブル作成
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

CREATE INDEX IF NOT EXISTS idx_report_materials_report_id
    ON public.report_materials(report_id);

COMMENT ON TABLE public.report_materials IS '使用材料報告';
COMMENT ON COLUMN public.report_materials.id IS '材料報告ID（UUID）';
COMMENT ON COLUMN public.report_materials.report_id IS '日次報告ID（外部キー）';
COMMENT ON COLUMN public.report_materials.material_name IS '材料名';
COMMENT ON COLUMN public.report_materials.product_number IS '品番（仕様書照合用）';
COMMENT ON COLUMN public.report_materials.quantity IS '使用数量';
COMMENT ON COLUMN public.report_materials.unit IS '単位';
COMMENT ON COLUMN public.report_materials.supplier IS '納入元';
COMMENT ON COLUMN public.report_materials.note IS '備考';
COMMENT ON COLUMN public.report_materials.created_at IS '作成日時';

-- ============================================================
-- Step 9: report_materials の RLS ポリシー
-- ============================================================
ALTER TABLE public.report_materials ENABLE ROW LEVEL SECURITY;

-- daily_reports と同じ参照権限を継承
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'report_materials' AND policyname = 'report_materials_select_via_report'
    ) THEN
        CREATE POLICY "report_materials_select_via_report" ON public.report_materials
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.daily_reports dr
                    WHERE dr.id = report_materials.report_id
                      AND (
                          dr.reporter_id = auth.uid()
                          OR EXISTS (
                              SELECT 1 FROM public.profiles p
                              WHERE p.id = auth.uid()
                                AND p.role IN ('admin', 'orderer')
                          )
                      )
                )
            );
    END IF;
END $$;

-- 対応する報告の作成者のみ材料を追加可能
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'report_materials' AND policyname = 'report_materials_insert_reporter'
    ) THEN
        CREATE POLICY "report_materials_insert_reporter" ON public.report_materials
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.daily_reports dr
                    WHERE dr.id = report_materials.report_id
                      AND dr.reporter_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 対応する報告の作成者のみ材料を更新可能
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'report_materials' AND policyname = 'report_materials_update_reporter'
    ) THEN
        CREATE POLICY "report_materials_update_reporter" ON public.report_materials
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.daily_reports dr
                    WHERE dr.id = report_materials.report_id
                      AND dr.reporter_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 対応する報告の作成者のみ材料を削除可能
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'report_materials' AND policyname = 'report_materials_delete_reporter'
    ) THEN
        CREATE POLICY "report_materials_delete_reporter" ON public.report_materials
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM public.daily_reports dr
                    WHERE dr.id = report_materials.report_id
                      AND dr.reporter_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================
-- Step 10: RLS ポリシーを新ロールに更新
-- ============================================================

-- 10a: profiles ポリシー削除・再作成
DROP POLICY IF EXISTS "profiles_select_all_by_supervisor_client" ON public.profiles;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles' AND policyname = 'profiles_select_all_by_admin_orderer'
    ) THEN
        CREATE POLICY "profiles_select_all_by_admin_orderer" ON public.profiles
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('admin', 'orderer')
                )
            );
    END IF;
END $$;

-- 10b: sites ポリシー削除・再作成
DROP POLICY IF EXISTS "sites_insert_supervisor" ON public.sites;
DROP POLICY IF EXISTS "sites_update_supervisor" ON public.sites;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'sites' AND policyname = 'sites_insert_admin'
    ) THEN
        CREATE POLICY "sites_insert_admin" ON public.sites
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'admin'
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'sites' AND policyname = 'sites_update_admin'
    ) THEN
        CREATE POLICY "sites_update_admin" ON public.sites
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'admin'
                )
            );
    END IF;
END $$;

-- 10c: processes ポリシー削除・再作成
DROP POLICY IF EXISTS "worker/supervisorが作成可能" ON public.processes;
DROP POLICY IF EXISTS "supervisorが更新可能" ON public.processes;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processes' AND policyname = 'processes_insert_worker_admin'
    ) THEN
        CREATE POLICY "processes_insert_worker_admin" ON public.processes
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processes' AND policyname = 'processes_update_admin'
    ) THEN
        CREATE POLICY "processes_update_admin" ON public.processes
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role = 'admin'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- 10d: daily_reports ポリシー削除・再作成
DROP POLICY IF EXISTS "daily_reports_select_own_worker" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_select_all_by_supervisor_client" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert_worker_supervisor" ON public.daily_reports;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_reports' AND policyname = 'daily_reports_select_own_worker'
    ) THEN
        CREATE POLICY "daily_reports_select_own_worker" ON public.daily_reports
            FOR SELECT USING (
                reporter_id = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('worker_internal', 'worker_external')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_reports' AND policyname = 'daily_reports_select_all_by_admin_orderer'
    ) THEN
        CREATE POLICY "daily_reports_select_all_by_admin_orderer" ON public.daily_reports
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('admin', 'orderer')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_reports' AND policyname = 'daily_reports_insert_worker_admin'
    ) THEN
        CREATE POLICY "daily_reports_insert_worker_admin" ON public.daily_reports
            FOR INSERT WITH CHECK (
                reporter_id = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('worker_internal', 'worker_external', 'admin')
                )
            );
    END IF;
END $$;

-- admin による承認用 UPDATE ポリシーを追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_reports' AND policyname = 'daily_reports_update_admin_approval'
    ) THEN
        CREATE POLICY "daily_reports_update_admin_approval" ON public.daily_reports
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'admin'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'admin'
                )
            );
    END IF;
END $$;

-- orderer による確認用 UPDATE ポリシーを追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_reports' AND policyname = 'daily_reports_update_orderer_confirm'
    ) THEN
        CREATE POLICY "daily_reports_update_orderer_confirm" ON public.daily_reports
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'orderer'
                )
                AND approval_status = 'admin_approved'
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role = 'orderer'
                )
            );
    END IF;
END $$;

-- 10e: report_photos ポリシー削除・再作成
DROP POLICY IF EXISTS "report_photos_select_via_report" ON public.report_photos;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'report_photos' AND policyname = 'report_photos_select_via_report'
    ) THEN
        CREATE POLICY "report_photos_select_via_report" ON public.report_photos
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.daily_reports dr
                    WHERE dr.id = report_photos.report_id
                      AND (
                          dr.reporter_id = auth.uid()
                          OR EXISTS (
                              SELECT 1 FROM public.profiles p
                              WHERE p.id = auth.uid()
                                AND p.role IN ('admin', 'orderer')
                          )
                      )
                )
            );
    END IF;
END $$;

-- 10f: process_checklists ポリシー削除・再作成
DROP POLICY IF EXISTS "checklists_insert_worker_supervisor" ON public.process_checklists;
DROP POLICY IF EXISTS "checklists_update_worker_supervisor" ON public.process_checklists;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'process_checklists' AND policyname = 'checklists_insert_worker_admin'
    ) THEN
        CREATE POLICY "checklists_insert_worker_admin" ON public.process_checklists
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'process_checklists' AND policyname = 'checklists_update_worker_admin'
    ) THEN
        CREATE POLICY "checklists_update_worker_admin" ON public.process_checklists
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
                )
            );
    END IF;
END $$;

-- ============================================================
-- Step 11: handle_new_user() トリガー更新
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
-- Step 12: Comments 更新
-- ============================================================
COMMENT ON COLUMN public.profiles.role IS 'ロール: worker_internal=社内作業者, worker_external=外部作業者, admin=管理者, orderer=発注者';
COMMENT ON COLUMN public.daily_reports.approval_status IS '承認状態: draft=下書き, submitted=提出済み, admin_approved=管理者承認済み, orderer_confirmed=発注者確認済み, rejected=却下';
COMMENT ON COLUMN public.daily_reports.approved_by IS '承認者ユーザーID';
COMMENT ON COLUMN public.daily_reports.approved_at IS '承認日時';
COMMENT ON COLUMN public.daily_reports.rejection_comment IS '却下理由';
COMMENT ON COLUMN public.sites.has_blueprint IS '図面ありフラグ';
COMMENT ON COLUMN public.sites.has_specification IS '仕様書ありフラグ';
COMMENT ON COLUMN public.sites.has_purchase_order IS '発注書ありフラグ';
COMMENT ON COLUMN public.sites.has_schedule IS '工程表ありフラグ';
COMMENT ON COLUMN public.sites.is_monitor IS 'モニター施工フラグ（モニター案件の識別用）';
COMMENT ON COLUMN public.process_checklists.inspection_phase IS '検査フェーズ: acceptance=受入検査, during=中間検査, post=完了検査';

-- ============================================================
-- 検証クエリ（マイグレーション後に実行して確認）
-- ============================================================
-- SELECT role, count(*) FROM public.profiles GROUP BY role;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_reports' AND column_name LIKE '%approval%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'sites' AND column_name LIKE 'has_%';
-- SELECT count(*) FROM information_schema.tables WHERE table_name IN ('site_documents', 'report_materials');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'process_checklists' AND column_name = 'inspection_phase';
-- SELECT policyname FROM pg_policies WHERE tablename = 'daily_reports';
