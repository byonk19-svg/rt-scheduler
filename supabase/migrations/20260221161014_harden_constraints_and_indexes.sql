-- Remove duplicate shifts for the same user/day/cycle before enforcing uniqueness.
with ranked_shifts as (
  select
    id,
    row_number() over (
      partition by cycle_id, user_id, date
      order by created_at asc nulls last, id asc
    ) as rn
  from public.shifts
  where cycle_id is not null
    and user_id is not null
)
delete from public.shifts s
using ranked_shifts r
where s.id = r.id
  and r.rn > 1;

-- Remove duplicate availability rows where a cycle is set.
with ranked_availability_with_cycle as (
  select
    id,
    row_number() over (
      partition by user_id, cycle_id, date
      order by created_at asc nulls last, id asc
    ) as rn
  from public.availability_requests
  where user_id is not null
    and cycle_id is not null
)
delete from public.availability_requests a
using ranked_availability_with_cycle r
where a.id = r.id
  and r.rn > 1;

-- Remove duplicate availability rows where no cycle is set.
with ranked_availability_no_cycle as (
  select
    id,
    row_number() over (
      partition by user_id, date
      order by created_at asc nulls last, id asc
    ) as rn
  from public.availability_requests
  where user_id is not null
    and cycle_id is null
)
delete from public.availability_requests a
using ranked_availability_no_cycle r
where a.id = r.id
  and r.rn > 1;

-- Enforce one shift per user/date/cycle.
create unique index if not exists shifts_unique_cycle_user_date_idx
  on public.shifts (cycle_id, user_id, date);

-- Enforce one availability row per user/date/cycle when cycle exists.
create unique index if not exists availability_unique_user_cycle_date_idx
  on public.availability_requests (user_id, cycle_id, date)
  where cycle_id is not null;

-- Enforce one availability row per user/date when cycle is null.
create unique index if not exists availability_unique_user_date_no_cycle_idx
  on public.availability_requests (user_id, date)
  where cycle_id is null;

-- Query-performance indexes for common app filters/sorts.
create index if not exists shifts_cycle_date_idx
  on public.shifts (cycle_id, date);

create index if not exists shifts_user_date_idx
  on public.shifts (user_id, date);

create index if not exists availability_user_date_idx
  on public.availability_requests (user_id, date);

create index if not exists availability_cycle_date_idx
  on public.availability_requests (cycle_id, date);

create index if not exists shift_posts_shift_id_idx
  on public.shift_posts (shift_id);

create index if not exists shift_posts_posted_by_idx
  on public.shift_posts (posted_by);

create index if not exists shift_posts_status_created_idx
  on public.shift_posts (status, created_at desc);

create index if not exists schedule_cycles_published_start_date_idx
  on public.schedule_cycles (published, start_date desc);
