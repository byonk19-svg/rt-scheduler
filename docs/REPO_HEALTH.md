# Repository Health Snapshot

Date: June 6, 2026
Branch: `main`
Commit: `a3c0407214cba2fd1934b02b2eb6d1545b724aad`

This file is a point-in-time snapshot for future maintainers and Codex runs. It is not a guarantee that every workflow is production-ready.

## Current Shape

RT Scheduler is a single-package Next.js App Router app written in TypeScript. Supabase backs authentication, database access, RLS-sensitive server reads and writes, and seeded test workflows.

The core scheduling surface is `/schedule`. It serves the live shared schedule grid for managers, leads, therapists, and staff-facing schedule views. Manager workflows also include availability collection, team management, approvals, publish history, shift board, and schedule planning.

Recent stabilization work on `main` includes:

- CI now runs `npm audit --omit=dev`.
- CI now has a separate `Unit Tests` job that runs `npm run test:unit`.
- CI E2E now waits for quality, unit, and security regression jobs.
- A small cleanup removed an unreachable published-schedule filter branch.
- A small cleanup removed an unused auth context field without changing permission behavior.

## Architecture Notes

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Schedule mutation APIs are business-critical and should preserve role checks, site scope, trusted-request checks, lifecycle state, notifications, and audit behavior.
- `src/app/api/schedule/drag-drop/route.ts` is high-risk because it changes schedule assignments and audit-sensitive state.
- `src/components/schedule-grid/ScheduleGrid.tsx` is complex; prefer small, tested extractions instead of broad rewrites.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.

## Current Verification

The following commands were run for this snapshot:

- Passed: `npm run format:check`
- Passed: `npm run lint`
- Passed: `npm run typecheck`
- Passed: `npm run test:unit` (`242` parallel test files / `1482` tests, plus `2` browser-backed test files / `5` tests)
- Passed: `npm audit --omit=dev` (`0` vulnerabilities)
- Passed: `npm run build`

Local Playwright E2E was not run for this docs-only update. Seeded E2E requires the appropriate Supabase/test environment.

## Known Limitations / Risk Notes

- This is still demo-stage unless production deployment, secrets, Supabase project config, cron, webhooks, backups, and UAT are verified.
- Schedule mutation logic remains business-critical and should be changed carefully.
- Seeded E2E coverage depends on Supabase secrets and service-role access.
- `docs/REPO_HEALTH.md` is a snapshot, not a guarantee.
- Dependency audit results are time-sensitive. Rerun `npm audit --omit=dev` after lockfile or package changes.

## Demo Validation Flow

Use this sequence when preparing a local demo from a fresh checkout:

1. `npm install`
2. `npm run format:check`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run test:unit`
6. `npm audit --omit=dev`
7. `npm run build`
8. `npm run start:prod:local`
9. Manually validate the app in a browser at `http://127.0.0.1:3001`.

Seeded or production-like validation needs the correct Supabase environment variables and test data. Do not treat a local demo pass as production approval.
