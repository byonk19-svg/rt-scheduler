# Observability

## What is instrumented

- Sentry is integrated for Next.js (client, server, and edge runtimes).
- Error capture is wired into:
  - publish processing: `src/app/api/publish/process/route.ts`
  - publish requeue action: `src/app/publish/actions.ts`
  - assign/unassign API flow: `src/app/api/schedule/drag-drop/route.ts`
  - assignment status updates: `src/app/api/schedule/assignment-status/route.ts`
  - coverage page client-side assign/unassign/status failures: `src/app/coverage/page.tsx`
- Server-side JSON structured logs are emitted with:
  - `event` (event name)
  - IDs (`user_id`, `shift_id`, `therapist_id`, `assignment_id`, `publish_event_id`)
  - `cycle_id` when available

## Required environment variables

- `SENTRY_DSN` (server/edge)
- `NEXT_PUBLIC_SENTRY_DSN` (browser)
- `SENTRY_TRACES_SAMPLE_RATE` (optional, `0.0` to `1.0`)
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (optional, `0.0` to `1.0`)

## Structured log format

Each server log line is a JSON object, for example:

```json
{
  "ts": "2026-02-28T20:02:45.291Z",
  "level": "info",
  "event": "schedule.assign.completed",
  "user_id": "manager-123",
  "cycle_id": "cycle-456",
  "shift_id": "shift-789",
  "therapist_id": "user-222"
}
```

## Verification checklist

1. Set DSN env vars, then run `npm run dev`.
2. Confirm server startup has no Sentry init errors.
3. Run a normal manager assign and unassign in schedule/coverage.
4. In server logs, confirm structured events:
   - `schedule.assign.completed`
   - `schedule.unassign.completed`
5. Update an assignment status from month/week manager calendar.
6. Confirm logs:
   - `assignment_status.update.requested`
   - `assignment_status.update.completed`
7. Trigger a status update error by calling `/api/schedule/assignment-status` with a bad `assignmentId` as manager.
8. Confirm:
   - structured error log `assignment_status.update.failed`
   - a Sentry event containing `assignment_id` and (if provided by client) `cycle_id`
9. Trigger publish processing via `/api/publish/process` and confirm:
   - `publish.process.requested`
   - `publish.process.completed`
10. Trigger a publish processing error (for example, temporarily remove `SUPABASE_SERVICE_ROLE_KEY` and restart).
11. Confirm:
    - structured error log `publish.process.admin_client_failed`
    - matching Sentry event
