-- Leads need the same read scope as managers for /coverage so they can view draft
-- and published cycles, load colleague names on shift rows, and update assignment
-- status via the existing RPC (writes still go through security definer functions).

create or replace function public.is_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'lead'
  );
$$;

alter function public.is_lead() owner to postgres;
grant execute on function public.is_lead() to anon;
grant execute on function public.is_lead() to authenticated;
grant execute on function public.is_lead() to service_role;

drop policy if exists "Managers can read all profiles" on public.profiles;
create policy "Managers and leads can read all profiles"
on public.profiles
for select
using (public.is_manager() or public.is_lead());

drop policy if exists "Leads can view all shifts" on public.shifts;
create policy "Leads can view all shifts"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'lead'
  )
);

drop policy if exists "Leads can view all cycles" on public.schedule_cycles;
create policy "Leads can view all cycles"
on public.schedule_cycles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'lead'
  )
);
