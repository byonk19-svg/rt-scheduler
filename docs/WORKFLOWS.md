# Workflows

Operational workflows as implemented in the current codebase.

## 0) Public Auth + Access Approval

1. User lands on `/` and chooses `Sign in` or `Create account`.
2. Therapist self-signup at `/signup` creates a pending account (`profiles.role = null`) and immediately signs in.
3. Pending users are routed to `/pending-setup` and have no operational dashboard access.
4. Manager reviews pending users at `/requests/user-access`.
5. Manager approves with required role selection (`therapist` or `lead`) or declines.
6. Approve activates access and sends approval email; decline deletes the pending auth account.
7. E2E auth smoke uses a dedicated real account via `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and verifies both login and logout.

## 1) Manager: Build and Publish a Cycle

1. Create/select a cycle in `/coverage`.
   - `New 6-week block` creates a draft cycle.
   - `/schedule` is a compatibility route that redirects into `/coverage`.
   - Navigation contract: manager AppShell must still treat `/schedule` as part of the `Schedule` section and highlight the `Coverage` secondary tab, since users still land there from legacy links and server redirects.
   - The fixed manager secondary nav must stay horizontally scrollable on narrow widths rather than shrinking or clipping workflow tabs.
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
   - processes publish emails immediately in the publish action
   - sends in-app notifications

## 1.1) Manager: Work on a Published Cycle

- Published cycles stay editable in `/coverage`.
- Coverage presents the active published cycle as a live schedule rather than a locked artifact.
- Manual assignment changes, removals, and lead changes remain available and are treated as post-publish modifications.
- Published assignment status changes (`on call`, `cancelled`, `call in`, `left early`) are shown on the shared schedule UI and included in therapist published-schedule change notifications.
- `Start over` on a currently live cycle unpublishes it, clears shifts, and closes any active preliminary snapshot.

## 2) Manager: Coverage Edits (Drag/Drop and Picker)

- Endpoint: `POST /api/schedule/drag-drop`
- Supported actions: `assign`, `move`, `remove`, `set_lead`.
- Applies eligibility checks (inactive/FMLA, cycle overrides, recurring pattern, PRN strict).
- Enforces daily coverage max and weekly limits unless manager override flag is set.
- Returns conflict payload when override confirmation is required.

## 3) Therapist/Manager: Availability Input

- Day-level table: `availability_overrides` (cycle-scoped).
- Official therapist submit state: `therapist_availability_submissions` (one row per therapist per cycle after **Submit availability**; **Save progress** stores overrides only and does not create this row).
- Therapist grid (`/therapist/availability`, staff `/availability`): **Save progress** (draft) vs **Submit availability** / **Save changes** (updates submission timestamps per app rules).
- Single-row therapist save (`submitAvailabilityEntryAction`) also upserts the submission row so it cannot drift from the grid path.
- Manager planner entries use `source = manager` on `availability_overrides` (separate from therapist official submit).
- Manager planner can also **Copy from last block** for one therapist on `/availability`:
  - finds the most recent other cycle with manager-entered overrides for that therapist
  - shifts dates by the difference between source and target cycle starts
  - copies only rows that still land inside the target cycle
  - skips dates already planned in the target cycle instead of overwriting them
- Manager “who has submitted” for the cycle uses submission IDs, not “has any therapist override rows.”
- No approval step for availability entries.

## 3.1) Manager: Email Intake / Manual Intake

- Review surface: `/availability` -> **Email Intake**
- Intake storage:
  - `availability_email_intakes`
  - `availability_email_attachments`
- Supported channels:
  - `provider = resend` for inbound webhook-driven requests
  - `provider = manual` for manager-created fallback intake rows
- Webhook path:
  - `POST /api/inbound/availability-email`
  - route verifies the Resend webhook signature
  - route fetches inbound email content + attachments from Resend receiving APIs
  - route parses request dates and stores a reviewable intake row
- Manual fallback path:
  - manager selects therapist + cycle
  - manager pastes request text and/or uploads an image/PDF form
  - image uploads can be OCR'd through the OpenAI Responses API when configured
  - PDFs are stored for review but are not OCR'd automatically yet
- Apply path:
  - manager clicks **Apply dates**
  - parsed dates are written into `availability_overrides` with `source = manager`
  - intake row is marked `applied`

Current operational guidance:

- Use the manual intake form to test the workflow immediately.
- Treat inbound email as an additional channel, not the only path, until Resend receiving reliably emits `email.received` events for the domain.

## 4) Assignment Status Updates

- API: `POST /api/schedule/assignment-status`
- Allowed actors: manager, lead, or lead-eligible therapist/staff.
- Persists via RPC `update_assignment_status`.
- Updates status metadata on `shifts` and writes `shift_status_changes` audit rows.
- Used by manager month/week calendar and coverage status flows.
- If the cycle is already published, the affected therapist also receives a `published_schedule_changed` in-app notification describing the new status.

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
