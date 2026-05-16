# Data Integrity Report

Last updated: 2026-05-16

## Scope

This audit reviewed scheduling data paths where UI state can drift from backend truth or where stale actors can keep participating in scheduling workflows.

Reviewed areas:

- Schedule Block and coverage grid loading: `src/app/(app)/schedule/schedule-grid-data.ts`
- Schedule mutation actions: `src/app/(app)/schedule/actions/*`
- Operational status and staffing safety: `src/lib/operational-codes.ts`, `src/lib/coverage/status-ui.ts`, `src/lib/staffing-safety.ts`
- Availability manager and therapist flows: `src/app/(app)/availability/*`, `src/lib/availability/*`, `src/lib/therapist-availability-submission.ts`
- Availability submission and publish checks: `src/lib/employee-directory.ts`, `src/lib/availability-publish-validation.ts`
- Shift swaps and pickups: `src/app/api/shift-posts/*`, `src/lib/request-page-data.ts`, `src/lib/request-workflow.ts`, `src/lib/shift-board-snapshot.ts`
- Lottery status reconciliation: `src/lib/lottery/service.ts`, `src/lib/lottery/status-reconciliation.ts`
- Export and reporting APIs: `src/app/api/*/export/route.ts`, `src/lib/analytics-queries.ts`
- Supabase lifecycle seams and migrations under `supabase/migrations`

## Integrity Risks Found

### Fixed: Shift-board actors could reach workflow logic while inactive or archived

`src/lib/shift-board-snapshot.ts` already filtered active teammates, but it did not block the current actor when the actor profile was inactive, archived, missing, or roleless. That could let stale users see request-board state derived from historical requests.

`src/app/api/shift-posts/route.ts` also relied on lower-level RPC validation for therapist-owned request mutations. Manager review actions had lifecycle-aware app-layer checks, but create/respond/withdraw/interest paths did not consistently stop stale actors before entering workflow mutations.

### Fixed: Analytics submission compliance used the wrong submission-cycle column

`src/lib/analytics-queries.ts` queried `therapist_availability_submissions` using `cycle_id`, but the real schema and the rest of the app use `schedule_cycle_id`. That could make analytics compliance stale, empty, or misleading even while the manager availability page was correct.

The same compliance denominator counted active roles but did not explicitly exclude archived profiles.

### Fixed: Availability reminders could include archived profiles

Manager reminder recipients were filtered by `is_active` and `on_fmla`, but not by `archived_at`. Archived therapists should not receive missing-submission reminders.

## Fixes Implemented

- `src/lib/shift-board-snapshot.ts`
  - Blocks missing, inactive, or archived actors from loading a request-board snapshot.
  - Keeps the request-board teammate list scoped to active, unarchived therapists/leads.
- `src/app/api/shift-posts/route.ts`
  - Adds a shared active actor guard for all shift-post workflow commands before RPC calls.
  - Preserves the stricter manager-only review check for review/deny commands.
- `src/lib/analytics-queries.ts`
  - Reads `schedule_cycle_id` from `therapist_availability_submissions`.
  - Groups submission compliance by the real schedule-cycle key.
  - Excludes archived profiles from the active-staff compliance denominator.
- `src/app/(app)/availability/manager-reminder-action-impl.ts`
  - Excludes archived profiles from missing-submission reminder recipients.

No Supabase schema changes were made. No RLS policies were weakened or changed.

## Tests Added Or Updated

- `src/lib/shift-board-snapshot.test.ts`
  - Adds inactive-actor coverage for request-board snapshots.
- `src/app/api/shift-posts/route.test.ts`
  - Updates inactive actor behavior to stop before RPC mutation.
  - Adds archived actor coverage.
- `src/lib/analytics-queries.test.ts`
  - Locks submission compliance to `schedule_cycle_id`.
  - Keeps distinct therapist counting per cycle.
- `src/app/(app)/availability/action-workflow-exports.test.ts`
  - Locks availability reminders to active, unarchived, not-submitted recipients.

## Issues Deferred

- Schedule grid inactive rows: the grid currently keeps inactive therapists visible as ineligible rows. That may be correct for historical/stale assignment visibility, but product rules should decide whether inactive users with no assignment in the selected block should be hidden from draft planning.
- Team roster export: the roster export includes inactive staff intentionally enough that changing it would be a product decision. If the export should be operational-only, it should add an explicit "active roster" mode instead of silently dropping historical staff.
- Availability publish validation: `summarizeAvailabilityPublishIssues()` can fall back to override-based "provided availability" when official submission IDs are not passed. Current manager pages pass official submission IDs, but future callers should avoid relying on the fallback for official submitted/not-submitted truth.
- Shift-board historical names: historical request cards still resolve names for archived users when those users are already part of the request record. This preserves auditability and history rather than hiding old counterparties.
- Lottery read visibility: therapist and lead read visibility is preserved. Manager-only controls remain separate from page/read access.

## Business Rules Needing Human Decision

- Should inactive therapists with existing assignments remain visible in Schedule Block grids for historical clarity, or only when they still have a shift in that block?
- Should manager exports default to all known roster rows, or only active/unarchived operational staff?
- Should availability "provided but not officially submitted" ever be acceptable at publish time, or should every publish gate require `therapist_availability_submissions` only?
- Should archived users retain read access to their own historical request/schedule pages after archival, or should archival fully remove app access?

## Manual QA Recommendations

- Active manager: verify dashboard, Coverage, Team, Availability, Approvals, Publish, exports, Shift Board review, and Lottery decision controls.
- Active lead: verify lead-visible schedule/shift-board flows without manager-only approvals, exports, or publish controls.
- Active therapist: verify My Schedule, Future Availability, Shift Board request creation, direct request response, and no manager actions.
- Inactive or archived therapist/manager: verify Shift Board pages/actions and privileged pages are blocked or redirected.
- Availability manager: verify missing-submission reminders target only active, unarchived, non-FMLA staff who lack an official submission row.
- Analytics: verify submission compliance counts match `therapist_availability_submissions.schedule_cycle_id`.
