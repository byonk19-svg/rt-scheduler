alter table public.work_patterns
  add column if not exists pattern_type text not null default 'weekly_fixed',
  add column if not exists weekly_weekdays smallint[] not null default '{}',
  add column if not exists weekend_rule text not null default 'none',
  add column if not exists cycle_anchor_date date,
  add column if not exists cycle_segments jsonb not null default '[]'::jsonb;

update public.work_patterns
set
  pattern_type = case
    when jsonb_array_length(coalesce(cycle_segments, '[]'::jsonb)) > 0 or cycle_anchor_date is not null then 'repeating_cycle'
    when weekend_rotation = 'every_other' then 'weekly_with_weekend_rotation'
    when cardinality(coalesce(works_dow, '{}'::smallint[])) = 0
      and cardinality(coalesce(offs_dow, '{}'::smallint[])) = 0 then 'none'
    else 'weekly_fixed'
  end,
  weekly_weekdays = coalesce(
    (
      select array_agg(day_value order by day_value)
      from unnest(coalesce(works_dow, '{}'::smallint[])) as day_value
      where day_value between 1 and 5
    ),
    '{}'::smallint[]
  ),
  weekend_rule = case
    when weekend_rotation = 'every_other' then 'every_other_weekend'
    when 0 = any(coalesce(works_dow, '{}'::smallint[])) and 6 = any(coalesce(works_dow, '{}'::smallint[]))
      then 'every_weekend'
    else 'none'
  end
where true;

alter table public.work_patterns
  drop constraint if exists work_patterns_pattern_type_check,
  add constraint work_patterns_pattern_type_check
    check (pattern_type in ('weekly_fixed', 'weekly_with_weekend_rotation', 'repeating_cycle', 'none')),
  drop constraint if exists work_patterns_weekend_rule_check,
  add constraint work_patterns_weekend_rule_check
    check (weekend_rule in ('none', 'every_weekend', 'every_other_weekend')),
  drop constraint if exists work_patterns_weekly_weekdays_values_check,
  add constraint work_patterns_weekly_weekdays_values_check
    check (weekly_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  drop constraint if exists work_patterns_cycle_segments_is_array_check,
  add constraint work_patterns_cycle_segments_is_array_check
    check (jsonb_typeof(cycle_segments) = 'array'),
  drop constraint if exists work_patterns_cycle_anchor_required_check,
  add constraint work_patterns_cycle_anchor_required_check
    check (
      pattern_type <> 'repeating_cycle'
      or cycle_anchor_date is not null
    ),
  drop constraint if exists work_patterns_every_other_weekend_anchor_required_check,
  add constraint work_patterns_every_other_weekend_anchor_required_check
    check (
      weekend_rule <> 'every_other_weekend'
      or weekend_anchor_date is not null
    );

drop policy if exists "Therapists can insert own work pattern" on public.work_patterns;
create policy "Therapists can insert own work pattern"
  on public.work_patterns
  for insert
  with check (auth.uid() = therapist_id);

drop policy if exists "Therapists can update own work pattern" on public.work_patterns;
create policy "Therapists can update own work pattern"
  on public.work_patterns
  for update
  using (auth.uid() = therapist_id)
  with check (auth.uid() = therapist_id);

drop policy if exists "Therapists can delete own work pattern" on public.work_patterns;
create policy "Therapists can delete own work pattern"
  on public.work_patterns
  for delete
  using (auth.uid() = therapist_id);
