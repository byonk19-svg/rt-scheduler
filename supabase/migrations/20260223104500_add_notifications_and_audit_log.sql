create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  message text not null,
  target_type text,
  target_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_unread_user_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Managers can insert notifications" on public.notifications;
create policy "Managers can insert notifications"
  on public.notifications
  for insert
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_user_created_at_idx
  on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "Managers can read audit log" on public.audit_log;
create policy "Managers can read audit log"
  on public.audit_log
  for select
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );

drop policy if exists "Managers can insert audit log" on public.audit_log;
create policy "Managers can insert audit log"
  on public.audit_log
  for insert
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
    )
  );
