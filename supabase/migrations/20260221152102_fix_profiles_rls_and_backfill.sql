create or replace function public.is_manager()
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
      and role = 'manager'
  );
$$;

alter function public.is_manager() owner to postgres;

grant execute on function public.is_manager() to anon;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_manager() to service_role;

drop policy if exists "Managers can read all profiles" on public.profiles;
create policy "Managers can read all profiles"
on public.profiles
for select
using (public.is_manager());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, shift_type)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'New User'),
    coalesce(new.email, ''),
    case
      when coalesce(new.raw_user_meta_data->>'role', '') in ('manager', 'therapist')
        then new.raw_user_meta_data->>'role'
      else 'therapist'
    end,
    case
      when coalesce(new.raw_user_meta_data->>'shift_type', '') in ('day', 'night')
        then new.raw_user_meta_data->>'shift_type'
      else 'day'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, email, role, shift_type)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), 'New User'),
  coalesce(u.email, ''),
  case
    when coalesce(u.raw_user_meta_data->>'role', '') in ('manager', 'therapist')
      then u.raw_user_meta_data->>'role'
    else 'therapist'
  end,
  case
    when coalesce(u.raw_user_meta_data->>'shift_type', '') in ('day', 'night')
      then u.raw_user_meta_data->>'shift_type'
    else 'day'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
