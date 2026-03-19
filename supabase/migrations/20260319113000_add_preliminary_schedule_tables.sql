create table if not exists public.preliminary_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.schedule_cycles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('active', 'superseded', 'closed')),
  created_at timestamptz not null default now()
);

create unique index if not exists preliminary_snapshots_one_active_per_cycle_idx
  on public.preliminary_snapshots (cycle_id)
  where status = 'active';

create index if not exists preliminary_snapshots_cycle_created_idx
  on public.preliminary_snapshots (cycle_id, created_at desc);

create table if not exists public.preliminary_shift_states (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  state text not null check (state in ('tentative_assignment', 'open', 'pending_claim', 'pending_change')),
  reserved_by uuid references public.profiles (id) on delete set null,
  active_request_id uuid,
  updated_at timestamptz not null default now(),
  unique (snapshot_id, shift_id)
);

create index if not exists preliminary_shift_states_snapshot_state_idx
  on public.preliminary_shift_states (snapshot_id, state);

create index if not exists preliminary_shift_states_reserved_by_idx
  on public.preliminary_shift_states (reserved_by)
  where reserved_by is not null;

create table if not exists public.preliminary_requests (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('claim_open_shift', 'request_change')),
  status text not null check (status in ('pending', 'approved', 'denied', 'cancelled')),
  note text,
  decision_note text,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists preliminary_requests_snapshot_status_created_idx
  on public.preliminary_requests (snapshot_id, status, created_at desc);

create index if not exists preliminary_requests_requester_created_idx
  on public.preliminary_requests (requester_id, created_at desc);

create unique index if not exists preliminary_requests_one_pending_claim_per_shift_idx
  on public.preliminary_requests (snapshot_id, shift_id)
  where type = 'claim_open_shift' and status = 'pending';

alter table public.preliminary_shift_states
  drop constraint if exists preliminary_shift_states_active_request_id_fkey;

alter table public.preliminary_shift_states
  add constraint preliminary_shift_states_active_request_id_fkey
  foreign key (active_request_id) references public.preliminary_requests (id) on delete set null;

alter table public.preliminary_snapshots enable row level security;
alter table public.preliminary_shift_states enable row level security;
alter table public.preliminary_requests enable row level security;

drop policy if exists "Logged in users can read active preliminary snapshots" on public.preliminary_snapshots;
create policy "Logged in users can read active preliminary snapshots"
  on public.preliminary_snapshots
  for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.profiles viewer_profile
      where viewer_profile.id = auth.uid()
        and viewer_profile.is_active = true
        and viewer_profile.archived_at is null
    )
  );

drop policy if exists "Managers can insert preliminary snapshots" on public.preliminary_snapshots;
create policy "Managers can insert preliminary snapshots"
  on public.preliminary_snapshots
  for insert
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  );

drop policy if exists "Managers can update preliminary snapshots" on public.preliminary_snapshots;
create policy "Managers can update preliminary snapshots"
  on public.preliminary_snapshots
  for update
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  );

drop policy if exists "Logged in users can read active preliminary shift states" on public.preliminary_shift_states;
create policy "Logged in users can read active preliminary shift states"
  on public.preliminary_shift_states
  for select
  using (
    exists (
      select 1
      from public.preliminary_snapshots snapshot
      join public.profiles viewer_profile on viewer_profile.id = auth.uid()
      where snapshot.id = preliminary_shift_states.snapshot_id
        and snapshot.status = 'active'
        and viewer_profile.is_active = true
        and viewer_profile.archived_at is null
    )
  );

drop policy if exists "Managers can mutate preliminary shift states" on public.preliminary_shift_states;
create policy "Managers can mutate preliminary shift states"
  on public.preliminary_shift_states
  for all
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  );

drop policy if exists "Managers can read all preliminary requests" on public.preliminary_requests;
create policy "Managers can read all preliminary requests"
  on public.preliminary_requests
  for select
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  );

drop policy if exists "Users can read own preliminary requests" on public.preliminary_requests;
create policy "Users can read own preliminary requests"
  on public.preliminary_requests
  for select
  using (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  );

drop policy if exists "Users can create own preliminary requests" on public.preliminary_requests;
create policy "Users can create own preliminary requests"
  on public.preliminary_requests
  for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  );

drop policy if exists "Users can cancel own preliminary requests" on public.preliminary_requests;
create policy "Users can cancel own preliminary requests"
  on public.preliminary_requests
  for update
  using (
    auth.uid() = requester_id
    and status = 'pending'
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  )
  with check (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  );

drop policy if exists "Managers can update preliminary requests" on public.preliminary_requests;
create policy "Managers can update preliminary requests"
  on public.preliminary_requests
  for update
  using (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.profiles manager_profile
      where manager_profile.id = auth.uid()
        and manager_profile.role = 'manager'
        and manager_profile.is_active = true
        and manager_profile.archived_at is null
    )
  );
