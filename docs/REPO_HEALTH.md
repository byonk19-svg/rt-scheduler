# Repository Health Snapshot (April 8, 2026)

## Current Shape

- Monorepo-style Next.js app (single app package) with App Router and TypeScript.
- Supabase-backed auth + data model with manager/therapist role workflows.
- Core manager surfaces: coverage, availability, team, approvals, publish, shift board.
- Core therapist surfaces: schedule (`/coverage`), availability grid (`/therapist/availability`: full-cycle **Available / Need Off / Request to Work** grid, **Selected Day** inline editor under the active week row, **Day Notes** review list at bottom), swaps.

## Architecture Highlights

- Planning data (`shifts`) is intentionally separated from live operational state (`shift_operational_entries` and related operational code tables).
- Scheduling mutation APIs enforce role checks and trusted-request origin checks.
- Manager workflow logic is centralized in `src/lib/manager-workflow.ts`.
- Coverage assignment behavior is centralized in `src/lib/coverage/*` with server mutation endpoints in `src/app/api/schedule/*`.
- Shared cycle-selection behavior is centralized in `src/lib/coverage/active-cycle.ts` and now drives Coverage, manager workflow, and shift board surfaces.
- `src/lib/coverage/fetch-schedule-cycles.ts` loads cycles for Coverage (and related) with a fallback when `schedule_cycles.archived_at` is missing or PostgREST schema cache is stale.
- Therapist availability is a full-cycle workflow: day-level state lives in `availability_overrides`; **official** submitted/not-submitted for a cycle lives in `therapist_availability_submissions` (not inferred from overrides alone). `Request to Work` → therapist `force_on`, `Need Off` → therapist `force_off`, `Available` = neutral.
- **Publish History** (`/publish`) lists **schedule blocks** (all non-archived cycles) separately from the **publish email log** (`publish_events`); see `CLAUDE.md` workflow section.
- Active scheduling surfaces no longer fall back to a synthetic or stale "latest cycle" window when no current/upcoming block exists.
- Designated-lead role guards in app code and SQL mutation eligibility now both accept `therapist` and `lead` roles (with `is_lead_eligible=true` still required).

## Quality Status

Last verified on branch `main`:

- `npm run lint` passed
- `npx tsc --noEmit` passed
- `npm run test:unit` passed (`424` tests) — re-run after pulls; count drifts with new tests
- `npx playwright test --workers=1` passed for active suites (`23` passed, `1` skipped) — re-verify after major route changes

## Known Exceptions / Gaps

- `e2e/directory-date-override.spec.ts` was removed.
- Reason: current `/directory` route renders the team-management UI surface, so the legacy directory override interaction path covered by that suite is no longer executable as written.
- If date-override UX is reintroduced, rebuild E2E coverage against current route ownership and UI contracts.

## Risk Notes

- E2E tests use a live app server and Supabase-seeded data; timing and environment isolation are the primary reliability risk.
- Parallel Playwright workers can intermittently trigger seeded-user FK race conditions in manager planner E2E setup; serial execution (`--workers=1`) is currently the stable verification lane.
- Mutation trust boundaries depend on origin/referer checks; local loopback alias handling (`localhost`, `127.0.0.1`, `[::1]`) is now normalized and should remain covered by tests.

## Suggested Next Maintenance Steps

1. Decide whether date-override belongs in `/directory`, `/team`, or another dedicated manager surface.
2. Keep route-level manager/staff scoping behavior covered in live `/shift-board` tests as the page evolves.
3. Keep PRD/workflow docs in `docs/superpowers/plans/` aligned with actual route ownership as UI surfaces evolve.
