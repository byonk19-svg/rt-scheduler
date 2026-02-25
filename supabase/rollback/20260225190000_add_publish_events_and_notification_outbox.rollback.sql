drop policy if exists "Managers can insert notification outbox" on public.notification_outbox;
drop policy if exists "Managers can read notification outbox" on public.notification_outbox;
drop policy if exists "Managers can insert publish events" on public.publish_events;
drop policy if exists "Managers can read publish events" on public.publish_events;

drop index if exists public.notification_outbox_status_created_at_idx;
drop index if exists public.notification_outbox_event_status_idx;
drop index if exists public.publish_events_cycle_published_at_idx;

drop table if exists public.notification_outbox;
drop table if exists public.publish_events;
