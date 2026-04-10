do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'availability_email_intakes_provider_check'
  ) then
    alter table public.availability_email_intakes
      drop constraint availability_email_intakes_provider_check;
  end if;
end
$$;

alter table public.availability_email_intakes
  add constraint availability_email_intakes_provider_check
  check (provider in ('resend', 'manual'));
