# Observability

## Current Instrumentation

- Sentry is integrated for Next.js client, server, and edge runtimes through:
  - `instrumentation-client.ts`
  - `instrumentation.ts`
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
- `instrumentation.ts` exports `onRequestError = Sentry.captureRequestError`, so unhandled request errors are captured by the Next.js/Sentry integration when DSN env vars are configured.
- Explicit route-level structured logging and Sentry capture currently exists for:
  - publish processing route: `src/app/api/publish/process/route.ts`
  - unexpected assignment-status mutation failures: `src/app/api/schedule/assignment-status/route.ts`

## Explicit Event Names

`src/app/api/publish/process/route.ts` emits JSON structured server logs:

- `publish.process.requested`
- `publish.process.completed`
- `publish.process.admin_client_failed`
- `publish.process.failed`

The publish failure events also call Sentry with a generic event-name exception and safe context only.

`src/app/api/schedule/assignment-status/route.ts` emits JSON structured server logs and calls Sentry for:

- `assignment_status.update.failed`

This event is reserved for unexpected Lottery-aware mutation failures. Expected authorization denial and not-found RPC outcomes still return their specific 403/404 responses and are not captured as Sentry exceptions.

## Existing Non-Structured Surfaces

These flows have useful behavior but should not be treated as fully structured or Sentry-instrumented:

- `src/app/(app)/publish/actions.ts` uses ordinary `console.error` messages for server-action failures. It does not currently emit structured JSON logs or explicit Sentry events.
- `src/app/api/schedule/drag-drop/route.ts` primarily records durable schedule/audit behavior through `audit_log` writes. It has ordinary console logging for a post-publish audit lookup failure, but it does not currently emit structured JSON logs or explicit Sentry events for assign, move, remove, or set-lead outcomes.
- `/coverage` now redirects to the unified `/schedule` route through `src/app/(app)/coverage/page.tsx`; the old `src/app/(app)/coverage/CoverageClientPage.tsx` client surface no longer exists.
- Current schedule-grid client failure handling lives in `src/components/schedule-grid/ScheduleGrid.tsx` and `src/lib/coverage/mutations.ts`. It shows safe user-facing fallback/error messages, but it does not currently send client-side Sentry events for assignment/status failures.

## Safe Logging Rules

Structured observability must use stable event names and safe IDs only. Do not log or capture:

- secrets or auth tokens
- raw request bodies
- raw availability email, OCR text, or uploaded document text
- user notes unless that specific field is already intentionally logged elsewhere
- full Supabase error objects

Prefer IDs and short status fields such as:

- `user_id`
- `site_id`
- `cycle_id`
- `shift_id`
- `assignment_id`
- `publish_event_id`
- `status`
- `code`
- booleans such as `worker_request`

## Required Environment Variables

- `SENTRY_DSN` (server/edge)
- `NEXT_PUBLIC_SENTRY_DSN` (browser)
- `SENTRY_TRACES_SAMPLE_RATE` (optional, `0.0` to `1.0`)
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (optional, `0.0` to `1.0`)

`npm run verify:prod -- --production` checks that the server and browser DSNs are both present for production-shaped environments.

## Structured Log Format

Each structured server log line is a JSON object:

```json
{
  "ts": "2026-06-10T18:00:00.000Z",
  "level": "error",
  "event": "assignment_status.update.failed",
  "user_id": "manager-123",
  "site_id": "site-456",
  "assignment_id": "shift-789",
  "status": "on_call",
  "code": "XX000"
}
```

## Verification Checklist

1. Set DSN env vars, then run `npm run dev`.
2. Confirm server startup has no Sentry init errors.
3. Trigger publish processing through `/api/publish/process`.
4. Confirm server logs include:
   - `publish.process.requested`
   - `publish.process.completed`
5. Trigger a publish processing infrastructure error in a non-production environment.
6. Confirm:
   - structured error log `publish.process.admin_client_failed` or `publish.process.failed`
   - matching Sentry event with the same event name and safe context
7. Trigger an unexpected assignment-status mutation failure in a non-production environment.
8. Confirm:
   - structured error log `assignment_status.update.failed`
   - a Sentry event with safe context such as `assignment_id`, `user_id`, `site_id`, `status`, and `code`
9. For assign/move/remove/set-lead schedule mutations, verify audit-log behavior separately from observability. Those flows are not currently structured-log/Sentry instrumented.
