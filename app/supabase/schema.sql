-- ============================================================
-- 現場報告システム フェーズ1 データベーススキーマ
-- Supabase / PostgreSQL
-- ============================================================

-- ============================================================
-- 1. profiles テーブル
-- ユーザープロフィール（auth.usersと連携）
-- ============================================================
create table public.profiles (
    id          uuid        primary key references auth.users(id) on delete cascade,
    email       text        not null,
    name        text        not null,
    role        text        not null check (role in ('worker', 'supervisor', 'client')),
    created_at  timestamptz not null default now()
);

comment on table  public.profiles         is 'ユーザープロフィール（作業者・監督・元請け）';
comment on column public.profiles.id       is 'ユーザーID（auth.usersと同じUUID）';
comment on column public.profiles.email    is 'メールアドレス';
comment on column public.profiles.name     is '氏名';
comment on column public.profiles.role     is 'ロール: worker=現場作業者, supervisor=監督, client=元請け';
comment on column public.profiles.created_at is '作成日時';

-- ============================================================
-- 2. sites テーブル
-- 現場情報
-- ============================================================
create table public.sites (
    id          uuid        primary key default gen_random_uuid(),
    name        text        not null,
    address     text        not null,
    start_date  date,
    end_date    date,
    created_at  timestamptz not null default now(),
    constraint sites_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

comment on table  public.sites            is '現場マスタ';
comment on column public.sites.id         is '現場ID（UUID）';
comment on column public.sites.name       is '現場名';
comment on column public.sites.address    is '現場住所';
comment on column public.sites.start_date is '工事開始日';
comment on column public.sites.end_date   is '工事終了（予定）日';
comment on column public.sites.created_at is '作成日時';

-- ============================================================
-- 3. daily_reports テーブル
-- 日次報告
-- ============================================================
create table public.daily_reports (
    id            uuid        primary key default gen_random_uuid(),
    site_id       uuid        not null references public.sites(id) on delete restrict,
    reporter_id   uuid        not null references auth.users(id) on delete restrict,
    report_date   date        not null,
    work_process  text        not null,
    work_content  text        not null,
    workers       text[]      not null default '{}',
    progress_rate integer     not null default 0 check (progress_rate between 0 and 100),
    weather       text,
    work_hours    numeric(4,1) check (work_hours >= 0),
    issues        text,
    created_at    timestamptz not null default now(),
    constraint daily_reports_unique_site_date unique (site_id, report_date)
);

comment on table  public.daily_reports               is '日次報告';
comment on column public.daily_reports.id            is '報告ID（UUID）';
comment on column public.daily_reports.site_id       is '現場ID（外部キー）';
comment on column public.daily_reports.reporter_id   is '報告者ユーザーID（外部キー）';
comment on column public.daily_reports.report_date   is '報告日';
comment on column public.daily_reports.work_process  is '作業工程';
comment on column public.daily_reports.work_content  is '作業内容';
comment on column public.daily_reports.workers       is '作業従事者リスト（テキスト配列）';
comment on column public.daily_reports.progress_rate is '進捗率（0〜100）';
comment on column public.daily_reports.weather       is '天気';
comment on column public.daily_reports.work_hours    is '作業時間（時間）';
comment on column public.daily_reports.issues        is '問題・懸念事項';
comment on column public.daily_reports.created_at    is '作成日時';

-- ============================================================
-- 4. report_photos テーブル
-- 報告写真
-- ============================================================
create table public.report_photos (
    id           uuid        primary key default gen_random_uuid(),
    report_id    uuid        not null references public.daily_reports(id) on delete cascade,
    storage_path text        not null,
    photo_type   text        not null check (photo_type in (
                                 'before',
                                 'after',
                                 'corner_ne',
                                 'corner_nw',
                                 'corner_se',
                                 'corner_sw'
                             )),
    caption      text,
    created_at   timestamptz not null default now()
);

comment on table  public.report_photos              is '報告写真';
comment on column public.report_photos.id           is '写真ID（UUID）';
comment on column public.report_photos.report_id    is '日次報告ID（外部キー）';
comment on column public.report_photos.storage_path is 'Supabase Storageのオブジェクトパス';
comment on column public.report_photos.photo_type   is '写真種別: before=施工前, after=施工後, corner_ne/nw/se/sw=四隅';
comment on column public.report_photos.caption      is '写真キャプション';
comment on column public.report_photos.created_at   is '作成日時';

-- ============================================================
-- インデックス
-- ============================================================
create index idx_daily_reports_site_id     on public.daily_reports(site_id);
create index idx_daily_reports_reporter_id on public.daily_reports(reporter_id);
create index idx_daily_reports_report_date on public.daily_reports(report_date desc);
create index idx_report_photos_report_id   on public.report_photos(report_id);

-- ============================================================
-- Row Level Security (RLS) の有効化
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.sites          enable row level security;
alter table public.daily_reports  enable row level security;
alter table public.report_photos  enable row level security;

-- ============================================================
-- RLS ポリシー: profiles
-- ============================================================
-- 自分自身のプロフィールは参照可能
create policy "profiles_select_own"
    on public.profiles
    for select
    using (auth.uid() = id);

-- supervisor / client は全プロフィールを参照可能
create policy "profiles_select_all_by_supervisor_client"
    on public.profiles
    for select
    using (
        exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role in ('supervisor', 'client')
        )
    );

-- 自分自身のプロフィールのみ更新可能
create policy "profiles_update_own"
    on public.profiles
    for update
    using (auth.uid() = id);

-- ユーザー登録時にプロフィール作成可能
create policy "profiles_insert_own"
    on public.profiles
    for insert
    with check (auth.uid() = id);

-- ============================================================
-- RLS ポリシー: sites
-- ============================================================
-- 全認証ユーザーが参照可能
create policy "sites_select_authenticated"
    on public.sites
    for select
    using (auth.uid() is not null);

-- supervisor のみ作成可能
create policy "sites_insert_supervisor"
    on public.sites
    for insert
    with check (
        exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'supervisor'
        )
    );

-- supervisor のみ更新可能
create policy "sites_update_supervisor"
    on public.sites
    for update
    using (
        exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'supervisor'
        )
    );

-- ============================================================
-- RLS ポリシー: daily_reports
-- ============================================================
-- worker: 自分が作成した報告のみ参照可能
create policy "daily_reports_select_own_worker"
    on public.daily_reports
    for select
    using (
        reporter_id = auth.uid()
        and exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'worker'
        )
    );

-- supervisor / client: 全報告を参照可能
create policy "daily_reports_select_all_by_supervisor_client"
    on public.daily_reports
    for select
    using (
        exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role in ('supervisor', 'client')
        )
    );

-- worker / supervisor: 報告を作成可能
create policy "daily_reports_insert_worker_supervisor"
    on public.daily_reports
    for insert
    with check (
        reporter_id = auth.uid()
        and exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role in ('worker', 'supervisor')
        )
    );

-- 報告者本人のみ更新可能
create policy "daily_reports_update_own"
    on public.daily_reports
    for update
    using (reporter_id = auth.uid());

-- 報告者本人のみ削除可能
create policy "daily_reports_delete_own"
    on public.daily_reports
    for delete
    using (reporter_id = auth.uid());

-- ============================================================
-- RLS ポリシー: report_photos
-- ============================================================
-- daily_reports と同じ参照権限を継承（報告が見える人は写真も見える）
create policy "report_photos_select_via_report"
    on public.report_photos
    for select
    using (
        exists (
            select 1
            from public.daily_reports dr
            where dr.id = report_photos.report_id
              and (
                  dr.reporter_id = auth.uid()
                  or exists (
                      select 1
                      from public.profiles p
                      where p.id = auth.uid()
                        and p.role in ('supervisor', 'client')
                  )
              )
        )
    );

-- 対応する報告の作成者のみ写真を追加可能
create policy "report_photos_insert_reporter"
    on public.report_photos
    for insert
    with check (
        exists (
            select 1
            from public.daily_reports dr
            where dr.id = report_photos.report_id
              and dr.reporter_id = auth.uid()
        )
    );

-- 対応する報告の作成者のみ写真を削除可能
create policy "report_photos_delete_reporter"
    on public.report_photos
    for delete
    using (
        exists (
            select 1
            from public.daily_reports dr
            where dr.id = report_photos.report_id
              and dr.reporter_id = auth.uid()
        )
    );

-- ============================================================
-- 新規ユーザー登録時に自動でプロフィール作成するトリガー
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, name, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'role', 'worker')
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
