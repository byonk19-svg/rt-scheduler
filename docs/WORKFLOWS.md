# Workflows

Operational workflows as implemented in the current codebase.

## 0) Public Auth + Access Approval

1. User lands on `/` and chooses `Sign in` or `Request access`.
2. Therapist self-signup at `/signup` creates an auth user. The `handle_new_user` trigger inserts `profiles`:
   - If the new user's normalized full name matches an active row in `employee_roster` (managed on `/team`), the profile is created with the roster's role, shift, employment, max-work-days, and lead-eligibility defaults. The roster row stores `matched_profile_id`.
   - If there is no match, `profiles.role` stays `null` and the user remains pending.
   - Public signup UX stays generic in both cases: the user is redirected to `/login?status=requested` instead of being told whether a roster match happened.
3. Pending users (`role = null`) are routed to `/pending-setup` and have no operational dashboard access.
4. Manager reviews pending users at `/requests/user-access`.
5. Manager approves with required role selection (`therapist` or `lead`) or declines.
6. Approve activates access, resets onboarding-owned schedule/preference state for the approved staff role, and sends approval email; decline deletes the pending auth account.
7. Newly approved or roster-matched therapists and leads are routed to `/onboarding` before they enter the normal app.
   - Required steps are `Set your normal schedule`, `Choose schedule preferences`, and `Choose notifications and appearance`.
   - `Review Future Availability` appears as a recommended next step when an actionable cycle exists, but it does not block completion.
   - `No preference` is a valid first-run answer for preferred work days and counts as complete.
8. E2E auth smoke uses a dedicated real account via `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and verifies both login and logout.

Manager preload:
On `/team`, use Employee roster (single add or bulk paste) so names match what staff type at signup. Use `/team/work-patterns` for dedicated recurring pattern administration. For an ops-only email-list-to-auth/profile sync, use `npm run sync:roster`.

## 1) Manager: Build and Publish a Cycle

1. Plan future Schedule Blocks in `/schedule/planning`.
   - The page suggests the next Sunday-start six-week block from the latest existing Schedule Block.
   - Suggested blocks are previews until a manager saves them.
   - Managers set date-only planning values: availability due date, Send Preliminary target, and Final Publish target.
   - A future block becomes visible for therapist availability only after it has an availability due date.
   - Planning edits are limited to future draft blocks. Current, Preliminary, Final, Offline, or Archived blocks are read-only here.
   - Moving a therapist-visible availability due date earlier requires an explicit confirmation save.
   - Therapist notifications are sent only when availability first becomes visible or a visible due date changes. Preliminary and Final Publish target edits are audit-only.
2. Create or select a cycle in `/schedule`.
   - `New 6-week block` creates a draft cycle.
   - `/schedule` is the canonical authenticated schedule grid for managers, leads, and therapists.
   - Managers edit draft assignments inline from grid cells; leads can update published assignment status but cannot assign new therapists.
   - Therapists see the same grid read-only with their own row pinned at the top.
   - The `/schedule` Day/Night toggle filters the grid by shift and preserves the `shift` query param.
   - `/coverage`, `/staff/schedule`, `/staff/my-schedule`, and `/therapist/schedule` redirect to `/schedule` for bookmark compatibility.
   - The fixed manager secondary nav must stay horizontally scrollable on narrow widths rather than shrinking or clipping workflow tabs.
3. Build draft assignments:
   - Manual assign, unassign, status update, or set lead from grid cell popovers.
   - Auto-generate (`generateDraftScheduleAction`) using recurring patterns and cycle overrides.
   - Auto-draft now runs a pre-flight report first so managers can review likely unfilled slots, missing leads, and forced must-work misses before generation.
   - `Clear draft` removes all draft assignments for the active unpublished cycle.
   - Managers can save a published cycle as a staffing template and apply a saved template to a draft cycle. Template data is shift-only (`day_of_cycle`) and intentionally excludes availability overrides.
4. Resolve blockers in Schedule:
   - under or over coverage
   - missing, multiple, or ineligible lead
   - unfilled slots due to constraints
5. Publish (`toggleCyclePublishedAction`):
   - validates weekly and slot rules
   - writes `publish_events`
   - queues email rows in `notification_outbox`
   - processes publish emails immediately in the publish action
   - sends in-app notifications

## 1.1) Manager: Work on a Published Cycle

- Published cycles stay editable in `/schedule`.
- Schedule presents the active published cycle as a live schedule rather than a locked artifact.
- Manual assignment changes, removals, and lead changes remain available and are treated as post-publish modifications.
- Published assignment status changes (`on_call`, `cancelled`, `call_in`, `left_early`) are shown on the shared schedule UI and included in therapist published-schedule change notifications.
- `Start over` on a currently live cycle unpublishes it, clears shifts, and closes any active preliminary snapshot.

## 2) Manager: Schedule Grid Edits

- Endpoint: `POST /api/schedule/drag-drop`
- Supported actions: `assign`, `remove`, `set_lead`
- Applies eligibility checks (inactive/FMLA, cycle overrides, recurring pattern, PRN strict).
- Enforces daily coverage max and weekly limits unless manager override flag is set.
- Returns conflict payload when override confirmation is required.
- Grid cells show current assignment state (`1`, `OC`, `CX`, `CI`, `LE`, or `.`) and append `*` when the therapist requested the day off.
- `*` is informational; managers can assign anyway after confirming the warning.
- The old block-board and roster-layout toggle are removed.

Schedule grid status model:

- Shared status rules live in `src/lib/schedule/schedule-status-model.ts`.
- Display status precedence is: matching active operational code, then `assignment_status`, then legacy `shifts.status` fallback, then scheduled staff/lead default.
- Client mutation payload mapping for schedule-grid status choices is centralized in the same model so server display state and client update requests do not drift.
- Schedule grid mutation failures use the app's non-blocking `FeedbackToast` pattern instead of browser alerts.
- Focused verification:
  - `npm run test:unit -- schedule-status schedule-grid-data schedule-grid`
  - `npx playwright test e2e/manager-schedule-roster.spec.ts --project=chromium --workers=1 --reporter=line`
  - `npx playwright test e2e/therapist-schedule-trust-smoke.spec.ts --project=chromium --workers=1 --reporter=line`

## 3) Therapist/Manager: Availability Input

- Recurring scheduling is now split into:
  - `Recurring Work Pattern` = the therapist's default template
  - `Future Availability` = a generated cycle view derived from that template
  - cycle overrides = date or range exceptions for that cycle only
- Editing future availability must not change the saved recurring pattern.
- First-run onboarding links into `/therapist/recurring-pattern` and `/therapist/settings` with `return_to=/onboarding` so required setup stays in the onboarding loop until the user finishes.
- Therapist recurring-pattern editor lives at `/therapist/recurring-pattern`.
- Manager advanced recurring-pattern editor lives at `/team/work-patterns/[therapistId]`.
- Legacy quick-edit and legacy work-pattern dialogs are weekly-only surfaces; advanced repeating-cycle patterns should be edited through the dedicated recurring-pattern pages.
- Day-level table: `availability_overrides` (cycle-scoped).
- Official therapist submit state: `therapist_availability_submissions` (one row per therapist per cycle after Submit availability; Save progress stores overrides only and does not create this row).
- Therapist grid (`/therapist/availability`, staff `/availability`): Save progress (draft) vs Submit availability / Save changes (updates submission timestamps per app rules).
- Single-row therapist save (`submitAvailabilityEntryAction`) also upserts the submission row so it cannot drift from the grid path.
- Therapist self-service now warns when a Need Off (`force_off`) selection collides with an already scheduled active-cycle shift on that date. This is a warning banner only and does not block saving.
- Manager planner entries use `source = manager` on `availability_overrides` (separate from therapist official submit).
- Manager planner can also Copy from last block for one therapist on `/availability`:
  - finds the most recent other cycle with manager-entered overrides for that therapist
  - shifts dates by the difference between source and target cycle starts
  - copies only rows that still land inside the target cycle
  - skips dates already planned in the target cycle instead of overwriting them
- Manager "who has submitted" for the cycle uses submission IDs, not "has any therapist override rows."
- No approval step for availability entries.

## 3.1) Manager: Email Intake / Manual Intake

- Review surface: `/availability` -> Email Intake
- Intake storage:
  - `availability_email_intakes`
  - `availability_email_attachments`
- Supported channels:
  - `provider = resend` for inbound webhook-driven requests
  - `provider = manual` for manager-created fallback intake rows
- Webhook path:
  - `POST /api/inbound/availability-email`
  - route verifies the Resend webhook signature
  - route fetches inbound email content and attachments from Resend receiving APIs
  - route parses request dates and stores a reviewable intake row
- Manual fallback path:
  - manager selects therapist and cycle
  - manager pastes request text and or uploads an image/PDF form
  - image uploads can be OCR'd through the OpenAI Responses API when configured
  - PDFs are stored for review; OCR fallback behavior is documented in `CLAUDE.md`
- Apply path:
  - manager clicks Apply dates
  - parsed dates are written into `availability_overrides` with `source = manager`
  - intake row is marked `applied`

Current operational guidance:

- Use the manual intake form to test the workflow immediately.
- Treat inbound email as an additional channel, not the only path, until Resend receiving is stable for the target domain.

## 4) Assignment Status Updates

- API: `POST /api/schedule/assignment-status`
- Allowed actors: manager or lead
- Persists via RPC `update_assignment_status`
- Updates status metadata on `shifts` and writes `shift_status_changes` audit rows
- Used by the unified `/schedule` grid status popover.
- Managers can update assigned cells in the grid. Leads can update staffed published cells to `OC`, `LE`, `CX`, or `CI`.
- If the cycle is already published, the affected therapist also receives a `published_schedule_changed` in-app notification describing the new status.

## 5) Shift Board Requests

1. Staff create shift requests from `/requests/new`.
2. Requests can be team-visible or direct:
   team requests are visible on `/shift-board`; direct requests stay between the requester, the selected teammate, and managers.
3. Team swap requests can optionally name a suggested swap partner up front; managers can keep or change that partner during review.
4. Direct swap recipients must already be scheduled on the same date and shift type.
5. Direct pickup recipients must match the shift type and must not already be scheduled on that date.
6. Lead-slot requests stay constrained by lead-coverage rules:
   lone-lead requests only surface lead-safe recipient options, and manager approval still enforces the same server-side lead checks.
7. Team pickup requests can collect interest from multiple therapists; manager review selects or denies the active claimant queue.
8. Direct requests require the recipient to accept before a manager can approve them.
9. Manager review happens in `/shift-board` and completes server-side assignment changes for approved swaps and pickups.
10. Pending swap posts still auto-expire after the request window (`status = expired`).

## 6) Notifications and Audit

- `notifications`: in-app user feed (new request, approved/denied, publish events, assignments, shift reminders)
- Notification lifecycle ownership is defined in `src/lib/notification-lifecycle.ts`.
  - Every allowed event has an owner, recipient policy, route policy, duplicate guard, reversal policy, and audit policy.
  - Request notifications distinguish actionable manager/recipient work from terminal history.
  - Publish and shift reminders have explicit dedupe policy; schedule/request mutation events remain distinct when each change is meaningful.
- Daily shift reminders also write `notifications` rows after successful delivery and are deduplicated through `shift_reminder_outbox`.
- `audit_log`: manager operational events (assignment, publish, lead updates, etc.)

## 7) Publish History vs Cycle Lifecycle

- `/publish` is an event log for publish deliveries, not the primary cycle-management surface.
- `Delete history` removes a `publish_events` record only.
- `Archive cycle` sets the cycle aside at the `schedule_cycles` level so it no longer appears in Schedule, Availability, or dashboard cycle pickers.
- Archival is limited to non-live cycles. Live cycles must be restarted as drafts before they can be archived.

## 8) Manager: Analytics

1. Manager opens `/analytics`.
2. The page loads three server-side summaries in parallel:
   - recent cycle fill rates
   - therapist submission compliance by cycle
   - force-on misses where a therapist requested work but was not scheduled
3. Fill-rate bars use the same ideal coverage target as auto-draft.
4. Analytics is read-only and manager-gated.

## 9) Manager: Work Patterns

1. Manager opens `/team/work-patterns`.
2. Therapists are grouped by day vs night shift.
3. Each row shows the plain-English recurring-pattern summary plus the day-level badge strip when applicable.
4. `Open editor` routes to `/team/work-patterns/[therapistId]` for the full pattern-type-first editor.
5. Weekly patterns still support weekday selection plus weekend rotation.
6. Repeating cycles support anchored work/off segment input and should be edited only through the dedicated page.

## 10) Manager: Team CSV Import

1. Manager opens `/team/import`.
2. Uploads a `.csv` or `.txt` file.
3. Maps source headers to Teamwise roster fields.
4. Reviews the preview and row-level validation errors.
5. Imports valid rows only; invalid rows can be skipped.
6. Imported rows upsert into `employee_roster`, then redirect back to `/team?tab=roster`.

This flow is intentionally separate from:

- the fixed-format bulk paste field inside `EmployeeRosterPanel`
- `npm run sync:roster` auth/profile sync
