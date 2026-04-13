alter table public.availability_email_intakes
  add column if not exists batch_status text not null default 'needs_review',
  add column if not exists item_count integer not null default 0,
  add column if not exists auto_applied_count integer not null default 0,
  add column if not exists needs_review_count integer not null default 0,
  add column if not exists failed_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intakes_batch_status_check'
  ) then
    alter table public.availability_email_intakes
      add constraint availability_email_intakes_batch_status_check
      check (batch_status in ('parsed', 'needs_review', 'failed', 'applied'));
  end if;
end
$$;

create table if not exists public.availability_email_intake_items (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.availability_email_intakes (id) on delete cascade,
  source_type text not null,
  source_label text not null,
  attachment_id uuid null references public.availability_email_attachments (id) on delete set null,
  raw_text text null,
  ocr_status text not null default 'not_run',
  ocr_model text null,
  ocr_error text null,
  parse_status text not null default 'needs_review',
  confidence_level text not null default 'low',
  confidence_reasons jsonb not null default '[]'::jsonb,
  extracted_employee_name text null,
  employee_match_candidates jsonb not null default '[]'::jsonb,
  matched_therapist_id uuid null references public.profiles (id) on delete set null,
  matched_cycle_id uuid null references public.schedule_cycles (id) on delete set null,
  parsed_requests jsonb not null default '[]'::jsonb,
  unresolved_lines jsonb not null default '[]'::jsonb,
  auto_applied_at timestamptz null,
  auto_applied_by uuid null references public.profiles (id) on delete set null,
  apply_error text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intake_items_source_type_check'
  ) then
    alter table public.availability_email_intake_items
      add constraint availability_email_intake_items_source_type_check
      check (source_type in ('body', 'attachment'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intake_items_ocr_status_check'
  ) then
    alter table public.availability_email_intake_items
      add constraint availability_email_intake_items_ocr_status_check
      check (ocr_status in ('not_run', 'completed', 'failed', 'skipped'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intake_items_parse_status_check'
  ) then
    alter table public.availability_email_intake_items
      add constraint availability_email_intake_items_parse_status_check
      check (parse_status in ('parsed', 'auto_applied', 'needs_review', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intake_items_confidence_level_check'
  ) then
    alter table public.availability_email_intake_items
      add constraint availability_email_intake_items_confidence_level_check
      check (confidence_level in ('high', 'medium', 'low'));
  end if;
end
$$;

create index if not exists availability_email_intake_items_intake_idx
  on public.availability_email_intake_items (intake_id, created_at desc);

create index if not exists availability_email_intake_items_status_idx
  on public.availability_email_intake_items (parse_status, created_at desc);

create or replace function public.touch_availability_email_intake_items_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.touch_availability_email_intake_items_updated_at() owner to postgres;

drop trigger if exists availability_email_intake_items_touch_updated_at
  on public.availability_email_intake_items;
create trigger availability_email_intake_items_touch_updated_at
before update on public.availability_email_intake_items
for each row execute function public.touch_availability_email_intake_items_updated_at();

alter table public.availability_email_intake_items enable row level security;

grant select, insert, update on public.availability_email_intake_items to authenticated;
grant all on public.availability_email_intake_items to service_role;

drop policy if exists "Managers and leads can read all availability email intake items"
  on public.availability_email_intake_items;
create policy "Managers and leads can read all availability email intake items"
  on public.availability_email_intake_items
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'lead')
    )
  );

drop policy if exists "Managers can modify availability email intake items"
  on public.availability_email_intake_items;
create policy "Managers can modify availability email intake items"
  on public.availability_email_intake_items
  for all
  using (public.is_manager())
  with check (public.is_manager());
