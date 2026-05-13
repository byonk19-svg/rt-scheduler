-- Migration: allow_standing_prn_patterns
-- Created: 2026-05-12
-- Description: Allow PRN therapists with saved standing work patterns to be scheduled without one-off force-on rows.

begin;

create or replace function public.work_pattern_allows_date(
  p_therapist_id uuid,
  p_date date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pattern public.work_patterns%rowtype;
  v_dow smallint;
  v_work_days smallint[];
  v_weekend_saturday date;
  v_anchor_saturday date;
  v_cycle_length integer := 0;
  v_position integer;
  v_segment jsonb;
  v_segment_kind text;
  v_segment_length integer;
begin
  select *
    into v_pattern
  from public.work_patterns pattern
  where pattern.therapist_id = p_therapist_id;

  if not found or coalesce(v_pattern.pattern_type, 'none') = 'none' then
    return false;
  end if;

  v_dow := extract(dow from p_date)::smallint;

  if v_dow = any(coalesce(v_pattern.offs_dow, '{}'::smallint[])) then
    return false;
  end if;

  if v_pattern.pattern_type = 'repeating_cycle' then
    if v_pattern.cycle_anchor_date is null
      or jsonb_typeof(coalesce(v_pattern.cycle_segments, '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_pattern.cycle_segments, '[]'::jsonb)) = 0
    then
      return true;
    end if;

    select coalesce(sum(greatest((segment ->> 'length_days')::integer, 0)), 0)
      into v_cycle_length
    from jsonb_array_elements(v_pattern.cycle_segments) as segment
    where segment ->> 'kind' in ('work', 'off')
      and (segment ->> 'length_days') ~ '^[0-9]+$';

    if v_cycle_length < 1 or p_date < v_pattern.cycle_anchor_date then
      return true;
    end if;

    v_position := (p_date - v_pattern.cycle_anchor_date) % v_cycle_length;

    for v_segment in
      select segment
      from jsonb_array_elements(v_pattern.cycle_segments) as segment
    loop
      v_segment_kind := v_segment ->> 'kind';
      if v_segment_kind not in ('work', 'off') or (v_segment ->> 'length_days') !~ '^[0-9]+$' then
        continue;
      end if;

      v_segment_length := (v_segment ->> 'length_days')::integer;
      if v_position < v_segment_length then
        return v_segment_kind = 'work';
      end if;

      v_position := v_position - v_segment_length;
    end loop;

    return true;
  end if;

  if v_pattern.pattern_type = 'weekly_with_weekend_rotation' and v_dow in (0, 6) then
    if v_pattern.weekend_rule = 'every_weekend' then
      return true;
    end if;

    if v_pattern.weekend_rule = 'every_other_weekend' and v_pattern.weekend_anchor_date is not null then
      v_weekend_saturday := case when v_dow = 6 then p_date else p_date - 1 end;
      v_anchor_saturday :=
        case
          when extract(dow from v_pattern.weekend_anchor_date)::integer = 6 then v_pattern.weekend_anchor_date
          when extract(dow from v_pattern.weekend_anchor_date)::integer = 0 then v_pattern.weekend_anchor_date - 1
          else null
        end;

      return v_anchor_saturday is not null
        and ((v_weekend_saturday - v_anchor_saturday) % 14 = 0);
    end if;

    return false;
  end if;

  v_work_days :=
    case
      when cardinality(coalesce(v_pattern.weekly_weekdays, '{}'::smallint[])) > 0
        then v_pattern.weekly_weekdays
      else coalesce(v_pattern.works_dow, '{}'::smallint[])
    end;

  if coalesce(v_pattern.works_dow_mode, 'hard') = 'hard' then
    return cardinality(v_work_days) = 0 or v_dow = any(v_work_days);
  end if;

  return true;
end;
$$;

create or replace function public.enforce_prn_shift_assignment_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employment_type text;
begin
  if new.user_id is null or new.cycle_id is null then
    return new;
  end if;

  select profile.employment_type
    into v_employment_type
  from public.profiles profile
  where profile.id = new.user_id;

  if v_employment_type is distinct from 'prn' then
    return new;
  end if;

  if exists (
    select 1
    from public.availability_overrides override_row
    where override_row.cycle_id = new.cycle_id
      and override_row.therapist_id = new.user_id
      and override_row.date = new.date
      and override_row.override_type = 'force_off'
      and override_row.shift_type in ('both', new.shift_type)
  ) then
    raise exception 'PRN staff cannot be scheduled on a Need Off date.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.availability_overrides override_row
    where override_row.cycle_id = new.cycle_id
      and override_row.therapist_id = new.user_id
      and override_row.date = new.date
      and override_row.override_type = 'force_on'
      and override_row.shift_type in ('both', new.shift_type)
  ) then
    return new;
  end if;

  if public.work_pattern_allows_date(new.user_id, new.date) then
    return new;
  end if;

  if exists (
    select 1
    from public.preliminary_cell_marks mark
    join public.preliminary_snapshots snapshot on snapshot.id = mark.snapshot_id
    where snapshot.cycle_id = new.cycle_id
      and mark.requester_id = new.user_id
      and mark.mark_type = 'add_work'
      and mark.status = 'approved'
      and mark.date = new.date
      and mark.shift_type = new.shift_type
  ) then
    return new;
  end if;

  raise exception 'PRN staff require a standing work pattern, manager force-on, or an approved preliminary pencil mark for this date.' using errcode = '23514';
end;
$$;

alter function public.work_pattern_allows_date(uuid, date) owner to postgres;
alter function public.enforce_prn_shift_assignment_rule() owner to postgres;

revoke all on function public.work_pattern_allows_date(uuid, date) from public, anon, authenticated;
revoke all on function public.enforce_prn_shift_assignment_rule() from public, anon, authenticated;

commit;
