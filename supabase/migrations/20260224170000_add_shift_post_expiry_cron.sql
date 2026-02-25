-- Expire pending swap requests after the shift date has passed.
-- Runs daily at 06:00 UTC (midnight Central Time).

create extension if not exists pg_cron;

-- shift_posts.status is text with a CHECK constraint, so we must expand the constraint
-- to allow the new "expired" status.
alter table public.shift_posts
  drop constraint if exists shift_posts_status_check;

alter table public.shift_posts
  add constraint shift_posts_status_check
  check (status = any (array['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text]));

alter table public.shift_posts
  add column if not exists expired_at timestamptz;

create or replace function public.expire_unclaimed_swap_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.shift_posts sp
  set
    status = 'expired',
    expired_at = now()
  from public.shifts s
  where
    sp.shift_id = s.id
    and sp.type = 'swap'
    and sp.status = 'pending'
    and s.date < current_date;

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- Step 5 manual test run (returns number of rows expired right now).
select public.expire_unclaimed_swap_requests();

-- Ensure the job is idempotent if migration is re-run.
do $$
declare
  existing_job_id integer;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'expire-unclaimed-swap-requests'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'expire-unclaimed-swap-requests',
  '0 6 * * *',
  $$select public.expire_unclaimed_swap_requests()$$
);

