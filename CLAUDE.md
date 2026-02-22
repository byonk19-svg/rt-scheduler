# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-22

## What This App Is
Teamwise is a respiratory therapy scheduling app replacing manual paper workflows.
Core modules: schedule cycles, availability requests, shift board swaps/pickups, manager approvals, and publish workflow.

## Current Branch Snapshot
- Active branch: `claude/write-claude-md-YSz8m`
- Latest pushed commit before this doc refresh: `ea0fac6`
- `repomix-output.xml` is intentionally untracked and not pushed.

## What Was Completed Today
- Implemented lead eligibility + designated lead workflow in scheduling (Option A on shift assignments).
- Added publish-time lead/coverage validation summaries and blocking behavior.
- Added manager workflow IA polish:
  - top nav flow: `Dashboard` -> `Approvals` -> `Coverage` -> `Publish`
  - needs-attention strip with actionable deep links and focus-to-first issue behavior.
- Added unified Employee Directory (replacing split day/night long forms):
  - tabs, search, compact filters, editable drawer, deactivate/reactivate, badges.
  - fields: team (day/night), employment type, weekly limit, lead eligible, FMLA, potential return date, active.
- Added staffing constraints integration:
  - FMLA/inactive excluded by default from auto-generate and assign pickers.
  - optional toggle to show unavailable staff in schedule add/lead pickers.
- Added schedule safety utility:
  - `Clear draft and start over` action for draft cycles.
- Added therapist preference support:
  - therapists can set preferred weekdays in `/profile`.
  - auto-generate prioritizes preferred weekdays when possible without violating constraints.
- Added cross-platform repo normalization:
  - `.gitattributes` + `.editorconfig` with LF defaults and Windows script exceptions.

## Product Status
Core routes:
- `/` home/marketing
- `/login`
- `/signup`
- `/dashboard` (role redirect)
- `/dashboard/manager`
- `/dashboard/staff`
- `/availability`
- `/schedule`
- `/shift-board`
- `/profile`

Role model:
- `manager`
- `therapist`

## Scheduling Rules (Current)
- Coverage rule: 3-5 therapists per day/night slot.
- Weekly workload rule: therapist-specific max worked days per Sun-Sat week (default by employment type; manager-editable).
- Lead rule:
  - exactly one designated lead (`role='lead'`) per shift slot `(cycle_id, date, shift_type)`.
  - designated lead must be `profiles.is_lead_eligible = true`.
  - lead-eligible therapists can still be assigned as `role='staff'`.
- Availability/FMLA/active behavior:
  - blackout dates from `availability_requests` are respected in auto-generate.
  - `profiles.on_fmla=true` and `profiles.is_active=false` are excluded from auto-generate by default.
- Preferred day behavior:
  - `profiles.preferred_work_days` is a soft preference (priority), not a hard constraint.
  - if preferred-day options are unavailable, generator falls back to eligible non-preferred staff.

## Manager Dashboard UX (Current)
- Needs Attention strip is the primary source for action metrics.
- Clickable metrics:
  - pending approvals -> approvals-pending view
  - unfilled shifts -> coverage filtered to under-coverage
  - missing lead -> coverage filtered to missing lead
- Attention total links to combined attention view.
- CTA hierarchy:
  - primary: `Fix coverage`
  - secondary: `Review approvals`
  - tertiary: `Go to publish` (disabled when blocked)
- Publish checklist uses explicit blocker labels and counts.

## Employee Directory (Current)
- Single directory component on manager dashboard:
  - tabs: All / Day / Night
  - search: name/email
  - filters: lead eligible, FMLA, include inactive
- Table columns:
  - Employee
  - Shift/Team
  - Type
  - Tags (Lead eligible, FMLA, Inactive)
  - Actions
- Row edit drawer fields:
  - name, email, phone
  - shift/team
  - employment type
  - max shifts/week
  - lead eligible
  - on FMLA (+ optional return date only when FMLA is on)
  - active toggle
- Deletion policy:
  - hard delete is not exposed; deactivate/reactivate only.

## Data Model Notes
Main tables:
- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests`
- `shift_posts`

Key profile fields currently used:
- identity/contact: `full_name`, `email`, `phone_number`
- staffing: `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`
- leave/status: `on_fmla`, `fmla_return_date`, `is_active`
- new preference: `preferred_work_days` (`smallint[]`, values `0..6`)

Key shift fields currently used:
- `status` (`scheduled|on_call|sick|called_off`)
- `role` (`lead|staff`)

## Migrations Added/Used Recently
- `20260222191647_add_lead_eligibility_and_designated_lead.sql`
  - lead eligibility field, shift role enum/column, one-lead-per-slot enforcement.
- `20260222195508_add_profile_phone_and_manager_profile_update_policy.sql`
  - profile phone and manager update policy.
- `20260222201205_remap_test_employees_to_firstname_lastinitial.sql`
  - remaps seeded test names.
- `20260222214000_add_profile_employment_and_weekly_limit.sql`
  - employment type + per-therapist weekly max.
- `20260222224500_add_employee_directory_fmla_and_active_fields.sql`
  - lead/FMLA/return date/active fields + staffing update restrictions.
- `20260222233000_add_profile_preferred_work_days.sql`
  - preferred weekday array + validity constraint.

Rollback scripts exist under `supabase/rollback/` for these recent additions.

## Technical Stack
- Next.js 16 App Router + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Vitest for unit tests
- Playwright for e2e
- Vercel deployment target

## Environment and Scripts
Required runtime vars in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional/admin scripts:
- `npm run seed:demo`
- `npm run seed:users` (requires `SUPABASE_SERVICE_ROLE_KEY`)

Quality scripts:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## Realigned Goals (Next Priorities)
1. Hardening and reliability
- apply all pending migrations in shared environments (`supabase db push`) and verify RLS behavior in production-like settings.
- add/expand tests around auto-generate with preferred days + lead constraints + weekly limits together.

2. Manager workflow clarity
- keep counts deduplicated between dashboard and detail pages.
- ensure `/shift-board` approvals filters and coverage deep links remain consistent with dashboard labels.

3. Scheduling quality
- optionally add “same pattern week-over-week” support as a stronger preference mode (still override-safe).
- add transparent “why assigned” hints in manager views (preferred day / fallback / rule override).

4. Data hygiene
- finalize realistic seeded users and keep test data scripts idempotent.

## Quick Resume Checklist
1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npm run lint`
5. `npm run test:unit`
6. `npm run build`
7. `npm run dev`
8. Verify:
   - manager dashboard attention links + publish checklist
   - employee directory edits + deactivate/reactivate + FMLA behavior
   - profile preferred weekdays save flow
   - auto-generate using preferred weekdays while respecting constraints
   - designated lead flow and publish blocking behavior
