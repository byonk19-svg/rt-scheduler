# 2026-03-31 Directory-to-Team E2E Replacement Plan

## Objective

Replace legacy `e2e/directory-date-override.spec.ts` coverage with route-accurate E2E tests aligned to the current product surface:

- `/directory` is now a redirect-only route.
- team member management is owned by `/team`.
- manager date planning lives under `/availability` manager planner.
- coverage override behavior lives under `/coverage` assignment flows.

## Current Reality

- `src/app/directory/page.tsx` redirects to `/team`.
- `e2e/directory-date-override.spec.ts` exercises removed UI contracts (table rows, override form in directory drawer).
- Existing active suites already cover part of replacement behavior:
  - `e2e/team-quick-edit.spec.ts`
  - `e2e/manager-availability-planner.spec.ts`
  - `e2e/availability-override.spec.ts`

## Legacy-to-Replacement Mapping

1. Add/delete date override in directory drawer  
   Replacement: planner save/delete behavior via `/availability` manager planner state assertions.

2. Inline override-delete error handling  
   Replacement: planner validation and persistence failure paths (new negative cases in planner suite).

3. "Enter availability" quick action from missing availability list  
   Replacement: N/A in current `/team` surface. Retire.

4. Directory search/filter tests (search, employment, lead-only)  
   Replacement: N/A in current `/team` surface. Retire or reintroduce only if filters are added to `/team`.

5. Drawer tab navigation (Profile/Scheduling/Overrides)  
   Replacement: quick-edit modal sections + access panel behavior in `/team`.

6. Copy shifts / save+realign in directory overrides tab  
   Replacement: save/archive-driven shift realignment coverage in `/team` action tests and E2E.

7. Deactivate/reactivate lifecycle  
   Replacement: `/team` quick-edit active toggle + inactive-section behavior + archive flow.

## Replacement Spec Set

## 1) `e2e/directory-redirect.spec.ts` (new)

- `GET /directory` as authenticated manager redirects to `/team`.
- Unauthenticated access still follows auth redirect behavior (if not already fully covered elsewhere).

## 2) `e2e/team-roster-structure.spec.ts` (new)

- Roster sections render for managers, day shift, night shift, inactive.
- Team member card metadata reflects role/shift/employment/FMLA badges.
- `?edit_profile=<id>` opens quick edit dialog for deterministic deep-link testing.

## 3) `e2e/team-quick-edit.spec.ts` (expand existing)

Add focused cases:

- Role change updates access checklist semantics for active users.
- Inactive users show inactive access notice (and hide access checklist copy).
- Archive requires inactive precondition (assert server rejection path via URL `error=archive_requires_inactive`).
- Save changes with `on_fmla=false` clears return date in DB.
- Save as manager/lead triggers realignment of future draft shifts (DB assertion already partly covered; split into explicit case).

## 4) `e2e/manager-availability-planner.spec.ts` (expand existing)

Add/clarify cases:

- Persist `will_work` and `cannot_work` dates via DB assertions only (no fragile query-param coupling).
- Delete/remove mode behavior validated via `availability_overrides` row transitions.
- Failure copy/validation behavior if server action rejects malformed planner submission (if form allows path).

## 5) `e2e/availability-override.spec.ts` (retain)

- Keep as authoritative manager override-on-assignment behavior coverage for `/coverage`.

## Proposed Retirement

Retire `e2e/directory-date-override.spec.ts` permanently unless a dedicated directory UI returns.

Rationale:

- Current route ownership changed.
- Keeping this file as a skipped legacy suite creates noise and false debt.

## Data/Fixture Strategy

Reduce repeated E2E boilerplate by introducing shared helpers under `e2e/helpers/`:

- `env.ts`: `.env.local` loading
- `supabase.ts`: service-role client and create/delete user helpers
- `auth.ts`: login helper with normalized dashboard URL assertion
- `cycles.ts`: cycle factory utilities

This keeps per-spec setup small and lowers copy/paste drift.

## Reliability Rules

- Prefer DB polling assertions (`expect.poll`) for persistence checks over transient toast/query-string assertions.
- Use route-stable selectors (role+label or explicit test ids).
- Avoid relying on optional UI subsections that appear only when seeded data happens to match.
- Keep serial suites only where shared seeded state is required.

## Execution Order

1. Add redirect spec for `/directory` and verify.
2. Expand `/team` quick-edit coverage with precondition/error cases.
3. Expand planner persistence/removal coverage on `/availability`.
4. Extract shared E2E helpers and migrate touched specs.
5. Remove legacy `directory-date-override` suite.
6. Run full `npm run test:e2e`.

## Done Criteria

- No skipped tests representing removed `/directory` contracts.
- New specs capture equivalent business intent on current route ownership.
- Full E2E run green for active suites.
- Docs updated (`docs/REPO_HEALTH.md`) to reflect replacement completion.
