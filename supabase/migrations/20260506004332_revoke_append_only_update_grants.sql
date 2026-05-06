-- Keep append-only/server-owned tables aligned at both privilege and RLS layers.
-- These tables intentionally expose INSERT/SELECT through RLS where needed, but
-- no authenticated Data API client should update rows after they are written.

revoke update on table public.audit_log from anon, authenticated;
revoke update on table public.publish_events from anon, authenticated;
revoke update on table public.notification_outbox from anon, authenticated;
