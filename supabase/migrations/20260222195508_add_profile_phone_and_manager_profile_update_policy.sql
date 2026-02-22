alter table public.profiles
add column if not exists phone_number text;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Managers can update all profiles'
  ) then
    create policy "Managers can update all profiles"
      on public.profiles
      for update
      using (
        exists (
          select 1
          from public.profiles manager_profile
          where manager_profile.id = auth.uid()
            and manager_profile.role = 'manager'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles manager_profile
          where manager_profile.id = auth.uid()
            and manager_profile.role = 'manager'
        )
      );
  end if;
end
$$;
