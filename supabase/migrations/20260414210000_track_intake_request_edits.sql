alter table public.availability_email_intake_items
  add column if not exists original_parsed_requests jsonb null,
  add column if not exists manually_edited_at timestamptz null;
