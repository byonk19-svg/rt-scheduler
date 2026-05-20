# Repository Health Snapshot (May 20, 2026)

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

Last verified on branch `codex/schedule-block-planning`:

- `npm audit --omit=dev` passed (`0` vulnerabilities)
- `npm run format:check` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e -- e2e/auth-redirect.spec.ts e2e/public-pages.spec.ts` passed (`9` tests)
- `npm run test:e2e -- e2e/schedule-block-planning.spec.ts` passed (`1` seeded schedule smoke)

Dependency security refresh:

- `next`, `@next/env`, and `eslint-config-next` are on `16.2.6`.
- `@sentry/nextjs` is on `10.53.1`.
- `@supabase/supabase-js` is on `2.106.1`.
- A targeted `fast-uri` `3.1.2` override resolves the remaining transitive production advisory.

## Known Exceptions / Gaps

- `e2e/directory-date-override.spec.ts` remains intentionally removed because `/directory` is now a redirect to the team-management surface.
- Unified Schedule grid has focused authenticated browser coverage in `e2e/manager-schedule-roster.spec.ts` for manager redirects, draft assign/unassign, lead designation, published status updates, and therapist read-only pinned rows.

## Risk Notes

- E2E tests depend on a live app server; seeded suites also depend on Supabase service-role env.
- Playwright now starts through `scripts/playwright-web-server.mjs`, which cleans generated artifacts and refuses to reuse an already-running server unless `PLAYWRIGHT_REUSE_EXISTING_SERVER=1` is set.
- Mutation trust boundaries depend on origin/referer checks; loopback alias handling (`localhost`, `127.0.0.1`, `[::1]`) should stay covered by tests.
- If `src/app/api/schedule/drag-drop/route.ts` changes again, preserve the regression tests that prove clients cannot force or suppress post-publish audit logging.

## Suggested Next Maintenance Steps

1. Keep route ownership and workflow docs aligned as manager surfaces evolve.
2. Preserve dependency hygiene on the Next.js patch line; rerun `npm audit --omit=dev` after lockfile updates.
3. Run broader seeded E2E coverage before claiming full workflow coverage.
