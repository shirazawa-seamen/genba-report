create table if not exists public.secure_settings (
  key text primary key,
  encrypted_value text not null,
  last_four text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.secure_settings is '暗号化済みアプリ設定';
comment on column public.secure_settings.key is '設定キー';
comment on column public.secure_settings.encrypted_value is '暗号化済み設定値';
comment on column public.secure_settings.last_four is '表示用の末尾4桁';

alter table public.secure_settings enable row level security;

drop policy if exists "secure_settings_no_direct_access" on public.secure_settings;

create policy "secure_settings_no_direct_access"
  on public.secure_settings
  for all
  using (false)
  with check (false);
