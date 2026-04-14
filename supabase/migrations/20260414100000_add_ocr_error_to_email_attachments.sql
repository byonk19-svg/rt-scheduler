alter table public.availability_email_attachments
  add column if not exists ocr_error text null;
