create table if not exists public.lottery_list_entries (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete cascade
);

create unique index if not exists lottery_list_entries_site_shift_therapist_idx
  on public.lottery_list_entries (site_id, shift_type, therapist_id);

create unique index if not exists lottery_list_entries_site_shift_order_idx
  on public.lottery_list_entries (site_id, shift_type, display_order);

create index if not exists lottery_list_entries_site_shift_lookup_idx
  on public.lottery_list_entries (site_id, shift_type, updated_at desc);

create table if not exists public.lottery_requests (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  requested_at timestamptz not null,
  state text not null check (state in ('active', 'suppressed_status', 'suppressed_schedule')),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  suppressed_at timestamptz,
  suppressed_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists lottery_requests_active_or_restorable_idx
  on public.lottery_requests (site_id, therapist_id, shift_date, shift_type)
  where state in ('active', 'suppressed_status');

create index if not exists lottery_requests_site_shift_idx
  on public.lottery_requests (site_id, shift_date, shift_type, state, requested_at);

create index if not exists lottery_requests_site_therapist_idx
  on public.lottery_requests (site_id, therapist_id, shift_date desc, requested_at desc);

create table if not exists public.lottery_decisions (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  shift_date date not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  keep_to_work integer not null check (keep_to_work >= 0),
  scheduled_count integer not null check (scheduled_count >= 0),
  reductions_needed integer not null check (reductions_needed >= 0),
  context_signature text not null,
  recommended_actions jsonb not null default '[]'::jsonb,
  applied_actions jsonb not null default '[]'::jsonb,
  override_applied boolean not null default false,
  applied_at timestamptz not null default now(),
  applied_by uuid not null references public.profiles(id) on delete cascade,
  superseded_at timestamptz,
  superseded_by uuid references public.profiles(id) on delete set null
);

create index if not exists lottery_decisions_site_slot_idx
  on public.lottery_decisions (site_id, shift_date desc, shift_type, applied_at desc);

create table if not exists public.lottery_history_entries (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  decision_id uuid references public.lottery_decisions(id) on delete set null,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  applied_status public.assignment_status not null check (applied_status in ('on_call', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  invalidated_at timestamptz,
  invalidated_by uuid references public.profiles(id) on delete set null,
  invalidated_reason text check (invalidated_reason in ('status_reverted', 'status_changed')),
  override_applied boolean not null default false,
  request_restored boolean not null default false
);

create index if not exists lottery_history_entries_site_therapist_idx
  on public.lottery_history_entries (site_id, therapist_id, shift_type, shift_date desc, created_at desc);

create index if not exists lottery_history_entries_shift_idx
  on public.lottery_history_entries (shift_id, created_at desc);

alter table public.lottery_list_entries enable row level security;
alter table public.lottery_requests enable row level security;
alter table public.lottery_decisions enable row level security;
alter table public.lottery_history_entries enable row level security;

drop policy if exists "Active users can read lottery list entries" on public.lottery_list_entries;
create policy "Active users can read lottery list entries"
  on public.lottery_list_entries
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_list_entries.site_id
    )
  );

drop policy if exists "Leads and managers can manage lottery list entries" on public.lottery_list_entries;
create policy "Leads and managers can manage lottery list entries"
  on public.lottery_list_entries
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_list_entries.site_id
        and actor.role in ('manager', 'lead')
    )
  )
  with check (
    auth.uid() = created_by
    and auth.uid() = updated_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_list_entries.site_id
        and actor.role in ('manager', 'lead')
    )
  );

drop policy if exists "Active users can read lottery requests" on public.lottery_requests;
create policy "Active users can read lottery requests"
  on public.lottery_requests
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
    )
  );

drop policy if exists "Users can insert allowed lottery requests" on public.lottery_requests;
create policy "Users can insert allowed lottery requests"
  on public.lottery_requests
  for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
        and (actor.role in ('manager', 'lead') or lottery_requests.therapist_id = auth.uid())
    )
  );

drop policy if exists "Users can update allowed lottery requests" on public.lottery_requests;
create policy "Users can update allowed lottery requests"
  on public.lottery_requests
  for update
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
        and (actor.role in ('manager', 'lead') or lottery_requests.therapist_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
        and (actor.role in ('manager', 'lead') or lottery_requests.therapist_id = auth.uid())
    )
  );

drop policy if exists "Users can delete allowed lottery requests" on public.lottery_requests;
create policy "Users can delete allowed lottery requests"
  on public.lottery_requests
  for delete
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
        and (actor.role in ('manager', 'lead') or lottery_requests.therapist_id = auth.uid())
    )
  );

drop policy if exists "Active users can read lottery decisions" on public.lottery_decisions;
create policy "Active users can read lottery decisions"
  on public.lottery_decisions
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
    )
  );

drop policy if exists "Leads and managers can manage lottery decisions" on public.lottery_decisions;
create policy "Leads and managers can manage lottery decisions"
  on public.lottery_decisions
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
        and actor.role in ('manager', 'lead')
    )
  )
  with check (
    auth.uid() = applied_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
        and actor.role in ('manager', 'lead')
    )
  );

drop policy if exists "Active users can read lottery history entries" on public.lottery_history_entries;
create policy "Active users can read lottery history entries"
  on public.lottery_history_entries
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
    )
  );

drop policy if exists "Leads and managers can manage lottery history entries" on public.lottery_history_entries;
create policy "Leads and managers can manage lottery history entries"
  on public.lottery_history_entries
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
        and actor.role in ('manager', 'lead')
    )
  )
  with check (
    auth.uid() = created_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
        and actor.role in ('manager', 'lead')
    )
  );
