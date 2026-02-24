# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-24 (coverage + nav alignment)

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

Auto-generate:
- Targets 4 therapists first when feasible
- Treats slot as unfilled only when below 3
- Excludes inactive + FMLA by default
- PRN requires preferred weekdays to be considered

Assignment status remains informational only:
- Does not change coverage counts, attention metrics, or publish blockers

## Coverage UX (Current)
`/coverage` now uses:
- Full-width 7-column day calendar (no side panel shrinking layout)
- Fixed right slide-over detail panel (`z-50`)
- Click backdrop (`z-40`) or close button to dismiss
- Click same day again toggles panel closed
- Accordion therapist rows in panel (single expanded row)
- Optimistic status updates with rollback on save failure

Notes:
- Current `/coverage` implementation is day-shift focused in UI/data query.

## Schedule UX (Current)
`/schedule` navigation now exposes only:
- `Week`
- `Month`

Grid/List tabs were removed from header navigation.
Legacy URLs with `view=grid` and `view=list` normalize to `view=week`.

## Navbar / Branding (Current)
- Navbar logo replaced with inline amber icon + Teamwise wordmark component in `AppShell`
- Plus Jakarta Sans (800) added at root layout via `next/font/google`
- Amber accents:
  - active nav pill: `#d97706`
  - user avatar circle: `#d97706`
  - manager badge: bg `#fffbeb`, text `#b45309`, border `#fde68a`
- App shell header z-index lowered to `z-30` so coverage overlay correctly layers above it

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
- `availability_requests`
- `shift_posts`
- `notifications`
- `audit_log`

Common profile fields used:
- `full_name`, `email`, `phone_number`
- `role`, `shift_type`, `employment_type`
- `max_work_days_per_week`, `preferred_work_days`
- `is_lead_eligible`, `on_fmla`, `fmla_return_date`, `is_active`
- `default_calendar_view`, `default_landing_page`
- `site_id`

Common shift fields used:
- `cycle_id`, `user_id`, `date`, `shift_type`
- `status` (`scheduled|on_call|sick|called_off`)
- `role` (`lead|staff`)
- assignment-status fields listed above
- `site_id`

## Recent Migrations (Relevant)
- `20260223091500_add_profile_view_and_landing_preferences.sql`
- `20260223104500_add_notifications_and_audit_log.sql`
- `20260223121500_add_assignment_status_rpc.sql`
- `20260223191000_harden_role_and_lead_permissions.sql`
- `20260224103000_add_shift_status_changes_audit.sql`

## Quality Status
Latest local checks:
- `npm run lint` pass
- `npm run build` pass

## Resume Checklist
1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npm run lint`
5. `npm run test:unit`
6. `npm run build`
7. `npm run dev`

## Next High-Value Priorities
1. Align `/coverage` and `/schedule` into one consistent data/view model (reduce duplicated calendar logic)
2. Add integration tests for overlay panel interactions (open/close/toggle/accordion)
3. Add tests for optimistic rollback path on assignment-status update failures
4. Decide if Night shift should be shown in `/coverage` or route all manager coverage flow through `/schedule?view=week|calendar`
