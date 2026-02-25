create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_role text;
  auth_user_id uuid;
begin
  auth_user_id := coalesce(
    nullif(event->>'user_id', '')::uuid,
    nullif(event->>'userId', '')::uuid
  );

  if auth_user_id is not null then
    select p.role
      into user_role
    from public.profiles p
    where p.id = auth_user_id;
  end if;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role), true);

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;
