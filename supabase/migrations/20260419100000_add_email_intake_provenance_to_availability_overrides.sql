-- Track which inbox records created manager overrides so intake re-apply can safely sync planner dates.

alter table if exists public.availability_overrides
  add column if not exists source_intake_id uuid null;

alter table if exists public.availability_overrides
  add column if not exists source_intake_item_id uuid null;

create index if not exists availability_overrides_source_intake_id_idx
  on public.availability_overrides (source_intake_id)
  where source_intake_id is not null;

create index if not exists availability_overrides_source_intake_item_id_idx
  on public.availability_overrides (source_intake_item_id)
  where source_intake_item_id is not null;
