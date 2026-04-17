create table public.shift_reminder_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  remind_type text not null check (remind_type in ('24h')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  email text not null,
  name text,
  attempt_count integer not null default 0,
  last_error text,
  send_after timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(shift_id, remind_type)
);

alter table public.shift_reminder_outbox enable row level security;

create policy "Service role only" on public.shift_reminder_outbox using (false);
