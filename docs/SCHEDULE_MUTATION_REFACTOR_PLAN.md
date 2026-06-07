# Schedule Mutation Refactor Plan

## Purpose

This document is a checkpoint and forward plan for gradually reducing risk in schedule mutation code. It captures what has already been stabilized, what still lives in the drag-drop route, and how future Codex runs should continue in small, test-backed slices.

This is not a production certification. It does not prove the scheduling workflow is production-ready, concurrency-safe for every real-world case, or fully validated for production deployment.

## Current Completed Improvements

Recent work improved the schedule mutation path without intentionally changing behavior:

- Typed schedule mutation error codes were added in `src/lib/schedule-mutations/errors.ts`.
- Schedule mutation API responses now include stable `code` fields while preserving existing human-readable messages and statuses.
- `ScheduleGrid` now prefers typed `error.code` handling before the legacy message-string fallback.
- `DragAction` and `parseActionBody` were extracted to `src/lib/schedule-mutations/parse-action-body.ts`.
- Manager authorization and manager site-scope loading were extracted to `src/lib/schedule-mutations/authorize-manager.ts`.
- Focused tests were added or updated for typed error codes, parser behavior, manager authorization, and the drag-drop route.
- Behavior was intentionally preserved during these changes.

## Current Route Responsibilities

`src/app/api/schedule/drag-drop/route.ts` still handles these responsibilities:

- Origin validation.
- Supabase server client creation.
- Manager authorization helper call.
- Request parsing.
- Schedule Block cycle loading and site validation.
- Cycle state and read-only validation.
- Therapist profile validation.
- Availability and work-pattern validation.
- Coverage limit validation.
- Weekly limit validation.
- Assign branch.
- Move branch.
- Remove branch.
- `set_lead` branch.
- Shift-post cleanup.
- Audit logging.
- Preliminary and published schedule notifications.

## Why The Route Remains High Risk

This route protects the core scheduling workflow. A small mistake can create incorrect schedules, allow cross-site mutation, skip important validation, or leave downstream state inconsistent.

The route is still high risk because validation and mutation logic are tightly coupled. It also performs side effects such as audit logging, shift-post cleanup, and preliminary or published notifications. Those side effects must stay consistent with the schedule changes they describe.

The app is still demo-stage unless production deployment, secrets, Supabase project configuration, cron jobs, webhooks, backups, seeded/full E2E, and real-user UAT are verified. Avoid unnecessary broad rewrites until the product need justifies them.

## Recommended Next Extraction Sequence

### A. Extract Cycle Loading And Cycle State Validation

Goal: Move Schedule Block lookup, manager site check, and read-only state checks behind a small helper.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/load-cycle.ts`
- `src/lib/schedule-mutations/load-cycle.test.ts`
- Existing drag-drop route tests only if needed.

Tests to add or update:

- Cycle not found returns the same status, message, and typed code.
- Cycle outside manager site returns the same status, message, and typed code.
- Offline, archived, or archived-at cycles return the same read-only response.
- Successful load returns the same cycle fields currently used by the route.

Risk level: low.

What not to change:

- Do not change cycle query columns.
- Do not change response messages, statuses, or typed codes.
- Do not change preliminary snapshot loading.
- Do not extract mutation branches in this step.

### B. Extract Therapist Profile, Site, Active, FMLA, And Shift-Type Validation

Goal: Move repeated therapist profile validation into a helper that can be reused by assign, move, and `set_lead` paths.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/validate-therapist-profile.ts`
- `src/lib/schedule-mutations/validate-therapist-profile.test.ts`
- Existing drag-drop route tests only if needed.

Tests to add or update:

- Therapist outside manager site returns the same response.
- Shift-type mismatch returns the same response.
- Inactive, archived, or FMLA therapist returns the same response.
- Lead eligibility checks for `set_lead` preserve current behavior.

Risk level: medium.

What not to change:

- Do not merge lead eligibility with general assign eligibility unless tests prove exact behavior.
- Do not change which roles can be designated lead.
- Do not change existing profile query filters or site-scope behavior.

### C. Extract Availability Conflict Validation

Goal: Move availability and work-pattern validation plus availability conflict response construction into a focused helper.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/validate-availability.ts`
- `src/lib/schedule-mutations/validate-availability.test.ts`
- Existing availability resolver tests only if needed.

Tests to add or update:

- Availability read failure returns the same internal error response.
- Inactive/FMLA or PRN-not-offered blocked states return the same unassignable response.
- Availability conflicts return `availability_conflict` with the same availability payload shape.
- Availability override behavior remains unchanged.

Risk level: medium.

What not to change:

- Do not change `resolveEligibility` behavior.
- Do not change force-off, force-on, PRN, inactive, or FMLA semantics.
- Do not remove availability override metadata handling from the mutation branches yet.

### D. Extract Coverage And Weekly Limit Validation

Goal: Move daily coverage and weekly limit checks into shared helpers for assign, move, and `set_lead`.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/validate-limits.ts`
- `src/lib/schedule-mutations/validate-limits.test.ts`
- Existing drag-drop route tests only if needed.

Tests to add or update:

- Daily coverage read failure returns the same internal error response.
- Daily coverage limit exceeded returns the same message and `coverage_limit_exceeded` code.
- Weekly read failure returns the same internal error response.
- Weekly limit exceeded returns the same message and `weekly_limit_exceeded` code.
- Move validation still excludes the moved shift from counts.

Risk level: medium.

What not to change:

- Do not change `MAX_SHIFT_COVERAGE_PER_DAY`.
- Do not change weekly limit calculations.
- Do not change operational status handling in coverage counts.
- Do not change override behavior.

### E. Extract Assign Use Case

Goal: Move the assign branch into a use-case function after its validation helpers are stable.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/assign-shift.ts`
- `src/lib/schedule-mutations/assign-shift.test.ts`
- Existing drag-drop route tests.

Tests to add or update:

- Successful assign returns the same shift and undo payload.
- Duplicate shift returns the same response and typed code.
- Audit logging remains identical.
- Preliminary and published add notifications remain identical.
- Availability override metadata is written exactly as before.

Risk level: high.

What not to change:

- Do not change insert payload shape.
- Do not change undo payload shape.
- Do not change audit action names.
- Do not change notification targets or messages.

### F. Extract Move Use Case

Goal: Move the move branch into a use-case function after shared validation helpers are stable.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/move-shift.ts`
- `src/lib/schedule-mutations/move-shift.test.ts`
- Existing drag-drop route tests.

Tests to add or update:

- Same-slot move still returns the same no-op message.
- Shift not found and outside-site responses are unchanged.
- Duplicate target date returns the same response and typed code.
- Shift-post cleanup still runs for published or active preliminary cycles.
- Source and target post-publish audit behavior remains unchanged.
- Published and preliminary move notifications remain unchanged.

Risk level: high.

What not to change:

- Do not change no-op behavior.
- Do not change update payload shape.
- Do not change audit conditions.
- Do not change cleanup timing.

### G. Extract Remove Use Case

Goal: Move the remove branch into a use-case function.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/remove-shift.ts`
- `src/lib/schedule-mutations/remove-shift.test.ts`
- Existing drag-drop route tests.

Tests to add or update:

- Remove by `shiftId` still works.
- Remove by user/date/shiftType still works.
- Shift not found and outside-site responses are unchanged.
- Shift-post history preservation still runs before deletion.
- Undo payload remains unchanged.
- Audit and notification behavior remains unchanged.

Risk level: high.

What not to change:

- Do not change delete filters.
- Do not change undo payload shape.
- Do not change shift-post cleanup reason text.
- Do not change published or preliminary remove notifications.

### H. Extract `set_lead` Use Case

Goal: Move the designated lead branch into a use-case function.

Likely files touched:

- `src/app/api/schedule/drag-drop/route.ts`
- `src/lib/schedule-mutations/set-lead.ts`
- `src/lib/schedule-mutations/set-lead.test.ts`
- Existing `setDesignatedLeadMutation` tests only if needed.
- Existing drag-drop route tests.

Tests to add or update:

- Lead eligibility failures return the same response and typed code.
- Existing shift and new lead shift paths behave the same.
- Multiple-lead prevention response remains unchanged.
- Availability override metadata is still recorded.
- Audit logging, cleanup, and add notifications remain unchanged.

Risk level: high.

What not to change:

- Do not replace `setDesignatedLeadMutation`.
- Do not change multiple-lead prevention behavior.
- Do not change how a missing existing shift is handled.
- Do not change designated lead audit target IDs.

### I. Later Only: Transaction, RPC, Or Outbox Hardening

Goal: Consider stronger consistency guarantees only if production or real multi-manager editing creates a concrete need.

Likely files touched:

- Supabase migrations.
- RPC functions.
- Schedule mutation route and helper modules.
- Notification or outbox processing code.
- E2E and integration test setup.

Tests to add or update:

- Seeded E2E for concurrent manager edits.
- Database-level tests or migration verification where practical.
- Notification/outbox delivery tests.
- Regression tests for audit and cleanup ordering.

Risk level: high.

What not to change:

- Do not attempt this in a refactor-only task.
- Do not change schema without explicit requirements.
- Do not add an outbox or RPC layer just because the route is large.
- Do not claim production concurrency safety without real verification.

## Do Not Do Yet

- Do not broadly rewrite `src/app/api/schedule/drag-drop/route.ts`.
- Do not change business behavior without explicit tests.
- Do not change database schema in a refactor-only task.
- Do not add dependencies.
- Do not remove the legacy string fallback in `ScheduleGrid` error handling until all callers are confirmed to return typed codes.
- Do not attempt transaction, RPC, or outbox migration until demo needs justify it.

## Suggested Next Prompt

```text
Extract cycle loading and cycle state validation from drag-drop/route.ts without changing behavior.
```
