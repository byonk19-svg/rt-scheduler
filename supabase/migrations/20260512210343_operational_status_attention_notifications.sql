begin;

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
        'shift_reminder'
      )
    ) not valid;

alter table public.notifications validate constraint notifications_event_type_check;

comment on constraint notifications_event_type_check on public.notifications is
  'Allowed notification events, including targeted operational attention for same-site manager/lead call-in workflows.';

commit;
