-- ============================================================
-- 現場報告システム データベーススキーマ
-- Supabase / PostgreSQL
-- Migration v4 適用後の最終状態
-- ============================================================

-- ============================================================
-- 1. profiles テーブル
-- ユーザープロフィール（auth.usersと連携）
-- ============================================================
CREATE TABLE public.profiles (
    id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       text        NOT NULL,
    name        text        NOT NULL,
    role        text        NOT NULL CHECK (role IN ('worker_internal', 'worker_external', 'admin', 'orderer')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles         IS 'ユーザープロフィール（作業者・管理者・発注者）';
COMMENT ON COLUMN public.profiles.id       IS 'ユーザーID（auth.usersと同じUUID）';
COMMENT ON COLUMN public.profiles.email    IS 'メールアドレス';
COMMENT ON COLUMN public.profiles.name     IS '氏名';
COMMENT ON COLUMN public.profiles.role     IS 'ロール: worker_internal=社内作業者, worker_external=外部作業者, admin=管理者, orderer=発注者';
COMMENT ON COLUMN public.profiles.created_at IS '作成日時';

-- ============================================================
-- 2. sites テーブル
-- 現場情報
-- ============================================================
CREATE TABLE public.sites (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text        NOT NULL,
    address           text        NOT NULL,
    start_date        date,
    end_date          date,
    has_blueprint     boolean     NOT NULL DEFAULT false,
    has_specification boolean     NOT NULL DEFAULT false,
    has_purchase_order boolean    NOT NULL DEFAULT false,
    has_schedule      boolean     NOT NULL DEFAULT false,
    is_monitor        boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sites_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

COMMENT ON TABLE  public.sites                    IS '現場マスタ';
COMMENT ON COLUMN public.sites.id                 IS '現場ID（UUID）';
COMMENT ON COLUMN public.sites.name               IS '現場名';
COMMENT ON COLUMN public.sites.address            IS '現場住所';
COMMENT ON COLUMN public.sites.start_date         IS '工事開始日';
COMMENT ON COLUMN public.sites.end_date           IS '工事終了（予定）日';
COMMENT ON COLUMN public.sites.has_blueprint      IS '図面ありフラグ';
COMMENT ON COLUMN public.sites.has_specification  IS '仕様書ありフラグ';
COMMENT ON COLUMN public.sites.has_purchase_order IS '発注書ありフラグ';
COMMENT ON COLUMN public.sites.has_schedule       IS '工程表ありフラグ';
COMMENT ON COLUMN public.sites.is_monitor         IS 'モニター施工フラグ（モニター案件の識別用）';
COMMENT ON COLUMN public.sites.created_at         IS '作成日時';

-- ============================================================
-- 3. site_documents テーブル
-- 現場ドキュメント（図面・仕様書・工程表等）
-- ============================================================
CREATE TABLE public.site_documents (
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

CREATE INDEX idx_site_documents_site_id ON public.site_documents(site_id);
CREATE INDEX idx_site_documents_type ON public.site_documents(document_type);

COMMENT ON TABLE  public.site_documents           IS '現場ドキュメント（図面・仕様書・工程表等）';
COMMENT ON COLUMN public.site_documents.id        IS 'ドキュメントID（UUID）';
COMMENT ON COLUMN public.site_documents.site_id   IS '現場ID（外部キー）';
COMMENT ON COLUMN public.site_documents.document_type IS 'ドキュメント種別: blueprint=図面, specification=仕様書, purchase_order=発注書, schedule=工程表, other=その他';
COMMENT ON COLUMN public.site_documents.title     IS 'ドキュメントタイトル';
COMMENT ON COLUMN public.site_documents.description IS '説明・備考';
COMMENT ON COLUMN public.site_documents.storage_path IS 'Supabase Storageのオブジェクトパス';
COMMENT ON COLUMN public.site_documents.file_name IS '元のファイル名';
COMMENT ON COLUMN public.site_documents.file_size IS 'ファイルサイズ（バイト）';
COMMENT ON COLUMN public.site_documents.version   IS 'バージョン番号';
COMMENT ON COLUMN public.site_documents.uploaded_by IS 'アップロード者ユーザーID';
COMMENT ON COLUMN public.site_documents.created_at IS '作成日時';
COMMENT ON COLUMN public.site_documents.updated_at IS '更新日時';

-- ============================================================
-- 4. processes テーブル
-- 工程情報（現場に紐づく）
-- ============================================================
CREATE TABLE public.processes (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       uuid        NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    category      text        NOT NULL,
    name          text        NOT NULL,
    progress_rate integer     NOT NULL DEFAULT 0 CHECK (progress_rate BETWEEN 0 AND 100),
    status        text        NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_processes_site_category_name ON public.processes(site_id, category, name);
CREATE INDEX idx_processes_site_id ON public.processes(site_id);

COMMENT ON TABLE  public.processes               IS '工程マスタ（現場に紐づく作業工程）';
COMMENT ON COLUMN public.processes.id            IS '工程ID（UUID）';
COMMENT ON COLUMN public.processes.site_id       IS '現場ID（外部キー）';
COMMENT ON COLUMN public.processes.category      IS '工程カテゴリ';
COMMENT ON COLUMN public.processes.name          IS '工程名';
COMMENT ON COLUMN public.processes.progress_rate IS '進捗率（0〜100）';
COMMENT ON COLUMN public.processes.status        IS '状態: in_progress=進行中, completed=完了';
COMMENT ON COLUMN public.processes.created_at    IS '作成日時';

-- ============================================================
-- 5. daily_reports テーブル
-- 日次報告（工程に紐づく）
-- ============================================================
CREATE TABLE public.daily_reports (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id          uuid        NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    process_id       uuid        NOT NULL REFERENCES public.processes(id),
    reporter_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    report_date      date        NOT NULL,
    work_process     text        NOT NULL,
    work_content     text        NOT NULL,
    workers          text[]      NOT NULL DEFAULT '{}',
    progress_rate    integer     NOT NULL DEFAULT 0 CHECK (progress_rate BETWEEN 0 AND 100),
    weather          text,
    work_hours       numeric(4,1) CHECK (work_hours >= 0),
    issues           text,
    approval_status  text        NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'admin_approved', 'orderer_confirmed', 'rejected')),
    approved_by      uuid        REFERENCES auth.users(id),
    approved_at      timestamptz,
    rejection_comment text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_reports_process_id_report_date_key UNIQUE (process_id, report_date)
);

COMMENT ON TABLE  public.daily_reports                  IS '日次報告';
COMMENT ON COLUMN public.daily_reports.id               IS '報告ID（UUID）';
COMMENT ON COLUMN public.daily_reports.site_id          IS '現場ID（外部キー）';
COMMENT ON COLUMN public.daily_reports.process_id       IS '工程ID（外部キー）';
COMMENT ON COLUMN public.daily_reports.reporter_id      IS '報告者ユーザーID（外部キー）';
COMMENT ON COLUMN public.daily_reports.report_date      IS '報告日';
COMMENT ON COLUMN public.daily_reports.work_process     IS '作業工程';
COMMENT ON COLUMN public.daily_reports.work_content     IS '作業内容';
COMMENT ON COLUMN public.daily_reports.workers          IS '作業従事者リスト（テキスト配列）';
COMMENT ON COLUMN public.daily_reports.progress_rate    IS '進捗率（0〜100）';
COMMENT ON COLUMN public.daily_reports.weather          IS '天気';
COMMENT ON COLUMN public.daily_reports.work_hours       IS '作業時間（時間）';
COMMENT ON COLUMN public.daily_reports.issues           IS '問題・懸念事項';
COMMENT ON COLUMN public.daily_reports.approval_status  IS '承認状態: draft=下書き, submitted=提出済み, admin_approved=管理者承認済み, orderer_confirmed=発注者確認済み, rejected=却下';
COMMENT ON COLUMN public.daily_reports.approved_by      IS '承認者ユーザーID';
COMMENT ON COLUMN public.daily_reports.approved_at      IS '承認日時';
COMMENT ON COLUMN public.daily_reports.rejection_comment IS '却下理由';
COMMENT ON COLUMN public.daily_reports.created_at       IS '作成日時';

-- ============================================================
-- 6. report_photos テーブル
-- 報告写真・動画
-- ============================================================
CREATE TABLE public.report_photos (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    uuid        NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    storage_path text        NOT NULL,
    photo_type   text        NOT NULL CHECK (photo_type IN (
                                 'before',
                                 'during',
                                 'after',
                                 'corner_ne',
                                 'corner_nw',
                                 'corner_se',
                                 'corner_sw'
                             )),
    media_type   text        NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
    caption      text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.report_photos              IS '報告写真・動画';
COMMENT ON COLUMN public.report_photos.id           IS '写真ID（UUID）';
COMMENT ON COLUMN public.report_photos.report_id    IS '日次報告ID（外部キー）';
COMMENT ON COLUMN public.report_photos.storage_path IS 'Supabase Storageのオブジェクトパス';
COMMENT ON COLUMN public.report_photos.photo_type   IS '写真種別: before=施工前, during=施工中, after=施工後, corner_ne/nw/se/sw=四隅';
COMMENT ON COLUMN public.report_photos.media_type   IS 'メディア種別: photo=写真, video=動画';
COMMENT ON COLUMN public.report_photos.caption      IS '写真キャプション';
COMMENT ON COLUMN public.report_photos.created_at   IS '作成日時';

-- ============================================================
-- 7. report_materials テーブル
-- 使用材料報告
-- ============================================================
CREATE TABLE public.report_materials (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id     uuid          NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    material_name text          NOT NULL,
    product_number text,
    quantity      numeric(10,2) CHECK (quantity >= 0),
    unit          text,
    supplier      text,
    note          text,
    created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_materials_report_id ON public.report_materials(report_id);

COMMENT ON TABLE  public.report_materials            IS '使用材料報告';
COMMENT ON COLUMN public.report_materials.id         IS '材料報告ID（UUID）';
COMMENT ON COLUMN public.report_materials.report_id  IS '日次報告ID（外部キー）';
COMMENT ON COLUMN public.report_materials.material_name IS '材料名';
COMMENT ON COLUMN public.report_materials.product_number IS '品番（仕様書照合用）';
COMMENT ON COLUMN public.report_materials.quantity   IS '使用数量';
COMMENT ON COLUMN public.report_materials.unit       IS '単位';
COMMENT ON COLUMN public.report_materials.supplier   IS '納入元';
COMMENT ON COLUMN public.report_materials.note       IS '備考';
COMMENT ON COLUMN public.report_materials.created_at IS '作成日時';

-- ============================================================
-- 8. process_checklists テーブル
-- 工程チェックリスト
-- ============================================================
CREATE TABLE public.process_checklists (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id       uuid        NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    item_text        text        NOT NULL,
    is_checked       boolean     NOT NULL DEFAULT false,
    checked_at       timestamptz,
    checked_by       uuid        REFERENCES auth.users(id),
    photo_id         uuid        REFERENCES public.report_photos(id),
    note             text,
    inspection_phase text        NOT NULL DEFAULT 'during' CHECK (inspection_phase IN ('acceptance', 'during', 'post')),
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_process_checklists_process_id ON public.process_checklists(process_id);
CREATE INDEX idx_process_checklists_inspection_phase ON public.process_checklists(inspection_phase);

COMMENT ON TABLE  public.process_checklists               IS '工程チェックリスト';
COMMENT ON COLUMN public.process_checklists.id            IS 'チェックリストID（UUID）';
COMMENT ON COLUMN public.process_checklists.process_id    IS '工程ID（外部キー）';
COMMENT ON COLUMN public.process_checklists.item_text     IS 'チェック項目テキスト';
COMMENT ON COLUMN public.process_checklists.is_checked    IS 'チェック済みフラグ';
COMMENT ON COLUMN public.process_checklists.checked_at    IS 'チェック日時';
COMMENT ON COLUMN public.process_checklists.checked_by    IS 'チェック実施者ユーザーID';
COMMENT ON COLUMN public.process_checklists.photo_id      IS '添付写真ID（外部キー）';
COMMENT ON COLUMN public.process_checklists.note          IS '備考';
COMMENT ON COLUMN public.process_checklists.inspection_phase IS '検査フェーズ: acceptance=受入検査, during=中間検査, post=完了検査';
COMMENT ON COLUMN public.process_checklists.created_at    IS '作成日時';

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_daily_reports_site_id        ON public.daily_reports(site_id);
CREATE INDEX idx_daily_reports_reporter_id    ON public.daily_reports(reporter_id);
CREATE INDEX idx_daily_reports_report_date    ON public.daily_reports(report_date DESC);
CREATE INDEX idx_daily_reports_process_id     ON public.daily_reports(process_id);
CREATE INDEX idx_daily_reports_approval_status ON public.daily_reports(approval_status);
CREATE INDEX idx_report_photos_report_id      ON public.report_photos(report_id);

-- ============================================================
-- Row Level Security (RLS) の有効化
-- ============================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_materials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_checklists  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS ポリシー: profiles
-- ============================================================
-- 自分自身のプロフィールは参照可能
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- admin / orderer は全プロフィールを参照可能
CREATE POLICY "profiles_select_all_by_admin_orderer"
    ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'orderer')
        )
    );

-- 自分自身のプロフィールのみ更新可能
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- ユーザー登録時にプロフィール作成可能
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS ポリシー: sites
-- ============================================================
-- 全認証ユーザーが参照可能
CREATE POLICY "sites_select_authenticated"
    ON public.sites
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- admin のみ作成可能
CREATE POLICY "sites_insert_admin"
    ON public.sites
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

-- admin のみ更新可能
CREATE POLICY "sites_update_admin"
    ON public.sites
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

-- ============================================================
-- RLS ポリシー: site_documents
-- ============================================================
-- 全認証ユーザーが参照可能
CREATE POLICY "site_documents_select_authenticated"
    ON public.site_documents
    FOR SELECT
    TO authenticated
    USING (true);

-- admin のみ作成可能
CREATE POLICY "site_documents_insert_admin"
    ON public.site_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- admin のみ更新可能
CREATE POLICY "site_documents_update_admin"
    ON public.site_documents
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- admin のみ削除可能
CREATE POLICY "site_documents_delete_admin"
    ON public.site_documents
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- ============================================================
-- RLS ポリシー: processes
-- ============================================================
-- 全認証ユーザーが参照可能
CREATE POLICY "全認証ユーザーが参照可能"
    ON public.processes
    FOR SELECT
    TO authenticated
    USING (true);

-- worker_internal / worker_external / admin が作成可能
CREATE POLICY "processes_insert_worker_admin"
    ON public.processes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
        )
    );

-- admin が更新可能
CREATE POLICY "processes_update_admin"
    ON public.processes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- ============================================================
-- RLS ポリシー: daily_reports
-- ============================================================
-- worker: 自分が作成した報告のみ参照可能
CREATE POLICY "daily_reports_select_own_worker"
    ON public.daily_reports
    FOR SELECT
    USING (
        reporter_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('worker_internal', 'worker_external')
        )
    );

-- admin / orderer: 全報告を参照可能
CREATE POLICY "daily_reports_select_all_by_admin_orderer"
    ON public.daily_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'orderer')
        )
    );

-- worker_internal / worker_external / admin: 報告を作成可能
CREATE POLICY "daily_reports_insert_worker_admin"
    ON public.daily_reports
    FOR INSERT
    WITH CHECK (
        reporter_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('worker_internal', 'worker_external', 'admin')
        )
    );

-- 報告者本人のみ更新可能（一般更新）
CREATE POLICY "daily_reports_update_own"
    ON public.daily_reports
    FOR UPDATE
    USING (reporter_id = auth.uid());

-- admin による承認用 UPDATE ポリシー
CREATE POLICY "daily_reports_update_admin_approval"
    ON public.daily_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

-- orderer による確認用 UPDATE ポリシー
CREATE POLICY "daily_reports_update_orderer_confirm"
    ON public.daily_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'orderer'
        )
        AND approval_status = 'admin_approved'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'orderer'
        )
    );

-- 報告者本人のみ削除可能
CREATE POLICY "daily_reports_delete_own"
    ON public.daily_reports
    FOR DELETE
    USING (reporter_id = auth.uid());

-- ============================================================
-- RLS ポリシー: report_photos
-- ============================================================
-- daily_reports と同じ参照権限を継承
CREATE POLICY "report_photos_select_via_report"
    ON public.report_photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_photos.report_id
              AND (
                  dr.reporter_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.profiles p
                      WHERE p.id = auth.uid()
                        AND p.role IN ('admin', 'orderer')
                  )
              )
        )
    );

-- 対応する報告の作成者のみ写真を追加可能
CREATE POLICY "report_photos_insert_reporter"
    ON public.report_photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_photos.report_id
              AND dr.reporter_id = auth.uid()
        )
    );

-- 対応する報告の作成者のみ写真を削除可能
CREATE POLICY "report_photos_delete_reporter"
    ON public.report_photos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_photos.report_id
              AND dr.reporter_id = auth.uid()
        )
    );

-- ============================================================
-- RLS ポリシー: report_materials
-- ============================================================
-- daily_reports と同じ参照権限を継承
CREATE POLICY "report_materials_select_via_report"
    ON public.report_materials
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_materials.report_id
              AND (
                  dr.reporter_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.profiles p
                      WHERE p.id = auth.uid()
                        AND p.role IN ('admin', 'orderer')
                  )
              )
        )
    );

-- 対応する報告の作成者のみ材料を追加可能
CREATE POLICY "report_materials_insert_reporter"
    ON public.report_materials
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_materials.report_id
              AND dr.reporter_id = auth.uid()
        )
    );

-- 対応する報告の作成者のみ材料を更新可能
CREATE POLICY "report_materials_update_reporter"
    ON public.report_materials
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_materials.report_id
              AND dr.reporter_id = auth.uid()
        )
    );

-- 対応する報告の作成者のみ材料を削除可能
CREATE POLICY "report_materials_delete_reporter"
    ON public.report_materials
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.daily_reports dr
            WHERE dr.id = report_materials.report_id
              AND dr.reporter_id = auth.uid()
        )
    );

-- ============================================================
-- RLS ポリシー: process_checklists
-- ============================================================
-- 全認証ユーザーが参照可能
CREATE POLICY "checklists_select_authenticated"
    ON public.process_checklists
    FOR SELECT
    TO authenticated
    USING (true);

-- worker_internal / worker_external / admin が作成可能
CREATE POLICY "checklists_insert_worker_admin"
    ON public.process_checklists
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
        )
    );

-- worker_internal / worker_external / admin が更新可能
CREATE POLICY "checklists_update_worker_admin"
    ON public.process_checklists
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('worker_internal', 'worker_external', 'admin')
        )
    );

-- ============================================================
-- 新規ユーザー登録時に自動でプロフィール作成するトリガー
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
