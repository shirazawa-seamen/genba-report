-- ============================================================
-- 現場カラー対応
-- ============================================================

do $$ begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sites'
      and column_name = 'site_color'
  ) then
    alter table public.sites add column site_color text not null default '#0EA5E9';
  end if;
end $$;

update public.sites
set site_color = '#0EA5E9'
where site_color is null or site_color = '';

comment on column public.sites.site_color is '現場表示カラー';
