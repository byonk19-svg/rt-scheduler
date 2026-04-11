# Repository Health Snapshot (April 11, 2026)

## Current Shape

- Single-package Next.js App Router app with TypeScript.
- Supabase-backed auth/data model with manager, lead, therapist, and pending-access flows.
- Core manager surfaces: coverage, availability, team, approvals, publish, shift board.
- Core therapist surfaces: shared schedule on `/coverage`, therapist availability grid, swaps.

## Architecture Highlights

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Scheduling mutation APIs enforce both role checks and trusted-request origin checks.
- Coverage mutations live under `src/app/api/schedule/*` with shared logic in `src/lib/coverage/*`.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.
- Publish history (`/publish`) remains distinct from schedule-cycle state.
- Coverage post-publish audit logging is now derived server-side from slot state instead of client request flags.

## Quality Status

Last verified on branch `main`:

- `npm run lint` passed
- `npx tsc --noEmit` passed
- `npm run build` passed
- targeted Vitest lanes passed:
  - `src/app/availability/actions.test.ts`
  - `src/app/api/schedule/drag-drop/route.test.ts`
  - `src/lib/coverage/mutations.test.ts`
- `npm run test:e2e` previously passed (`42` passed) with the checked-in Playwright worker count set to `2`
- `npm audit --omit=dev` passed with `0` vulnerabilities after the lockfile bump to `next@16.2.3`

## Known Exceptions / Gaps

- `e2e/directory-date-override.spec.ts` remains intentionally removed because `/directory` is now a redirect to the team-management surface.
- Authenticated manager browser verification for the latest coverage mutation changes was not rerun end-to-end in this session; the trust-boundary behavior is covered by route/unit tests plus unauthenticated browser smoke.

## Risk Notes

- E2E tests depend on a live app server and seeded Supabase state; timing and environment isolation remain the main reliability risk.
- Local `next dev` is stable at Playwright `workers=2`; higher parallelism has caused false negatives on this machine.
- Mutation trust boundaries depend on origin/referer checks; loopback alias handling (`localhost`, `127.0.0.1`, `[::1]`) should stay covered by tests.
- If `src/app/api/schedule/drag-drop/route.ts` changes again, preserve the regression tests that prove clients cannot force or suppress post-publish audit logging.

## Suggested Next Maintenance Steps

1. Run an authenticated manager Playwright smoke around coverage assign/unassign and status-change flows.
2. Keep route ownership and workflow docs aligned as manager surfaces evolve.
3. Preserve dependency hygiene on the Next.js patch line; rerun `npm audit --omit=dev` after lockfile updates.
