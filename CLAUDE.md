# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-23 (alignment pass)

## What This App Is
Teamwise is a respiratory therapy scheduling app that replaces paper scheduling workflows.
Core areas: coverage planning, schedule cycles, availability requests, shift board, approvals, publish workflow, team directory.

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
- `/coverage` -> redirects to `/schedule?view=calendar`
- `/schedule`
- `/approvals` (alias flow via shift board)
- `/availability`
- `/shift-board`
- `/directory` (manager team directory)
- `/profile`

## Role Model
Stored in `profiles.role`.
- `manager`: full schedule editing and publish controls
- `therapist`: staff experience

Lead behavior is currently implemented through existing equivalent fields:
- `profiles.is_lead_eligible = true` is treated as lead-capable for assignment status updates and lead designation flows.

## Scheduling Rules (Active)
Coverage and publish logic:
- Coverage target range per shift slot: 3-5
- Weekly therapist limits: per profile max (with employment defaults)
- Exactly one designated lead per slot (`shifts.role = 'lead'`), must be lead-eligible

Auto-generate rules:
- Tries to schedule 4 therapists per shift first (within 3-5 constraints)
- Counts as unfilled only when a slot remains below minimum 3
- Excludes FMLA and inactive staff by default
- PRN rule:
  - PRN without entered preferred weekdays is not auto-scheduled
  - PRN is only auto-scheduled on entered preferred weekdays

Important:
- Assignment status feature is informational only right now
- Assignment status does NOT affect coverage counts, needs-attention counts, or publish blockers

## Coverage Calendar UX (Current)
- Single continuous 6-week style weekly grid (Sun-Sat rows) across full cycle range
- No month section headers/splits
- No inner vertical scroll container; page scroll is natural
- Day/Night segmented toggle above grid
- Filter bar and legend remain above grid
- Cell header shows date number; month boundary cells show month+day (example: `Mar 30`, `Apr 1`)
- Cell content shows lead, coverage, and assigned therapist names

## Assignment Status Feature (Lead/Manager)
Backend:
- Status values: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`
- Stored on `public.shifts`:
  - `assignment_status`
  - `status_note`
  - `left_early_time`
  - `status_updated_at`
  - `status_updated_by`
- Secure RPC:
  - `public.update_assignment_status(...)` (SECURITY DEFINER)
  - Enforces auth, role checks, site scope, and updates only status fields
- API endpoint:
  - `POST /api/schedule/assignment-status` (RPC-only update path)

UI:
- Therapist names are clickable for manager/lead-equivalent users
- Popover status picker, optional note, optional left-early time
- Undo after update via toast action
- Non-scheduled statuses show compact indicator + tooltip metadata
- Non-scheduled assignment status badges (CI/CX/OC/LE) use a consistent red tone
- Staff users are read-only for status controls

## Notifications and Audit
Notifications:
- Bell in top nav with unread badge
- Marks all read on open
- Recent dropdown list with timestamps
- Tables/API:
  - `public.notifications`
  - `/api/notifications`
  - `/api/notifications/mark-read`

Audit log:
- `public.audit_log`
- Recent activity panel on coverage page
- Tracks schedule actions including publish and roster edits

## Employee Directory
- Dedicated `/directory` page (manager)
- Tabs, search, compact filters, sortable table
- Edit drawer for profile/staffing fields
- Soft deactivate/reactivate (no hard delete path)
- Fields include team, employment type, lead eligibility, FMLA, return date, active

## Data Model Snapshot
Key tables:
- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests`
- `shift_posts`
- `notifications`
- `audit_log`

Key `profiles` fields in use:
- `full_name`, `email`, `phone_number`
- `role`, `shift_type`, `employment_type`, `max_work_days_per_week`
- `is_lead_eligible`, `on_fmla`, `fmla_return_date`, `is_active`
- `preferred_work_days`, `default_calendar_view`, `default_landing_page`
- `site_id`

Key `shifts` fields in use:
- `cycle_id`, `user_id`, `date`, `shift_type`
- `status` (`scheduled|on_call|sick|called_off`)
- `role` (`lead|staff`)
- assignment-status fields listed above
- `site_id`

## Recent Migrations (Most Relevant)
- `20260223091500_add_profile_view_and_landing_preferences.sql`
- `20260223104500_add_notifications_and_audit_log.sql`
- `20260223121500_add_assignment_status_rpc.sql`

Also required earlier staffing/lead/profile migrations remain part of baseline.

## Quality Status (Current)
Latest checks run successfully:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

Alignment run details (latest):
- Lint: pass
- Unit tests: 7 files, 32 tests passed
- Build: pass on Next.js 16.1.6 (Turbopack)

## Notes for Resume
If calendar appears empty while data exists:
- schedule page has a legacy fallback query path for shifts
- still run latest DB migrations to avoid fallback mode:
  - `supabase db push`

## Quick Resume Checklist
1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npm run lint`
5. `npm run test:unit`
6. `npm run build`
7. `npm run dev`

## Next High-Value Priorities
1. Add integration/e2e coverage for assignment status popover + undo
2. Add explicit UI banner when schedule page is in legacy fallback mode
3. Expand publish/readiness analytics and reduce duplicate metrics
4. Harden role naming if moving from `therapist` to explicit `lead/staff` roles later
