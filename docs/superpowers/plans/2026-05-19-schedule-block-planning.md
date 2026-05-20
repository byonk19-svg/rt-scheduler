# Schedule Block Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manager Schedule Block Planning so managers can create or review upcoming six-week Schedule Blocks, set the therapist availability due date, and set manager target dates for Send Preliminary and Final Publish.

**Architecture:** Add date-only planning fields to `schedule_cycles`, build a secondary manager route at `/schedule/planning`, derive therapist availability visibility from `availability_due_at`, and surface planning attention on the manager dashboard and Schedule local nav. Keep actual Send Preliminary and Final Publish actions on the existing Schedule workflow.

**Canonical Decisions:** `CONTEXT.md` defines Schedule Block Planning. Therapist visibility is derived from a future Schedule Block having an availability due date. There is no availability-open date and no separate visibility toggle. Preliminary and Final Publish target dates are manager planning milestones, not lifecycle authorities.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, server actions, Tailwind, Vitest, Playwright where local auth permits.

**Implementation Status (2026-05-19):** Complete. The implementation added the schema migration, pure planning helper, manager Planning route, server actions, manager navigation, manager dashboard links, therapist visibility filtering, manager Availability status cues, focused unit/source coverage, and a Playwright manager-to-therapist flow. Verification passed with format, lint, typecheck, build, focused unit tests, and targeted E2E. The configured Supabase test/dev database has the new migration applied.

**Hardening Status (2026-05-20):** Added a follow-up proof/hardening pass for lifecycle and dashboard edge cases. Planning create now rejects current or past Schedule Blocks, planning update is server-limited to future Draft blocks, the earlier-availability-due confirmation redirect preserves the pending date and opens the target block, manager-only Preliminary/Final target edits are audit-only, and dashboard planning cues now link to Planning, Availability, or Schedule according to where the manager can actually act. Verification passed focused unit/source tests, format check, lint, build, rerun typecheck after regenerated `.next/types`, and the targeted Playwright manager-to-therapist Schedule Block Planning workflow.

---

## File Map

### New files

| File                                                                  | Purpose                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `supabase/migrations/<timestamp>_schedule_block_planning_targets.sql` | Add planning target date columns and comments                                         |
| `src/lib/schedule-block-planning.ts`                                  | Pure helpers for suggestions, date validation, visibility, and due-date normalization |
| `src/lib/schedule-block-planning.test.ts`                             | Unit tests for helper behavior                                                        |
| `src/app/(app)/schedule/planning/page.tsx`                            | Manager Schedule Block Planning route                                                 |
| `src/app/(app)/schedule/planning/page.test.tsx`                       | Route/source rendering tests                                                          |
| `src/app/(app)/schedule/actions/planning-actions.ts`                  | Server actions to create/update planning fields                                       |
| `src/app/(app)/schedule/actions/planning-actions.test.ts`             | Server action tests                                                                   |

### Modified files

| File                                                     | Change                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/supabase/database.types.ts`                     | Add generated types for new columns                                                           |
| `src/app/(app)/schedule/actions/index.ts`                | Export planning actions                                                                       |
| `src/components/shell/app-shell-config.ts`               | Add Schedule local `Planning` item and active route handling                                  |
| `src/components/AppShell.test.ts`                        | Assert Planning is under Schedule, not primary nav                                            |
| `src/app/(app)/therapist/availability/page.tsx`          | Load only therapist-visible future Schedule Blocks and sort by due date                       |
| `src/app/(app)/availability/page.tsx`                    | Keep manager visibility broad but expose planning state as needed                             |
| `src/app/(app)/dashboard/manager/page.tsx`               | Load planning dates and compute attention items                                               |
| `src/components/manager/ManagerTriageDashboard.tsx`      | Render planning attention and links                                                           |
| `src/components/manager/ManagerTriageDashboard.test.tsx` | Cover dashboard planning attention                                                            |
| `src/lib/therapist-workflow.ts`                          | Prefer visible future blocks by due date when selecting therapist workflow                    |
| `src/lib/therapist-workflow.test.ts`                     | Cover multiple future visible blocks and missing due date behavior                            |
| `src/lib/therapist-availability-submission.ts`           | Stop falling back to inferred deadlines for therapist-visible future blocks where appropriate |
| `src/lib/therapist-availability-submission.test.ts`      | Update deadline assumptions                                                                   |
| `docs/DATA_MODEL.md`                                     | Document planning fields and visibility semantics                                             |
| `CONTEXT.md`                                             | Already updated during product decisions; keep in sync if implementation reveals changes      |

---

## Data Model

Add two nullable date columns to `schedule_cycles`:

- `preliminary_target_date date null`
- `final_publish_target_date date null`

Keep existing:

- `availability_due_at timestamptz null`

Manager UI treats all three planning values as date-only:

- Availability due date: date-only input, stored by normalizing to end-of-day in `availability_due_at`.
- Send Preliminary target date: date-only column.
- Final Publish target date: date-only column.

Do not add an availability-open date.
Do not add a therapist visibility toggle.

Visibility rule:

- A future unpublished, unarchived Schedule Block is therapist-visible for availability only when `availability_due_at` is present.
- Once visible, the due date may be replaced but should not be cleared through normal planning UI.

---

## Task 1: Schema Migration

**Files:**

- Create: `supabase/migrations/<timestamp>_schedule_block_planning_targets.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `docs/DATA_MODEL.md`

- [ ] Add `preliminary_target_date date null` to `public.schedule_cycles`.
- [ ] Add `final_publish_target_date date null` to `public.schedule_cycles`.
- [ ] Add comments explaining both are manager target dates, not lifecycle timestamps.
- [ ] Add a lightweight index only if needed by query shape, likely `(site_id, archived_at, start_date)` already covers most reads; do not add indexes speculatively unless profiling or query inspection justifies them.
- [ ] Update Supabase generated TypeScript types.
- [ ] Update `docs/DATA_MODEL.md` to distinguish planning target dates from actual `preliminary_snapshots.created_at` and `publish_events.published_at`.

Acceptance:

- [ ] Migration is reversible or has a matching rollback if this repo convention requires one.
- [ ] New columns are nullable so existing Schedule Blocks remain valid.

---

## Task 2: Pure Planning Helpers

**Files:**

- Create: `src/lib/schedule-block-planning.ts`
- Create: `src/lib/schedule-block-planning.test.ts`

Implement pure helpers before UI:

- [ ] `SCHEDULE_BLOCK_DAY_COUNT = 42`
- [ ] `suggestNextScheduleBlock(existingCycles)`:
  - Finds latest non-archived Schedule Block by `end_date`.
  - Suggests `start_date` as the next Sunday after latest `end_date`.
  - Suggests `end_date` as 41 days after `start_date`.
  - Suggests date-range label by default.
- [ ] `suggestPlanningDates(startDate)`:
  - `availabilityDueDate`: start minus 21 days.
  - `preliminaryTargetDate`: start minus 14 days.
  - `finalPublishTargetDate`: start minus 7 days.
- [ ] `normalizeAvailabilityDueDate(dateKey)`:
  - Accepts a date key from manager UI.
  - Produces the internal end-of-day timestamp used for `availability_due_at`.
  - Matches the existing local-date behavior in `therapist-availability-submission.ts`.
- [ ] `validateScheduleBlockPlanning(input, existingCycles, currentCycleId?)`:
  - Requires Sunday-start 42-day block shape.
  - Rejects overlapping blocks.
  - Requires availability due date before block start when therapist-visible.
  - Enforces `availability due <= preliminary target <= final publish target < block start` when target dates are present.
  - Allows same-day planning targets but returns a compressed-timeline warning.
  - Blocks clearing `availability_due_at` once the block is therapist-visible.
- [ ] `isTherapistVisibleForAvailability(cycle, todayKey)`:
  - Returns true for future or current unfinished, unpublished, unarchived blocks with an explicit due date.
  - Returns false for future blocks missing due date.
- [ ] `sortVisibleAvailabilityCycles(cycles)`:
  - Sorts by explicit availability due date first, then block start date.

Tests:

- [ ] Suggests the next consecutive six-week Sunday-start block.
- [ ] Allows intentional gaps only when the manager chooses valid non-overlapping dates.
- [ ] Rejects overlaps.
- [ ] Rejects due date after block start.
- [ ] Flags compressed same-day milestone timelines.
- [ ] Does not treat missing Preliminary/Final target dates as therapist visibility blockers.
- [ ] Sorts multiple visible future blocks by due date.

---

## Task 3: Server Actions

**Files:**

- Create: `src/app/(app)/schedule/actions/planning-actions.ts`
- Create: `src/app/(app)/schedule/actions/planning-actions.test.ts`
- Modify: `src/app/(app)/schedule/actions/index.ts`

Actions:

- [ ] `createScheduleBlockPlanningAction(formData)`
  - Authenticates user.
  - Requires `manage_schedule` or the same manager permission used by `createCycleAction`.
  - Loads actor `site_id`.
  - Validates date shape, non-overlap, and planning date order with pure helpers.
  - Inserts `schedule_cycles` only on save.
  - Generates default label from the date range unless a custom label is supplied.
  - Stores `availability_due_at`, `preliminary_target_date`, `final_publish_target_date`.
  - Audit logs creation, especially if therapist-visible on save.
  - Sends therapist notification only when the block becomes therapist-visible for the first time.
  - Revalidates `/schedule`, `/schedule/planning`, `/availability`, `/therapist/availability`, `/dashboard/manager`, and `/dashboard/staff`.

- [ ] `updateScheduleBlockPlanningAction(formData)`
  - Authenticates and authorizes manager.
  - Loads existing cycle.
  - Allows planning target edits on draft/future blocks.
  - Allows Schedule Block date-range edits only when there are no dependent availability submissions, shifts, preliminary snapshots, or publish events.
  - Allows replacing visible availability due date but blocks clearing it.
  - Requires confirmation flag when moving visible due date earlier.
  - Audit logs due/preliminary/final target changes.
  - Notifies therapists only when visible due date changes materially.
  - Revalidates the same surfaces as create.

Do not:

- [ ] Do not make these actions send preliminary.
- [ ] Do not make these actions publish final schedule.
- [ ] Do not allow arbitrary lifecycle `status` writes.

Tests:

- [ ] Unauthorized users redirect or fail safely.
- [ ] Manager can create a valid planned block.
- [ ] Suggested block is not inserted until action submit.
- [ ] Overlapping block is rejected.
- [ ] Missing due date keeps a manager draft internal.
- [ ] Visible block due date cannot be cleared.
- [ ] Moving due date earlier requires confirmation.
- [ ] Preliminary/Final target edits do not trigger therapist notifications.
- [ ] Creating first visible block triggers availability-ready notification.

---

## Task 4: `/schedule/planning` Route

**Files:**

- Create: `src/app/(app)/schedule/planning/page.tsx`
- Create or reuse component under `src/components/schedule-block-planning/` if the page gets large.
- Create: `src/app/(app)/schedule/planning/page.test.tsx`

Route behavior:

- [ ] Manager-only; non-managers redirect to staff dashboard or canonical schedule route using existing auth patterns.
- [ ] Load current, future, and recent context for the manager site.
- [ ] Prioritize future Schedule Blocks in groups:
  - Needs planning: missing required due date or missing recommended target dates.
  - Planned: future blocks with planning dates set.
  - Current/recent: read-only context only.
- [ ] Show next suggested block as a preview, not a saved row.
- [ ] Use date-only inputs for all planning dates.
- [ ] Show generated label from date range, with custom label behind a secondary edit affordance if kept.
- [ ] Show warnings:
  - Compressed timeline.
  - Due date moved earlier after visibility.
  - Date range cannot change because dependent data exists.
  - Overlap conflict with link/context to existing block.
- [ ] Show status text for therapist visibility:
  - "Visible to therapists" when future block has due date.
  - "Manager draft" when missing due date.

UX rules:

- [ ] Do not use "cycle" in visible copy.
- [ ] Do not ask managers for times.
- [ ] Do not present Preliminary/Final target dates as action buttons.
- [ ] Do not duplicate Publish History recovery controls here.

---

## Task 5: Navigation

**Files:**

- Modify: `src/components/shell/app-shell-config.ts`
- Modify: `src/components/AppShell.test.ts`

- [ ] Add `/schedule/planning` to manager Schedule route active handling.
- [ ] Add local Schedule subitem:
  - Label: `Planning`
  - Href: `/schedule/planning`
  - Active on `/schedule/planning`
- [ ] Keep Planning out of primary navigation.
- [ ] Add optional local badge count for missing or overdue planning items only if the shell data path already supports it cleanly. Otherwise defer the count and keep dashboard as the main urgency surface.

Tests:

- [ ] Manager Schedule section remains active on `/schedule/planning`.
- [ ] Planning appears under Schedule local nav.
- [ ] Planning does not appear as a primary nav item.

---

## Task 6: Therapist Availability Visibility

**Files:**

- Modify: `src/app/(app)/therapist/availability/page.tsx`
- Modify: `src/lib/therapist-workflow.ts`
- Modify: `src/lib/therapist-workflow.test.ts`
- Modify: `src/lib/therapist-availability-submission.ts`
- Modify: `src/lib/therapist-availability-submission.test.ts`

Behavior:

- [ ] Therapist availability page loads future/current unpublished Schedule Blocks that are therapist-visible.
- [ ] A Schedule Block is therapist-visible when it has explicit `availability_due_at`.
- [ ] Default selected block is the next visible block needing that therapist's response.
- [ ] Later visible future blocks remain selectable.
- [ ] Blocks missing due date do not appear to therapists.
- [ ] Staff dashboard should no longer show "No deadline set" for a future block that should not be visible yet.
- [ ] Existing submitted availability for a block remains accessible according to existing history/current workflow rules; do not lose data if a manager edits dates.

Tests:

- [ ] Missing-due future block is hidden from therapist availability.
- [ ] Multiple future visible blocks are sorted by due date.
- [ ] Default selection picks the next visible block needing response.
- [ ] Later visible future block can be selected by query param.
- [ ] Submitted block remains stable after due date passes.

---

## Task 7: Manager Availability Page

**Files:**

- Modify: `src/app/(app)/availability/page.tsx`
- Modify or extend related tests under `src/app/(app)/availability/`

Behavior:

- [ ] Managers can still see internal future draft blocks, including ones missing due date.
- [ ] Manager availability queue clearly distinguishes:
  - Manager draft, not visible to therapists.
  - Visible to therapists, due on date.
  - Locked/schedule building started.
- [ ] Link missing due-date state to `/schedule/planning`.
- [ ] Do not let Availability become the place where Schedule Blocks are created; creation belongs in Planning.

---

## Task 8: Manager Dashboard Attention

**Files:**

- Modify: `src/app/(app)/dashboard/manager/page.tsx`
- Modify: `src/components/manager/ManagerTriageDashboard.tsx`
- Modify: `src/components/manager/ManagerTriageDashboard.test.tsx`
- Modify or extend `src/lib/manager-inbox.ts`

Replace inferred planning dates where possible:

- [ ] Stop relying only on `getNextCyclePlanningWindow(nextCycle.start_date)` for real planned blocks.
- [ ] Surface attention items:
  - Missing next Schedule Block.
  - Next block missing availability due date.
  - Availability due soon.
  - Availability past due.
  - Preliminary target coming up.
  - Final Publish target coming up.
- [ ] Link each item to where the manager can act:
  - `/schedule/planning` for missing/planning dates.
  - `/availability?cycle=...` for availability collection.
  - `/schedule?cycle=...` for draft/preliminary/final schedule work.
- [ ] Keep dashboard copy concise and operational.

Tests:

- [ ] Missing next block links to `/schedule/planning`.
- [ ] Missing due date links to `/schedule/planning`.
- [ ] Due-soon availability links to `/availability`.
- [ ] Preliminary/Final target links do not pretend the action happens in Planning.

---

## Task 9: Notifications and Audit

**Files:**

- Modify or create helper near existing notification/audit utilities.
- Modify action tests from Task 3.

Notification rules:

- [ ] Notify therapists when a Schedule Block becomes visible for availability for the first time.
- [ ] Notify therapists when a visible availability due date changes materially.
- [ ] Do not notify therapists for manager-only Preliminary target edits.
- [ ] Do not notify therapists for manager-only Final Publish target edits.

Audit rules:

- [ ] Audit creating a therapist-visible Schedule Block.
- [ ] Audit changing a visible availability due date.
- [ ] Audit changing Preliminary target date.
- [ ] Audit changing Final Publish target date.
- [ ] Audit is manager traceability only; it is not a staff notification.

---

## Task 10: Verification

Run focused tests first:

- [ ] `npm run test:unit -- src/lib/schedule-block-planning.test.ts`
- [ ] `npm run test:unit -- "src/app/(app)/schedule/actions/planning-actions.test.ts"`
- [ ] `npm run test:unit -- "src/app/(app)/schedule/planning/page.test.tsx"`
- [ ] `npm run test:unit -- src/lib/therapist-workflow.test.ts src/lib/therapist-availability-submission.test.ts`
- [ ] `npm run test:unit -- src/components/AppShell.test.ts src/components/manager/ManagerTriageDashboard.test.tsx`

Then run repo checks:

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`

Browser validation when local auth/env permits:

- [ ] Manager can open `/schedule/planning`.
- [ ] Suggested next block appears but does not exist in DB until save.
- [ ] Saving with due date makes it visible in therapist availability.
- [ ] Therapist sees next visible block first and can switch to later visible blocks.
- [ ] Manager dashboard links resolve to the right action pages.

---

## Non-Goals

- Do not implement automatic scheduled sending.
- Do not add an availability-open date.
- Do not add a separate therapist visibility toggle.
- Do not move Send Preliminary or Final Publish actions into Planning.
- Do not redesign the full Schedule grid.
- Do not build bulk multi-block creation in the first implementation unless explicitly approved during execution.
