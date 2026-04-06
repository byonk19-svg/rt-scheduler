alter table public.schedule_cycles
  add column if not exists archived_at timestamptz;

create index if not exists schedule_cycles_archived_at_idx
  on public.schedule_cycles (archived_at);
