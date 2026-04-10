alter table public.availability_email_attachments
  add column if not exists ocr_status text not null default 'not_run';

alter table public.availability_email_attachments
  add column if not exists ocr_text text null;

alter table public.availability_email_attachments
  add column if not exists ocr_model text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_attachments_ocr_status_check'
  ) then
    alter table public.availability_email_attachments
      add constraint availability_email_attachments_ocr_status_check
      check (ocr_status in ('not_run', 'completed', 'failed', 'skipped'));
  end if;
end
$$;
