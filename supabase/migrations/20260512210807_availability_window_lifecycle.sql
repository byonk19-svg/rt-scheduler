begin;

alter table public.schedule_cycles
  add column if not exists availability_closed_at timestamptz,
  add column if not exists availability_closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists availability_reopened_at timestamptz,
  add column if not exists availability_reopened_by uuid references public.profiles(id) on delete set null;

comment on column public.schedule_cycles.availability_closed_at is
  'When a manager intentionally closed therapist availability collection for this Schedule Block.';

comment on column public.schedule_cycles.availability_reopened_at is
  'When a manager intentionally reopened availability after lock; draft planning remains intact and late changes require manager review.';

create index if not exists schedule_cycles_availability_window_idx
  on public.schedule_cycles (availability_closed_at, availability_reopened_at);

commit;
