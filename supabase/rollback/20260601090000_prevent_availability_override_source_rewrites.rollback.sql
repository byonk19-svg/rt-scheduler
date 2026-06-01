drop trigger if exists availability_overrides_prevent_source_rewrite
  on public.availability_overrides;

drop function if exists public.prevent_availability_override_source_rewrite();
