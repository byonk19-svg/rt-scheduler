create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.schedule_cycles(id) on delete cascade,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'success' check (status in ('success', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  channel text not null default 'email' check (channel in ('email')),
  queued_count integer not null default 0 check (queued_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_message text null
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  publish_event_id uuid not null references public.publish_events(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  email text not null,
  name text null,
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists publish_events_cycle_published_at_idx
  on public.publish_events (cycle_id, published_at desc);

create index if not exists notification_outbox_event_status_idx
  on public.notification_outbox (publish_event_id, status);

create index if not exists notification_outbox_status_created_at_idx
  on public.notification_outbox (status, created_at asc);

alter table public.publish_events enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists "Managers can read publish events" on public.publish_events;
create policy "Managers can read publish events"
  on public.publish_events
  for select
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );

drop policy if exists "Managers can insert publish events" on public.publish_events;
create policy "Managers can insert publish events"
  on public.publish_events
  for insert
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );

drop policy if exists "Managers can read notification outbox" on public.notification_outbox;
create policy "Managers can read notification outbox"
  on public.notification_outbox
  for select
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );

drop policy if exists "Managers can insert notification outbox" on public.notification_outbox;
create policy "Managers can insert notification outbox"
  on public.notification_outbox
  for insert
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );
