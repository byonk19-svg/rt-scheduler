# Workflows

Operational workflows as implemented in the current codebase.

## 1) Manager: Build and Publish a Cycle

1. Create/select a cycle in `/coverage`.
   - `New 6-week block` creates a draft cycle.
   - `/schedule` is a compatibility route that redirects into `/coverage`.
2. Build draft assignments:
   - Manual add/move/remove/set lead, or
   - Auto-generate (`generateDraftScheduleAction`) using recurring patterns + cycle overrides.
   - `Clear draft` removes all draft assignments for the active unpublished cycle.
3. Resolve blockers in coverage:
   - under/over coverage
   - missing/multiple/ineligible lead
   - unfilled slots due to constraints
4. Publish (`toggleCyclePublishedAction`):
   - validates weekly and slot rules
   - writes `publish_events`
   - queues email rows in `notification_outbox`
   - sends in-app notifications

## 1.1) Manager: Work on a Published Cycle

- Published cycles stay editable in `/coverage`.
- Coverage presents the active published cycle as a live schedule rather than a locked artifact.
- Manual assignment changes, removals, and lead changes remain available and are treated as post-publish modifications.
- `Start over` on a currently live cycle unpublishes it, clears shifts, and closes any active preliminary snapshot.

## 2) Manager: Coverage Edits (Drag/Drop and Picker)

- Endpoint: `POST /api/schedule/drag-drop`
- Supported actions: `assign`, `move`, `remove`, `set_lead`.
- Applies eligibility checks (inactive/FMLA, cycle overrides, recurring pattern, PRN strict).
- Enforces daily coverage max and weekly limits unless manager override flag is set.
- Returns conflict payload when override confirmation is required.

## 3) Therapist/Manager: Availability Input

- Main table: `availability_overrides` (cycle-scoped).
- Therapist on `/availability`:
  - PRN can submit only `force_on` ("Available to work (PRN)").
  - Non-PRN therapist can submit only `force_off` ("Need off").
- Manager on `/directory` can enter `force_on` or `force_off` for any therapist (`source = manager`).
- No approval step for availability entries.

## 4) Assignment Status Updates

- API: `POST /api/schedule/assignment-status`
- Allowed actors: manager, lead, or lead-eligible therapist/staff.
- Persists via RPC `update_assignment_status`.
- Updates status metadata on `shifts` and writes `shift_status_changes` audit rows.
- Used by manager month/week calendar and coverage status flows.

## 5) Shift Board Requests

1. Therapist posts swap/pickup request (`shift_posts`, status `pending`).
2. Manager approves/denies in `/shift-board`.
3. On approve, DB trigger reassigns shift ownership and enforces lead safety rules.
4. Pending swap posts auto-expire by cron after shift date (`status = expired`).

## 6) Notifications and Audit

- `notifications`: in-app user feed (new request, approved/denied, publish events, assignments).
- `audit_log`: manager operational events (assignment, publish, lead updates, etc.).

## 7) Publish History vs Cycle Lifecycle

- `/publish` is an event log for publish deliveries, not the primary cycle-management surface.
- `Delete history` removes a `publish_events` record only.
- `Archive cycle` sets the cycle aside at the `schedule_cycles` level so it no longer appears in Coverage, Availability, or dashboard cycle pickers.
- Archival is limited to non-live cycles. Live cycles must be restarted as drafts before they can be archived.
