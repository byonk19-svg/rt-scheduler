-- Profiles policies cannot query public.profiles directly while evaluating
-- public.profiles RLS. Resolve actor role through a security-definer helper so
-- onboarding self-updates and manager quick edits do not recurse.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
  limit 1
$$;

comment on function private.current_profile_role() is
  'Returns the current authenticated user profile role for RLS policies without recursively evaluating public.profiles policies.';

revoke all on function private.current_profile_role() from public, anon;
grant execute on function private.current_profile_role() to authenticated, service_role;

drop policy if exists "Authenticated users can read allowed profiles" on public.profiles;
drop policy if exists "Managers and leads can read all profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

create policy "Authenticated users can read allowed profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (select private.current_profile_role()) = any (array['manager'::text, 'lead'::text])
);

drop policy if exists "Authenticated users can update allowed profiles" on public.profiles;
drop policy if exists "Managers can update all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Authenticated users can update allowed profiles"
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  or (select private.current_profile_role()) = 'manager'::text
)
with check (
  (select auth.uid()) = id
  or (select private.current_profile_role()) = 'manager'::text
);
