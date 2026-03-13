alter table public.daily_reports
drop constraint if exists daily_reports_process_id_report_date_key;

alter table public.daily_reports
add constraint daily_reports_reporter_process_date_key
unique (reporter_id, process_id, report_date);
