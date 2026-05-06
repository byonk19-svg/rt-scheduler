-- Document and enforce the intended Data API posture for tables that are
-- server-owned, append-only, or lifecycle-managed through RPC/service-role code.
--
-- RLS already denies DELETE on these tables because no DELETE policies exist.
-- The explicit grant revocation below makes that contract visible at the
-- privilege layer too, while preserving service-role/admin maintenance paths.

revoke delete on table public.profiles from anon, authenticated;
revoke delete on table public.notifications from anon, authenticated;
revoke delete on table public.audit_log from anon, authenticated;
revoke delete on table public.publish_events from anon, authenticated;
revoke delete on table public.notification_outbox from anon, authenticated;
revoke delete on table public.shift_operational_entries from anon, authenticated;

revoke insert, update, delete on table public.shift_operational_entries from anon, authenticated;

comment on table public.profiles is
  'Profile deletes are intentionally service-role/admin maintenance operations; authenticated Data API clients may insert or update through RLS but cannot delete profiles.';

comment on table public.notifications is
  'Notifications are user-visible records with read/update RLS; authenticated Data API clients cannot delete notification rows.';

comment on table public.audit_log is
  'Append-only audit history. Authenticated clients may read or insert only through manager-scoped RLS and cannot update or delete rows.';

comment on table public.publish_events is
  'Append-only publish history. Managers may insert/read publish events through RLS, but deletion is intentionally reserved for service-role maintenance.';

comment on table public.notification_outbox is
  'Server-managed notification queue. Managers may insert/read outbox rows through RLS, but deletion is intentionally reserved for service-role maintenance.';

comment on table public.shift_operational_entries is
  'Operational shift state is written by trusted server routes, triggers, and RPC flows; authenticated Data API clients have read-only RLS visibility and no direct write grants.';
