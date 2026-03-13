alter table public.client_report_summaries
add column if not exists official_progress jsonb not null default '[]'::jsonb;

comment on column public.client_report_summaries.official_progress is '管理者が確定した工程別の公式進捗率';
