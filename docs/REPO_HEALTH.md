# Repository Health Snapshot (April 21, 2026)

## Current Shape

- Single-package Next.js App Router app with TypeScript.
- Supabase-backed auth/data model with manager, lead, therapist, and pending-access flows.
- Core manager surfaces: coverage, availability, team, approvals, publish, shift board.
- Core therapist surfaces: shared schedule on `/coverage`, therapist availability grid, swaps.
- Major workflow shells are now largely composition-first after the refactor pass; the remaining larger files are mostly isolated domain widgets instead of mixed-responsibility route shells.

## Architecture Highlights

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Scheduling mutation APIs enforce both role checks and trusted-request origin checks.
- Coverage mutations live under `src/app/api/schedule/*` with shared logic in `src/lib/coverage/*`.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.
- Publish history (`/publish`) remains distinct from schedule-cycle state.
- Coverage post-publish audit logging is now derived server-side from slot state instead of client request flags.

## Quality Status

Last verified on branch `codex/clarify-manager-workflow-labels`:

- `npm run lint` passed with warnings only
- `npm run build` passed
- `npm run test:unit` passed (`171` files / `918` tests)
- targeted Playwright browser verification passed for:
  - `e2e/manager-availability-planner.spec.ts`
  - `e2e/therapist-schedule-trust-smoke.spec.ts`
  - `e2e/team-quick-edit.spec.ts`
  - `e2e/coverage-manager-live-smoke.spec.ts`

## Known Exceptions / Gaps

- `e2e/directory-date-override.spec.ts` remains intentionally removed because `/directory` is now a redirect to the team-management surface.
- The long `e2e/role-journeys.spec.ts` chain was repaired substantially, but a final clean rerun is still vulnerable to external Supabase/network instability over the full multi-minute sequence.
- Repo-wide lint still reports unused-symbol warnings in several files. They are maintenance debt, not current verification blockers.

## Risk Notes

- E2E tests depend on a live app server and seeded Supabase state; timing and environment isolation remain the main reliability risk.
- Local `next dev` is stable at Playwright `workers=2`; higher parallelism has caused false negatives on this machine.
- Mutation trust boundaries depend on origin/referer checks; loopback alias handling (`localhost`, `127.0.0.1`, `[::1]`) should stay covered by tests.
- If `src/app/api/schedule/drag-drop/route.ts` changes again, preserve the regression tests that prove clients cannot force or suppress post-publish audit logging.

## Suggested Next Maintenance Steps

1. Run production UAT for `/coverage`, `/availability`, `/team`, `/requests`, `/publish`, and `/shift-board` against a real cycle now that the local baseline is green.
2. Burn down repo-wide lint warnings so verification output is less noisy.
3. Keep route ownership and workflow docs aligned as manager/staff workflow surfaces evolve.
