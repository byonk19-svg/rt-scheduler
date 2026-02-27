# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-27 (PRN strict eligibility + cycle-scoped work patterns + manager-entered availability)

## Latest Completed Work (2026-02-27)
- Enforced PRN strict eligibility end-to-end:
  - Added shared eligibility resolver used by auto-generate + picker/API paths:
    - `resolveEligibility(...)` in `src/lib/coverage/resolve-availability.ts`
    - PRN can be scheduled only when:
      - cycle override has `force_on`, OR
      - recurring work pattern explicitly offers that weekday (`works_dow`) and other hard constraints pass.
    - new blocked reason surfaced: `PRN not offered for this date`
  - Auto-generate candidate selection now honors PRN strict policy through shared resolver:
    - `src/lib/schedule-helpers.ts`
  - Assignment/move/set-lead drag-drop API now hard-blocks PRN-not-offered (not override-confirmable):
    - `src/app/api/schedule/drag-drop/route.ts`
- Picker and availability UX aligned to strict policy:
  - Manager month smart picker:
    - PRN-not-offered rows are disabled with tooltip `PRN not offered for this date`
    - override-enabled PRN rows show badge `Offered`
    - file: `src/components/manager-month-calendar.tsx`
  - Therapist availability page:
    - PRN therapists can submit only `Available to work (PRN)` (`force_on`)
    - non-PRN therapists submit `Need off` (`force_off`)
    - server-side validation enforces employment-type override policy
    - files:
      - `src/app/availability/page.tsx`
      - `src/app/availability/availability-requests-table.tsx`
  - Manager directory wording clarified for override type labels:
    - `src/components/EmployeeDirectory.tsx`
- Introduced recurring work-pattern model:
  - New `work_patterns` table (manager-managed):
    - `works_dow`, `offs_dow`
    - `weekend_rotation` + `weekend_anchor_date`
    - `works_dow_mode` (`hard`/`soft`)
  - New typed helpers and unit tests:
    - `src/lib/coverage/work-patterns.ts`
    - `src/lib/coverage/resolve-availability.ts`
    - `src/lib/coverage/generator-slot.ts`
- Replaced legacy availability entry flow with one cycle-scoped source of truth:
  - `availability_overrides` now used for therapist + manager overrides.
  - Supports `force_off` and `force_on` by cycle/date/shift.
  - Added `source` metadata (`therapist`/`manager`) with source-aware RLS.
- Auto-generate now enforces hard constraints and records constraint-based unfilled slots:
  - Never violates `offs_dow`
  - Never violates off-weekend parity
  - Honors `works_dow_mode='hard'` as strict
  - Applies penalty when `works_dow_mode='soft'`
  - Writes `shifts.unfilled_reason='no_eligible_candidates_due_to_constraints'`
- Coverage and schedule feedback updated:
  - `constraints_unfilled` summary surfaced post-generation
  - slot-level badge: `No eligible therapists (constraints)`
- Team Directory manager workflow expanded:
  - Employee drawer includes cycle-scoped Date Overrides editor:
    - add/update/delete `Need off` / `Available to work`
    - manager saves with `source='manager'`
    - rows show badge: `Entered by manager`
  - Added cycle-scoped `Missing availability` table with quick action:
    - shows overrides count, last updated, submitted/not submitted
    - `Enter availability` opens drawer focused on override section
- Coverage assignment status update logic extracted + tested:
  - `src/lib/coverage/updateAssignmentStatus.ts`
  - includes proper rollback + user-facing error + real error logging

## Previous Milestone (2026-02-24)
- Availability workflow moved to `availability_entries` with role-based input:
  - full-time/part-time submit `unavailable`
  - PRN submit `available`
- Availability override metadata and confirmation flow added to `shifts`.
- Approvals flow narrowed to post-publish shift posts.
- Manager dashboard redesign shipped with live Supabase metrics.
- e2e coverage added for availability override + PRN soft-warning paths.

## What This App Is
Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, directory.

## Current Stack
- Next.js 16.1.6 (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS + RPC)
- Tailwind + shadcn/ui patterns
- Vitest (unit) + Playwright (e2e)

## Current Product Shape
Primary routes:
- `/` public marketing
- `/login`, `/signup`
- `/dashboard` role redirect
- `/dashboard/manager`, `/dashboard/staff`
- `/coverage` dedicated coverage UI (client page, full-width calendar + slide-over panel)
- `/schedule` schedule workspace (Week/Month views)
- `/approvals`
- `/availability`
- `/shift-board`
- `/directory` (manager team directory)
- `/profile`

## Role Model
Role source: `profiles.role`.
- `manager`: full scheduling + publish + directory controls
- `therapist`: staff experience

Lead capability is represented by `profiles.is_lead_eligible`.

## Scheduling Rules (Active)
- Coverage target: 3-5 per shift slot
- Weekly therapist limits from profile/defaults
- Exactly one designated lead (`shifts.role='lead'`) and lead must be eligible
- Recurring pattern constraints:
  - `offs_dow` is hard block
  - every-other-weekend off parity is hard block
  - `works_dow` is hard when `works_dow_mode='hard'`
  - `works_dow` is soft preference when `works_dow_mode='soft'`
- Cycle-scoped date overrides precedence:
  - inactive/FMLA blocks first
  - `force_off` blocks date in that cycle
  - `force_on` allows date in that cycle (except inactive/FMLA)
  - fallback to recurring pattern if no override
- PRN strict policy:
  - PRN is eligible only when:
    - cycle override matches with `force_on`, OR
    - recurring pattern offers that date (`works_dow`) and hard constraints pass.
  - PRN without `force_on` and without an offered recurring day is not eligible.

Auto-generate:
- Targets 4 therapists first when feasible
- Treats slot as unfilled only when below 3
- Excludes inactive + FMLA by default
- Leaves remaining slots unfilled when constraints eliminate candidates
- Marks constraint-caused unfilled slots for UI messaging and auditability

Assignment status remains informational only:
- Does not change coverage counts, attention metrics, or publish blockers

## Coverage UX (Current)
`/coverage` now uses:
- Full-width 7-column day calendar (no side panel shrinking layout)
- Fixed right slide-over detail panel (`z-50`)
- Click backdrop (`z-40`) or close button to dismiss
- Click same day again toggles panel closed
- Accordion therapist rows in panel (single expanded row)
- Day/Night shift tabs in coverage view
- Optimistic status updates with rollback on save failure
- Unassign therapist action from expanded row in the right panel
- Calendar chips now visibly reflect assignment status updates immediately:
  - `OC` (on call), `LE` (leave early), `X` (cancelled), with distinct chip colors
- Constraint visibility:
  - slot badge and detail note for `No eligible therapists (constraints)`
- Assignment picker behavior:
  - PRN not offered for date is disabled in smart picker with tooltip
  - PRN enabled via cycle override is labeled `Offered`

## Schedule UX (Current)
`/schedule` navigation now exposes only:
- `Week`
- `Month`

Grid/List tabs were removed from header navigation.
Legacy URLs with `view=grid` and `view=list` normalize to `view=week`.

Manager information hierarchy is now schedule-first:
- Coverage and publish are primary
- Approvals are intentionally secondary

## Navbar / Branding (Current)
- Navbar logo replaced with inline amber icon + Teamwise wordmark component in `AppShell`
- Plus Jakarta Sans (800) added at root layout via `next/font/google`
- Amber accents:
  - active nav pill: `#d97706`
  - user avatar circle: `#d97706`
  - manager badge: bg `#fffbeb`, text `#b45309`, border `#fde68a`
- App shell header z-index lowered to `z-30` so coverage overlay correctly layers above it
- App shell includes `/coverage` route so top nav is present on coverage page
- Manager nav order is schedule-first:
  - `Dashboard`, `Coverage`, `Team`, `Requests` (approvals moved later and renamed in nav)

## Assignment Status Feature
Backend status values:
- `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Stored fields on shifts:
- `assignment_status`
- `status_note`
- `left_early_time`
- `status_updated_at`
- `status_updated_by`

Write path:
- `POST /api/schedule/assignment-status`
- Optimistic local update with rollback on failure in client views

## Notifications and Audit
Notifications:
- Bell in top nav
- unread badge + list + mark-read behavior
- APIs: `/api/notifications`, `/api/notifications/mark-read`

Audit:
- `public.audit_log`
- recent activity panel available in schedule coverage flows

## Data Model Snapshot
Core tables:
- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests` (legacy)
- `availability_entries` (legacy transitional model)
- `work_patterns` (active recurring rules model)
- `availability_overrides` (active cycle-scoped override model)
- `shift_posts`
- `notifications`
- `audit_log`

Common profile fields used:
- `full_name`, `email`, `phone_number`
- `role`, `shift_type`, `employment_type`
- `max_work_days_per_week`
- `is_lead_eligible`, `on_fmla`, `fmla_return_date`, `is_active`
- `default_calendar_view`, `default_landing_page`
- `site_id`

Common shift fields used:
- `cycle_id`, `user_id`, `date`, `shift_type`
- `status` (`scheduled|on_call|sick|called_off`)
- `role` (`lead|staff`)
- `unfilled_reason`
- availability override fields:
  - `availability_override`
  - `availability_override_reason`
  - `availability_override_by`
  - `availability_override_at`
- assignment-status fields listed above
- `site_id`

## Recent Migrations (Relevant)
- `20260223091500_add_profile_view_and_landing_preferences.sql`
- `20260223104500_add_notifications_and_audit_log.sql`
- `20260223121500_add_assignment_status_rpc.sql`
- `20260223191000_harden_role_and_lead_permissions.sql`
- `20260224103000_add_shift_status_changes_audit.sql`
- `20260224121500_add_availability_entries_and_override_metadata.sql`
- `20260227143000_add_work_patterns_and_cycle_overrides.sql`
- `20260227184500_add_source_to_availability_overrides.sql`

## Quality Status
Latest local checks:
- `npx tsc --noEmit` pass
- `npm run lint` pass
- `npm run test:unit` pass
- Focused unit coverage for PRN strict policy pass:
  - `src/lib/coverage/resolve-availability.test.ts`
  - `src/lib/schedule-helpers.test.ts`
  - `src/app/api/schedule/drag-drop/route.test.ts`

## Resume Checklist
1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npx tsc --noEmit`
5. `npm run lint`
6. `npm run test:unit`
7. `npm run dev`

## Paused Work
### Publish flow with async email + publish history
Status: Implemented in code, pending final validation and rollout.

Resume checklist:
- Run migration: `supabase/migrations/20260225190000_add_publish_events_and_notification_outbox.sql`
- Set env vars:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `PUBLISH_EMAIL_FROM`
  - `NEXT_PUBLIC_APP_URL`
  - optional `PUBLISH_WORKER_KEY`
- Validate manager publish UX:
  - Publish shows "Published - visible to employees"
  - Publish shows queued/sent/failed counts
- Validate async queue processing:
  - `POST /api/publish/process` processes queued rows
  - counts update on `/publish` and `/publish/[id]`
- Validate retry path:
  - Use "Re-send failed" on `/publish/[id]`
  - Reprocess queue and confirm failures can move to sent
- Optional: add scheduled worker/cron to call `/api/publish/process`

## Next High-Value Priorities
1. Add integration/e2e coverage for manager date-override workflow in `/directory`
2. Add server-side validation messages for cycle/date conflicts directly in drawer UI
3. Align `/coverage` and `/schedule` into one consistent data/view model (reduce duplicated calendar logic)
4. Add integration tests for calendar overlay interactions (open/close/toggle/accordion)
