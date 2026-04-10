create table if not exists public.availability_email_intakes (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  provider_email_id text not null,
  provider_message_id text null,
  from_email text not null,
  from_name text null,
  subject text null,
  text_content text null,
  html_content text null,
  received_at timestamptz not null,
  matched_therapist_id uuid null references public.profiles (id) on delete set null,
  matched_cycle_id uuid null references public.schedule_cycles (id) on delete set null,
  parse_status text not null default 'needs_review',
  parse_summary text null,
  parsed_requests jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  applied_at timestamptz null,
  applied_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_email_intakes_provider_check
    check (provider in ('resend')),
  constraint availability_email_intakes_parse_status_check
    check (parse_status in ('parsed', 'needs_review', 'failed', 'applied')),
  constraint availability_email_intakes_provider_email_id_key
    unique (provider_email_id)
);

create index if not exists availability_email_intakes_received_at_idx
  on public.availability_email_intakes (received_at desc);

create index if not exists availability_email_intakes_parse_status_idx
  on public.availability_email_intakes (parse_status, received_at desc);

create index if not exists availability_email_intakes_matched_therapist_idx
  on public.availability_email_intakes (matched_therapist_id);

create or replace function public.touch_availability_email_intakes_updated_at()
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

alter function public.touch_availability_email_intakes_updated_at() owner to postgres;

drop trigger if exists availability_email_intakes_touch_updated_at
  on public.availability_email_intakes;
create trigger availability_email_intakes_touch_updated_at
before update on public.availability_email_intakes
for each row execute function public.touch_availability_email_intakes_updated_at();

create table if not exists public.availability_email_attachments (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.availability_email_intakes (id) on delete cascade,
  provider_attachment_id text not null,
  filename text not null,
  content_type text not null,
  content_disposition text null,
  size_bytes integer null,
  content_base64 text null,
  download_status text not null default 'stored',
  download_error text null,
  created_at timestamptz not null default now(),
  constraint availability_email_attachments_download_status_check
    check (download_status in ('stored', 'skipped', 'failed')),
  constraint availability_email_attachments_provider_attachment_id_key
    unique (provider_attachment_id)
);

create index if not exists availability_email_attachments_intake_idx
  on public.availability_email_attachments (intake_id);

alter table public.availability_email_intakes enable row level security;
alter table public.availability_email_attachments enable row level security;

grant select, update on public.availability_email_intakes to authenticated;
grant select on public.availability_email_attachments to authenticated;
grant all on public.availability_email_intakes to service_role;
grant all on public.availability_email_attachments to service_role;

drop policy if exists "Managers and leads can read all availability email intakes"
  on public.availability_email_intakes;
create policy "Managers and leads can read all availability email intakes"
  on public.availability_email_intakes
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'lead')
    )
  );

drop policy if exists "Managers can modify availability email intakes"
  on public.availability_email_intakes;
create policy "Managers can modify availability email intakes"
  on public.availability_email_intakes
  for all
  using (public.is_manager())
  with check (public.is_manager());

drop policy if exists "Managers and leads can read all availability email attachments"
  on public.availability_email_attachments;
create policy "Managers and leads can read all availability email attachments"
  on public.availability_email_attachments
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'lead')
    )
  );

drop policy if exists "Managers can modify availability email attachments"
  on public.availability_email_attachments;
create policy "Managers can modify availability email attachments"
  on public.availability_email_attachments
  for all
  using (public.is_manager())
  with check (public.is_manager());
