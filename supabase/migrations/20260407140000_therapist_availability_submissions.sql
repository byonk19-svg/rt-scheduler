-- Per-therapist, per-cycle official availability submission (workflow state).
-- Day-level selections remain in availability_overrides; this row records when the
-- therapist officially submitted and tracks post-submit edits.

alter table public.schedule_cycles
  add column if not exists availability_due_at timestamptz null;

comment on column public.schedule_cycles.availability_due_at is
  'Optional deadline for therapist availability submission; UI falls back to inferred dates when null.';

create table if not exists public.therapist_availability_submissions (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.profiles (id) on delete cascade,
  schedule_cycle_id uuid not null references public.schedule_cycles (id) on delete cascade,
  submitted_at timestamptz not null,
  last_edited_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_availability_submissions_unique_cycle unique (therapist_id, schedule_cycle_id)
);

create index if not exists therapist_availability_submissions_cycle_idx
  on public.therapist_availability_submissions (schedule_cycle_id);

create index if not exists therapist_availability_submissions_therapist_idx
  on public.therapist_availability_submissions (therapist_id);

alter table public.therapist_availability_submissions enable row level security;

grant select, insert, update, delete on public.therapist_availability_submissions to authenticated;
grant all on public.therapist_availability_submissions to service_role;

-- Therapists: own rows
drop policy if exists "Therapists can read own availability submissions"
  on public.therapist_availability_submissions;
create policy "Therapists can read own availability submissions"
  on public.therapist_availability_submissions
  for select
  using (auth.uid() = therapist_id);

drop policy if exists "Therapists can insert own availability submissions"
  on public.therapist_availability_submissions;
create policy "Therapists can insert own availability submissions"
  on public.therapist_availability_submissions
  for insert
  with check (auth.uid() = therapist_id);

drop policy if exists "Therapists can update own availability submissions"
  on public.therapist_availability_submissions;
create policy "Therapists can update own availability submissions"
  on public.therapist_availability_submissions
  for update
  using (auth.uid() = therapist_id)
  with check (auth.uid() = therapist_id);

drop policy if exists "Therapists can delete own availability submissions"
  on public.therapist_availability_submissions;
create policy "Therapists can delete own availability submissions"
  on public.therapist_availability_submissions
  for delete
  using (auth.uid() = therapist_id);

-- Managers and leads: read all (scheduling / parity with availability_overrides visibility)
drop policy if exists "Managers and leads can read all availability submissions"
  on public.therapist_availability_submissions;
create policy "Managers and leads can read all availability submissions"
  on public.therapist_availability_submissions
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'lead')
    )
  );

create or replace function public.touch_therapist_availability_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists therapist_availability_submissions_touch_updated_at
  on public.therapist_availability_submissions;
create trigger therapist_availability_submissions_touch_updated_at
before update on public.therapist_availability_submissions
for each row execute function public.touch_therapist_availability_submissions_updated_at();
