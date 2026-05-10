-- Close the schema-audit gaps with deterministic constraints and advisor fixes.
-- The data cleanup statements are intentionally narrow and mirror the live prechecks.

begin;

-- Legacy nullable columns had defaults and no live nulls, but the catalog still allowed nulls.
alter table public.profiles
  alter column role set default 'therapist';

update public.profiles
set role = 'therapist'
where role is null;

update public.profiles
set created_at = now()
where created_at is null;

update public.schedule_cycles
set created_at = now()
where created_at is null;

update public.schedule_cycles
set published = false
where published is null;

update public.availability_requests
set created_at = now()
where created_at is null;

update public.shift_posts
set created_at = now()
where created_at is null;

update public.shifts
set created_at = now()
where created_at is null;

alter table public.profiles
  alter column role set not null,
  alter column created_at set not null;

alter table public.schedule_cycles
  alter column created_at set not null,
  alter column published set not null;

alter table public.availability_requests
  alter column created_at set not null;

alter table public.shift_posts
  alter column created_at set not null;

alter table public.shifts
  alter column created_at set not null;

alter table public.shift_reminder_outbox
  alter column user_id set not null,
  alter column shift_id set not null;

-- Structural uniqueness.
create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email));

create unique index if not exists employee_roster_matched_profile_unique_idx
  on public.employee_roster (matched_profile_id)
  where matched_profile_id is not null;

create unique index if not exists schedule_cycles_site_date_range_unique_idx
  on public.schedule_cycles (site_id, start_date, end_date);

create unique index if not exists shift_posts_one_pending_standard_per_shift_type_idx
  on public.shift_posts (shift_id, type)
  where request_kind = 'standard'
    and status = 'pending'
    and shift_id is not null;

-- Canonical site dimension for existing soft site_id relationships.
create table if not exists public.sites (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.sites enable row level security;

revoke all on table public.sites from anon;
grant select on table public.sites to authenticated;
grant all on table public.sites to service_role;

drop policy if exists "Authenticated users can read sites" on public.sites;
create policy "Authenticated users can read sites"
on public.sites
for select
to authenticated
using (auth.uid() is not null);

with site_ids as (
  select nullif(trim(site_id), '') as id from public.profiles
  union
  select nullif(trim(site_id), '') from public.schedule_cycles
  union
  select nullif(trim(site_id), '') from public.shifts
  union
  select nullif(trim(site_id), '') from public.cycle_templates
  union
  select nullif(trim(site_id), '') from public.lottery_list_entries
  union
  select nullif(trim(site_id), '') from public.lottery_requests
  union
  select nullif(trim(site_id), '') from public.lottery_decisions
  union
  select nullif(trim(site_id), '') from public.lottery_history_entries
)
insert into public.sites (id, name)
select id, initcap(replace(id, '_', ' '))
from site_ids
where id is not null
on conflict (id) do nothing;

insert into public.sites (id, name)
values ('default', 'Default')
on conflict (id) do nothing;

alter table public.profiles
  drop constraint if exists profiles_site_id_fkey,
  add constraint profiles_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.schedule_cycles
  drop constraint if exists schedule_cycles_site_id_fkey,
  add constraint schedule_cycles_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.shifts
  drop constraint if exists shifts_site_id_fkey,
  add constraint shifts_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.cycle_templates
  drop constraint if exists cycle_templates_site_id_fkey,
  add constraint cycle_templates_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.lottery_list_entries
  drop constraint if exists lottery_list_entries_site_id_fkey,
  add constraint lottery_list_entries_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.lottery_requests
  drop constraint if exists lottery_requests_site_id_fkey,
  add constraint lottery_requests_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.lottery_decisions
  drop constraint if exists lottery_decisions_site_id_fkey,
  add constraint lottery_decisions_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.lottery_history_entries
  drop constraint if exists lottery_history_entries_site_id_fkey,
  add constraint lottery_history_entries_site_id_fkey
    foreign key (site_id) references public.sites(id)
    on update cascade on delete restrict not valid;

alter table public.availability_overrides
  drop constraint if exists availability_overrides_source_intake_id_fkey,
  add constraint availability_overrides_source_intake_id_fkey
    foreign key (source_intake_id) references public.availability_email_intakes(id)
    on delete set null not valid,
  drop constraint if exists availability_overrides_source_intake_item_id_fkey,
  add constraint availability_overrides_source_intake_item_id_fkey
    foreign key (source_intake_item_id) references public.availability_email_intake_items(id)
    on delete set null not valid;

alter table public.profiles validate constraint profiles_site_id_fkey;
alter table public.schedule_cycles validate constraint schedule_cycles_site_id_fkey;
alter table public.shifts validate constraint shifts_site_id_fkey;
alter table public.cycle_templates validate constraint cycle_templates_site_id_fkey;
alter table public.lottery_list_entries validate constraint lottery_list_entries_site_id_fkey;
alter table public.lottery_requests validate constraint lottery_requests_site_id_fkey;
alter table public.lottery_decisions validate constraint lottery_decisions_site_id_fkey;
alter table public.lottery_history_entries validate constraint lottery_history_entries_site_id_fkey;
alter table public.availability_overrides validate constraint availability_overrides_source_intake_id_fkey;
alter table public.availability_overrides validate constraint availability_overrides_source_intake_item_id_fkey;

-- Missing check constraints.
alter table public.schedule_cycles
  drop constraint if exists schedule_cycles_date_range_check,
  add constraint schedule_cycles_date_range_check
    check (end_date >= start_date) not valid;

alter table public.work_patterns
  drop constraint if exists work_patterns_shift_preference_check,
  add constraint work_patterns_shift_preference_check
    check (shift_preference in ('day', 'night', 'either')) not valid;

alter table public.shift_status_changes
  drop constraint if exists shift_status_changes_from_status_check,
  add constraint shift_status_changes_from_status_check
    check (from_status in ('scheduled', 'on_call', 'sick', 'called_off', 'call_in', 'cancelled', 'left_early')) not valid,
  drop constraint if exists shift_status_changes_to_status_check,
  add constraint shift_status_changes_to_status_check
    check (to_status in ('scheduled', 'on_call', 'sick', 'called_off', 'call_in', 'cancelled', 'left_early')) not valid;

alter table public.shift_reminder_outbox
  drop constraint if exists shift_reminder_outbox_attempt_count_check,
  add constraint shift_reminder_outbox_attempt_count_check
    check (attempt_count >= 0) not valid;

alter table public.availability_email_intakes
  drop constraint if exists availability_email_intakes_counts_check,
  add constraint availability_email_intakes_counts_check
    check (
      item_count >= 0
      and auto_applied_count >= 0
      and needs_review_count >= 0
      and failed_count >= 0
      and item_count >= auto_applied_count + needs_review_count + failed_count
    ) not valid;

alter table public.notifications
  drop constraint if exists notifications_event_type_check,
  add constraint notifications_event_type_check
    check (
      event_type in (
        'new_request',
        'request_approved',
        'swap_request_received',
        'direct_request_received',
        'direct_request_accepted',
        'direct_request_declined',
        'direct_request_withdrawn',
        'direct_request_approved',
        'direct_request_denied',
        'shift_post_claimed',
        'call_in_help_available',
        'cycle_published',
        'published_schedule_changed',
        'preliminary_request_submitted',
        'preliminary_request_approved',
        'preliminary_request_denied',
        'preliminary_schedule_changed',
        'shift_reminder'
      )
    ) not valid,
  drop constraint if exists notifications_target_type_check,
  add constraint notifications_target_type_check
    check (
      target_type is null
      or target_type in ('schedule_cycle', 'shift', 'shift_post', 'system')
    ) not valid;

alter table public.audit_log
  drop constraint if exists audit_log_target_type_check,
  add constraint audit_log_target_type_check
    check (target_type in ('schedule_cycle', 'shift', 'shift_slot', 'shift_post', 'profile', 'system')) not valid;

comment on column public.resend_webhook_receipts.email_id is
  'External Resend email identifier. It is intentionally not a foreign key because the durable sent-email table does not exist yet.';

create index if not exists resend_webhook_receipts_email_id_idx
  on public.resend_webhook_receipts (email_id)
  where email_id is not null;

-- Lifecycle invariants. One selected interest had terminal metadata from an older promotion path.
update public.shift_post_interests
set responded_at = null
where status in ('pending', 'selected')
  and responded_at is not null;

alter table public.shift_posts
  drop constraint if exists shift_posts_status_metadata_check,
  add constraint shift_posts_status_metadata_check
    check (
      (status <> 'approved' or claimed_by is not null)
      and (status <> 'expired' or expired_at is not null)
    ) not valid,
  drop constraint if exists shift_posts_direct_recipient_state_check,
  add constraint shift_posts_direct_recipient_state_check
    check (
      (
        visibility = 'direct'
        and recipient_response is not null
        and (
          (recipient_response = 'pending' and recipient_responded_at is null)
          or (recipient_response in ('accepted', 'declined') and recipient_responded_at is not null)
        )
      )
      or (
        visibility = 'team'
        and recipient_response is null
        and recipient_responded_at is null
      )
    ) not valid;

alter table public.shift_post_interests
  drop constraint if exists shift_post_interests_responded_at_state_check,
  add constraint shift_post_interests_responded_at_state_check
    check (
      (status in ('pending', 'selected') and responded_at is null)
      or (status in ('withdrawn', 'declined') and responded_at is not null)
    ) not valid;

alter table public.shifts
  drop constraint if exists shifts_left_early_metadata_check,
  add constraint shifts_left_early_metadata_check
    check (
      (assignment_status = 'left_early' and left_early_time is not null)
      or (assignment_status <> 'left_early' and left_early_time is null)
    ) not valid,
  drop constraint if exists shifts_availability_override_metadata_check,
  add constraint shifts_availability_override_metadata_check
    check (
      (
        availability_override = true
        and availability_override_reason is not null
        and availability_override_by is not null
        and availability_override_at is not null
      )
      or (
        availability_override = false
        and availability_override_reason is null
        and availability_override_by is null
        and availability_override_at is null
      )
    ) not valid;

alter table public.preliminary_requests
  drop constraint if exists preliminary_requests_approval_metadata_check,
  add constraint preliminary_requests_approval_metadata_check
    check (
      (status = 'approved' and approved_by is not null and approved_at is not null)
      or (status <> 'approved' and approved_by is null and approved_at is null)
    ) not valid;

alter table public.lottery_requests
  drop constraint if exists lottery_requests_suppression_metadata_check,
  add constraint lottery_requests_suppression_metadata_check
    check (
      (
        state in ('suppressed_status', 'suppressed_schedule')
        and suppressed_at is not null
        and suppressed_by is not null
      )
      or (
        state = 'active'
        and suppressed_at is null
        and suppressed_by is null
      )
    ) not valid;

alter table public.lottery_history_entries
  drop constraint if exists lottery_history_entries_invalidation_metadata_check,
  add constraint lottery_history_entries_invalidation_metadata_check
    check (
      (
        invalidated_at is null
        and invalidated_by is null
        and invalidated_reason is null
      )
      or (
        invalidated_at is not null
        and invalidated_by is not null
        and invalidated_reason is not null
      )
    ) not valid;

alter table public.schedule_cycles validate constraint schedule_cycles_date_range_check;
alter table public.work_patterns validate constraint work_patterns_shift_preference_check;
alter table public.shift_status_changes validate constraint shift_status_changes_from_status_check;
alter table public.shift_status_changes validate constraint shift_status_changes_to_status_check;
alter table public.shift_reminder_outbox validate constraint shift_reminder_outbox_attempt_count_check;
alter table public.availability_email_intakes validate constraint availability_email_intakes_counts_check;
alter table public.notifications validate constraint notifications_event_type_check;
alter table public.notifications validate constraint notifications_target_type_check;
alter table public.audit_log validate constraint audit_log_target_type_check;
alter table public.shift_posts validate constraint shift_posts_status_metadata_check;
alter table public.shift_posts validate constraint shift_posts_direct_recipient_state_check;
alter table public.shift_post_interests validate constraint shift_post_interests_responded_at_state_check;
alter table public.shifts validate constraint shifts_left_early_metadata_check;
alter table public.shifts validate constraint shifts_availability_override_metadata_check;
alter table public.preliminary_requests validate constraint preliminary_requests_approval_metadata_check;
alter table public.lottery_requests validate constraint lottery_requests_suppression_metadata_check;
alter table public.lottery_history_entries validate constraint lottery_history_entries_invalidation_metadata_check;

-- FK indexes missing from the Supabase advisor output.
create index if not exists availability_email_intake_items_attachment_id_idx
  on public.availability_email_intake_items (attachment_id);
create index if not exists availability_email_intake_items_auto_applied_by_idx
  on public.availability_email_intake_items (auto_applied_by);
create index if not exists availability_email_intake_items_applied_by_idx
  on public.availability_email_intake_items (applied_by);
create index if not exists availability_email_intake_items_matched_cycle_id_idx
  on public.availability_email_intake_items (matched_cycle_id);
create index if not exists availability_email_intake_items_matched_therapist_id_idx
  on public.availability_email_intake_items (matched_therapist_id);
create index if not exists availability_email_intake_items_reviewed_by_idx
  on public.availability_email_intake_items (reviewed_by);
create index if not exists availability_email_intakes_applied_by_idx
  on public.availability_email_intakes (applied_by);
create index if not exists availability_email_intakes_matched_cycle_id_idx
  on public.availability_email_intakes (matched_cycle_id);
create index if not exists availability_entries_created_by_idx
  on public.availability_entries (created_by);
create index if not exists availability_overrides_created_by_idx
  on public.availability_overrides (created_by);
create index if not exists availability_overrides_therapist_id_idx
  on public.availability_overrides (therapist_id);
do $$
begin
  if to_regclass('public.availability_reviews') is not null then
    create index if not exists availability_reviews_cycle_id_idx
      on public.availability_reviews (cycle_id);
    create index if not exists availability_reviews_reviewed_by_idx
      on public.availability_reviews (reviewed_by);
  end if;
end;
$$;
create index if not exists cycle_templates_created_by_idx
  on public.cycle_templates (created_by);
create index if not exists employee_roster_created_by_idx
  on public.employee_roster (created_by);
create index if not exists employee_roster_matched_profile_id_idx
  on public.employee_roster (matched_profile_id);
create index if not exists employee_roster_updated_by_idx
  on public.employee_roster (updated_by);
create index if not exists lottery_decisions_applied_by_idx
  on public.lottery_decisions (applied_by);
create index if not exists lottery_decisions_superseded_by_idx
  on public.lottery_decisions (superseded_by);
create index if not exists lottery_history_entries_created_by_idx
  on public.lottery_history_entries (created_by);
create index if not exists lottery_history_entries_decision_id_idx
  on public.lottery_history_entries (decision_id);
create index if not exists lottery_history_entries_invalidated_by_idx
  on public.lottery_history_entries (invalidated_by);
create index if not exists lottery_history_entries_therapist_id_idx
  on public.lottery_history_entries (therapist_id);
create index if not exists lottery_list_entries_created_by_idx
  on public.lottery_list_entries (created_by);
create index if not exists lottery_list_entries_therapist_id_idx
  on public.lottery_list_entries (therapist_id);
create index if not exists lottery_list_entries_updated_by_idx
  on public.lottery_list_entries (updated_by);
create index if not exists lottery_requests_created_by_idx
  on public.lottery_requests (created_by);
create index if not exists lottery_requests_restored_by_idx
  on public.lottery_requests (restored_by);
create index if not exists lottery_requests_suppressed_by_idx
  on public.lottery_requests (suppressed_by);
create index if not exists lottery_requests_therapist_id_idx
  on public.lottery_requests (therapist_id);
create index if not exists notification_outbox_user_id_idx
  on public.notification_outbox (user_id);
create index if not exists preliminary_requests_approved_by_idx
  on public.preliminary_requests (approved_by);
create index if not exists preliminary_requests_shift_id_idx
  on public.preliminary_requests (shift_id);
create index if not exists preliminary_shift_states_active_request_id_idx
  on public.preliminary_shift_states (active_request_id);
create index if not exists preliminary_shift_states_shift_id_idx
  on public.preliminary_shift_states (shift_id);
create index if not exists preliminary_snapshots_created_by_idx
  on public.preliminary_snapshots (created_by);
create index if not exists profiles_archived_by_idx
  on public.profiles (archived_by);
create index if not exists profiles_site_id_idx
  on public.profiles (site_id);
create index if not exists publish_events_published_by_idx
  on public.publish_events (published_by);
create index if not exists shift_operational_entries_created_by_idx
  on public.shift_operational_entries (created_by);
create index if not exists shift_operational_entries_replaced_by_idx
  on public.shift_operational_entries (replaced_by);
create index if not exists shift_operational_entry_audit_acted_by_idx
  on public.shift_operational_entry_audit (acted_by);
create index if not exists shift_operational_entry_audit_entry_id_idx
  on public.shift_operational_entry_audit (entry_id);
create index if not exists shift_post_interests_therapist_id_idx
  on public.shift_post_interests (therapist_id);
create index if not exists shift_posts_swap_shift_id_idx
  on public.shift_posts (swap_shift_id);
create index if not exists shift_reminder_outbox_user_id_idx
  on public.shift_reminder_outbox (user_id);
create index if not exists shifts_availability_override_by_idx
  on public.shifts (availability_override_by);
create index if not exists shifts_status_updated_by_idx
  on public.shifts (status_updated_by);

-- Advisor: mutable search_path on touch functions.
create or replace function public.touch_therapist_availability_submissions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.touch_therapist_availability_submissions_updated_at() owner to postgres;

create or replace function public.touch_employee_roster_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.touch_employee_roster_updated_at() owner to postgres;

-- Advisor: exposed SECURITY DEFINER trigger/internal functions should not be callable by app roles.
revoke all on function public.deny_sibling_pickup_posts() from public, anon, authenticated;
revoke all on function public.enforce_shift_post_interest_parent_state() from public, anon, authenticated;
revoke all on function public.enforce_shift_post_status_transitions() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.notify_on_shift_post_change() from public, anon, authenticated;
revoke all on function public.restrict_availability_override_cycle_updates() from public, anon, authenticated;
revoke all on function public.restrict_profile_staffing_field_updates() from public, anon, authenticated;
revoke all on function public.restrict_shift_availability_override_updates() from public, anon, authenticated;
revoke all on function public.touch_availability_email_intake_items_updated_at() from public, anon, authenticated;
revoke all on function public.touch_availability_email_intakes_updated_at() from public, anon, authenticated;
revoke all on function public.touch_availability_overrides_updated_at() from public, anon, authenticated;
revoke all on function public.touch_employee_roster_updated_at() from public, anon, authenticated;
revoke all on function public.touch_therapist_availability_submissions_updated_at() from public, anon, authenticated;
revoke all on function public.touch_work_patterns_updated_at() from public, anon, authenticated;
revoke all on function public.expire_unclaimed_swap_requests() from public, anon, authenticated;
revoke all on function public.list_cron_jobs() from public, anon, authenticated;

grant execute on function public.expire_unclaimed_swap_requests() to service_role;
grant execute on function public.list_cron_jobs() to service_role;

-- Advisor: consolidate overlapping permissive work_patterns policies by command.
drop policy if exists "Managers can read all work patterns" on public.work_patterns;
drop policy if exists "Managers can modify all work patterns" on public.work_patterns;
drop policy if exists "Therapists can read own work pattern" on public.work_patterns;
drop policy if exists "Therapists can insert own work pattern" on public.work_patterns;
drop policy if exists "Therapists can update own work pattern" on public.work_patterns;
drop policy if exists "Therapists can delete own work pattern" on public.work_patterns;

create policy "Authenticated users can read allowed work patterns"
on public.work_patterns
for select
to authenticated
using (auth.uid() = therapist_id or public.is_manager());

create policy "Authenticated users can insert allowed work patterns"
on public.work_patterns
for insert
to authenticated
with check (auth.uid() = therapist_id or public.is_manager());

create policy "Authenticated users can update allowed work patterns"
on public.work_patterns
for update
to authenticated
using (auth.uid() = therapist_id or public.is_manager())
with check (auth.uid() = therapist_id or public.is_manager());

create policy "Authenticated users can delete allowed work patterns"
on public.work_patterns
for delete
to authenticated
using (auth.uid() = therapist_id or public.is_manager());

commit;
