begin;

drop policy if exists "Authenticated users can read allowed work patterns" on public.work_patterns;
drop policy if exists "Authenticated users can insert allowed work patterns" on public.work_patterns;
drop policy if exists "Authenticated users can update allowed work patterns" on public.work_patterns;
drop policy if exists "Authenticated users can delete allowed work patterns" on public.work_patterns;

create policy "Managers can read all work patterns"
  on public.work_patterns
  for select
  using (public.is_manager());

create policy "Managers can modify all work patterns"
  on public.work_patterns
  for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "Therapists can read own work pattern"
  on public.work_patterns
  for select
  using (auth.uid() = therapist_id);

create policy "Therapists can insert own work pattern"
  on public.work_patterns
  for insert
  with check (auth.uid() = therapist_id);

create policy "Therapists can update own work pattern"
  on public.work_patterns
  for update
  using (auth.uid() = therapist_id)
  with check (auth.uid() = therapist_id);

create policy "Therapists can delete own work pattern"
  on public.work_patterns
  for delete
  using (auth.uid() = therapist_id);

grant execute on function public.restrict_availability_override_cycle_updates() to authenticated;
grant execute on function public.restrict_profile_staffing_field_updates() to authenticated;
grant execute on function public.restrict_shift_availability_override_updates() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_lead() to authenticated;

alter table public.lottery_history_entries drop constraint if exists lottery_history_entries_invalidation_metadata_check;
alter table public.lottery_requests drop constraint if exists lottery_requests_suppression_metadata_check;
alter table public.preliminary_requests drop constraint if exists preliminary_requests_approval_metadata_check;
alter table public.shifts drop constraint if exists shifts_availability_override_metadata_check;
alter table public.shifts drop constraint if exists shifts_left_early_metadata_check;
alter table public.shift_post_interests drop constraint if exists shift_post_interests_responded_at_state_check;
alter table public.shift_posts drop constraint if exists shift_posts_direct_recipient_state_check;
alter table public.shift_posts drop constraint if exists shift_posts_status_metadata_check;
alter table public.audit_log drop constraint if exists audit_log_target_type_check;
alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.availability_email_intakes drop constraint if exists availability_email_intakes_counts_check;
alter table public.shift_reminder_outbox drop constraint if exists shift_reminder_outbox_attempt_count_check;
alter table public.shift_status_changes drop constraint if exists shift_status_changes_to_status_check;
alter table public.shift_status_changes drop constraint if exists shift_status_changes_from_status_check;
alter table public.work_patterns drop constraint if exists work_patterns_shift_preference_check;
alter table public.schedule_cycles drop constraint if exists schedule_cycles_date_range_check;

alter table public.availability_overrides drop constraint if exists availability_overrides_source_intake_item_id_fkey;
alter table public.availability_overrides drop constraint if exists availability_overrides_source_intake_id_fkey;
alter table public.lottery_history_entries drop constraint if exists lottery_history_entries_site_id_fkey;
alter table public.lottery_decisions drop constraint if exists lottery_decisions_site_id_fkey;
alter table public.lottery_requests drop constraint if exists lottery_requests_site_id_fkey;
alter table public.lottery_list_entries drop constraint if exists lottery_list_entries_site_id_fkey;
alter table public.cycle_templates drop constraint if exists cycle_templates_site_id_fkey;
alter table public.shifts drop constraint if exists shifts_site_id_fkey;
alter table public.schedule_cycles drop constraint if exists schedule_cycles_site_id_fkey;
alter table public.profiles drop constraint if exists profiles_site_id_fkey;

drop policy if exists "Authenticated users can read sites" on public.sites;
drop table if exists public.sites;

drop index if exists public.shifts_status_updated_by_idx;
drop index if exists public.shifts_availability_override_by_idx;
drop index if exists public.shift_reminder_outbox_user_id_idx;
drop index if exists public.shift_posts_swap_shift_id_idx;
drop index if exists public.shift_post_interests_therapist_id_idx;
drop index if exists public.shift_operational_entry_audit_entry_id_idx;
drop index if exists public.shift_operational_entry_audit_acted_by_idx;
drop index if exists public.shift_operational_entries_replaced_by_idx;
drop index if exists public.shift_operational_entries_created_by_idx;
drop index if exists public.publish_events_published_by_idx;
drop index if exists public.profiles_site_id_idx;
drop index if exists public.profiles_archived_by_idx;
drop index if exists public.preliminary_snapshots_created_by_idx;
drop index if exists public.preliminary_shift_states_shift_id_idx;
drop index if exists public.preliminary_shift_states_active_request_id_idx;
drop index if exists public.preliminary_requests_shift_id_idx;
drop index if exists public.preliminary_requests_approved_by_idx;
drop index if exists public.notification_outbox_user_id_idx;
drop index if exists public.lottery_requests_therapist_id_idx;
drop index if exists public.lottery_requests_suppressed_by_idx;
drop index if exists public.lottery_requests_restored_by_idx;
drop index if exists public.lottery_requests_created_by_idx;
drop index if exists public.lottery_list_entries_updated_by_idx;
drop index if exists public.lottery_list_entries_therapist_id_idx;
drop index if exists public.lottery_list_entries_created_by_idx;
drop index if exists public.lottery_history_entries_therapist_id_idx;
drop index if exists public.lottery_history_entries_invalidated_by_idx;
drop index if exists public.lottery_history_entries_decision_id_idx;
drop index if exists public.lottery_history_entries_created_by_idx;
drop index if exists public.lottery_decisions_superseded_by_idx;
drop index if exists public.lottery_decisions_applied_by_idx;
drop index if exists public.employee_roster_updated_by_idx;
drop index if exists public.employee_roster_matched_profile_id_idx;
drop index if exists public.employee_roster_created_by_idx;
drop index if exists public.cycle_templates_created_by_idx;
drop index if exists public.availability_reviews_reviewed_by_idx;
drop index if exists public.availability_reviews_cycle_id_idx;
drop index if exists public.availability_overrides_therapist_id_idx;
drop index if exists public.availability_overrides_created_by_idx;
drop index if exists public.availability_entries_created_by_idx;
drop index if exists public.availability_email_intakes_matched_cycle_id_idx;
drop index if exists public.availability_email_intakes_applied_by_idx;
drop index if exists public.availability_email_intake_items_reviewed_by_idx;
drop index if exists public.availability_email_intake_items_matched_therapist_id_idx;
drop index if exists public.availability_email_intake_items_matched_cycle_id_idx;
drop index if exists public.availability_email_intake_items_applied_by_idx;
drop index if exists public.availability_email_intake_items_auto_applied_by_idx;
drop index if exists public.availability_email_intake_items_attachment_id_idx;
drop index if exists public.resend_webhook_receipts_email_id_idx;
drop index if exists public.shift_posts_one_pending_standard_per_shift_type_idx;
drop index if exists public.schedule_cycles_site_date_range_unique_idx;
drop index if exists public.employee_roster_matched_profile_unique_idx;
drop index if exists public.profiles_email_lower_unique_idx;

alter table public.shift_reminder_outbox
  alter column user_id drop not null,
  alter column shift_id drop not null;

alter table public.shifts alter column created_at drop not null;
alter table public.shift_posts alter column created_at drop not null;
alter table public.availability_requests alter column created_at drop not null;
alter table public.schedule_cycles
  alter column created_at drop not null,
  alter column published drop not null;
alter table public.profiles
  alter column created_at drop not null,
  alter column role drop not null;

commit;
