# Repository Health Snapshot (May 13, 2026)

## Current Shape

- Single-package Next.js App Router app with TypeScript.
- Supabase-backed auth/data model with manager, lead, therapist, and pending-access flows.
- Core manager surfaces: unified Schedule grid, availability, team, approvals, publish, shift board.
- Core therapist surfaces: read-only shared schedule on `/schedule`, therapist availability grid, swaps.

## Architecture Highlights

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Scheduling mutation APIs enforce both role checks and trusted-request origin checks.
- Schedule mutations live under `src/app/api/schedule/*` with shared legacy coverage-domain logic in `src/lib/coverage/*`.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.
- Publish history (`/publish`) remains distinct from schedule-cycle state.
- Schedule post-publish audit logging is derived server-side from slot state instead of client request flags.

## Quality Status

Last verified on branch `codex/verify-ui-visibility`:

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:unit` passed (`1112` tests across `212` files)
- `npm run test:e2e` previously passed (`42` passed) with the checked-in Playwright worker count set to `2`
- `npm audit --omit=dev` previously passed with `0` vulnerabilities after the lockfile bump; current local build reports `next@16.2.4`

## Known Exceptions / Gaps

- `e2e/directory-date-override.spec.ts` remains intentionally removed because `/directory` is now a redirect to the team-management surface.
- Authenticated browser verification for the unified Schedule grid still depends on fresh local Supabase auth state; route/unit tests and unauthenticated protected-route smoke cover the current code path.

## Risk Notes

- E2E tests depend on a live app server and seeded Supabase state; timing and environment isolation remain the main reliability risk.
- Local `next dev` is stable at Playwright `workers=2`; higher parallelism has caused false negatives on this machine.
- Mutation trust boundaries depend on origin/referer checks; loopback alias handling (`localhost`, `127.0.0.1`, `[::1]`) should stay covered by tests.
- If `src/app/api/schedule/drag-drop/route.ts` changes again, preserve the regression tests that prove clients cannot force or suppress post-publish audit logging.

## Suggested Next Maintenance Steps

1. Run an authenticated manager Playwright smoke around Schedule assign/unassign and status-change flows.
2. Keep route ownership and workflow docs aligned as manager surfaces evolve.
3. Preserve dependency hygiene on the Next.js patch line; rerun `npm audit --omit=dev` after lockfile updates.
