alter table public.profiles
  alter column role drop not null,
  alter column role drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name text;
  last_name text;
  computed_full_name text;
begin
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');

  insert into public.profiles (id, full_name, email, phone_number, role, shift_type)
  values (
    new.id,
    coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), 'New User'),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'phone_number', ''),
    null,
    'day'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
