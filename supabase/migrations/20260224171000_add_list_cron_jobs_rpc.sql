-- Helper RPC so we can verify scheduled cron jobs via PostgREST/service role.

create or replace function public.list_cron_jobs()
returns table (
  jobname text,
  schedule text,
  command text,
  active boolean
)
language sql
security definer
set search_path = cron, public
as $$
  select jobname, schedule, command, active
  from cron.job
  order by jobname;
$$;

revoke all on function public.list_cron_jobs() from public;
grant execute on function public.list_cron_jobs() to service_role;

