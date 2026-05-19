alter table public.schedule_cycles
  add column if not exists preliminary_target_date date null,
  add column if not exists final_publish_target_date date null;

comment on column public.schedule_cycles.preliminary_target_date is
  'Manager planning target date for sending the preliminary schedule; actual send history remains in preliminary_snapshots and audit logs.';

comment on column public.schedule_cycles.final_publish_target_date is
  'Manager planning target date for final publish; actual publish history remains in publish_events.';

alter table public.notifications
  drop constraint if exists notifications_event_type_check,
  add constraint notifications_event_type_check
    check (
      event_type in (
        'new_request',
        'request_approved',
        'request_denied',
        'swap_request_received',
        'direct_request_received',
        'direct_request_accepted',
        'direct_request_declined',
        'direct_request_withdrawn',
        'direct_request_approved',
        'direct_request_denied',
        'shift_post_claimed',
        'call_in_help_available',
        'operational_status_attention',
        'cycle_published',
        'published_schedule_changed',
        'preliminary_sent',
        'preliminary_refreshed',
        'preliminary_request_submitted',
        'preliminary_request_approved',
        'preliminary_request_denied',
        'preliminary_schedule_changed',
        'availability_ready',
        'availability_due_date_changed',
        'shift_reminder'
      )
    ) not valid;

alter table public.notifications validate constraint notifications_event_type_check;
