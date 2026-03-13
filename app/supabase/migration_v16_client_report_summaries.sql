create table if not exists public.client_report_summaries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  report_date date not null,
  summary_text text not null,
  source_report_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'client_confirmed')),
  generated_by uuid references public.profiles(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, report_date)
);

create index if not exists idx_client_report_summaries_site_date
  on public.client_report_summaries(site_id, report_date desc);

alter table public.client_report_summaries enable row level security;

drop policy if exists "client_report_summaries_select_authenticated" on public.client_report_summaries;
drop policy if exists "client_report_summaries_modify_admin_manager" on public.client_report_summaries;

create policy "client_report_summaries_select_authenticated"
  on public.client_report_summaries
  for select
  using (auth.uid() is not null);

create policy "client_report_summaries_modify_admin_manager"
  on public.client_report_summaries
  for all
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );
