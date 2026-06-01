-- Prevent concurrent or stale availability writers from silently taking ownership
-- of an existing row that shares the availability_overrides conflict key.

create or replace function public.prevent_availability_override_source_rewrite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.source is distinct from new.source then
    raise exception 'availability_override_source_rewrite_blocked'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function public.prevent_availability_override_source_rewrite() owner to postgres;
revoke all on function public.prevent_availability_override_source_rewrite() from public, anon, authenticated;

drop trigger if exists availability_overrides_prevent_source_rewrite
  on public.availability_overrides;

create trigger availability_overrides_prevent_source_rewrite
before update on public.availability_overrides
for each row execute function public.prevent_availability_override_source_rewrite();

comment on function public.prevent_availability_override_source_rewrite() is
  'Blocks availability_overrides upserts from changing source ownership for an existing cycle/therapist/date/shift row.';
