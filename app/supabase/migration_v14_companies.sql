create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.companies is '会社マスター';
comment on column public.companies.name is '会社名';

alter table public.profiles
add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.sites
add column if not exists company_id uuid references public.companies(id) on delete set null;

insert into public.companies (name)
select distinct trim(client_name)
from public.sites
where client_name is not null
  and trim(client_name) <> ''
on conflict (name) do nothing;

update public.sites s
set company_id = c.id
from public.companies c
where s.company_id is null
  and s.client_name is not null
  and trim(s.client_name) <> ''
  and c.name = trim(s.client_name);

create index if not exists idx_profiles_company_id
  on public.profiles(company_id);

create index if not exists idx_sites_company_id
  on public.sites(company_id);

alter table public.companies enable row level security;

drop policy if exists "companies_select_authenticated" on public.companies;
drop policy if exists "companies_insert_admin_manager" on public.companies;
drop policy if exists "companies_update_admin_manager" on public.companies;
drop policy if exists "companies_delete_admin_manager" on public.companies;

create policy "companies_select_authenticated"
  on public.companies
  for select
  using (auth.uid() is not null);

create policy "companies_insert_admin_manager"
  on public.companies
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

create policy "companies_update_admin_manager"
  on public.companies
  for update
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

create policy "companies_delete_admin_manager"
  on public.companies
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );
