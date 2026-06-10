# Repository Health Snapshot

Date: June 8, 2026
Branch: `main`
Validated commit: `c5ed81f16b2397e07981e52fabe3e6826ccb207f`

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
- `/shift-board` tab parsing is server-safe in production builds.
- Functional demo staff accounts are seeded past onboarding.
- The paper-schedule demo fixture uses the current availability intent values.
- Schedule lead cells display `1` and keep the yellow lead highlight.
- Therapist schedule views may show read-only status labels like `OC`, but do not expose manager/lead assignment-status action controls.
- Full local Chromium E2E is green after aligning the proactive-risk pre-flight summary and role-journey notification expectations with the current UI.

## Architecture Notes

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Schedule mutation APIs are business-critical and should preserve role checks, site scope, trusted-request checks, lifecycle state, notifications, and audit behavior.
- `src/app/api/schedule/drag-drop/route.ts` is high-risk because it changes schedule assignments and audit-sensitive state.
- `src/components/schedule-grid/ScheduleGrid.tsx` is complex; prefer small, tested extractions instead of broad rewrites.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.

## Current Verification

The following commands were run during the June 8, 2026 post-E2E-fix demo readiness sweep:

- Passed: `npm run seed:functional`
- Passed: `npm run format:check`
- Passed: `npm run lint`
- Passed: `npm run typecheck`
- Passed: `npm run test:unit` (`250` parallel test files / `1547` tests, plus `2` browser-backed test files / `5` tests)
- Passed: `npm audit --omit=dev` (`0` vulnerabilities)
- Passed: `npm run build`
- Passed after the full E2E dev server rewrote `.next` into a dev-artifact shape: `npm run build`
- Passed: `npx playwright test --project=chromium --reporter=line`
  - Result: `90` passed, `10` skipped, `0` failed.
  - The previously failing `e2e/coverage-proactive-risk.spec.ts` and `e2e/role-journeys.spec.ts` paths passed.
- Not run separately: `npm run test:e2e`. The repo's configured Playwright project is Chromium, so the direct full Chromium command covered the same project without repeating the 26-minute suite.

Production-mode browser smoke against `http://127.0.0.1:3001` also passed with the configured demo accounts. It checked the public homepage, unauthenticated `/schedule` redirect, manager dashboard, manager `/schedule`, manager `/shift-board`, staff dashboard, staff `/schedule`, and staff `/shift-board`. No browser console errors were captured during that smoke.

The earlier post-fix production schedule spec validated assign, unassign, set lead, assignment-status update, lead cell `1` display, yellow lead highlight, and therapist read-only schedule behavior. A separate configured-manager hand walkthrough did not independently exercise move; use a focused follow-up if the move gesture must be demonstrated live.

## Known Limitations / Risk Notes

- This is still demo-stage unless production deployment, secrets, Supabase project config, cron, webhooks, backups, and UAT are verified.
- Schedule mutation logic remains business-critical and should be changed carefully.
- Seeded E2E coverage depends on Supabase secrets and service-role access.
- Full local Chromium E2E is green as of this snapshot, but that is still demo-readiness evidence, not production approval.
- `npm run seed:demo-schedule` requires `SEED_DEMO_SCHEDULE_PROJECT_REFS` for hosted dev/test Supabase projects and should not be allowlisted for production projects.
- `docs/REPO_HEALTH.md` is a snapshot, not a guarantee.
- Dependency audit results are time-sensitive. Rerun `npm audit --omit=dev` after lockfile or package changes.

## Production Readiness Verification

Run the configuration-shape check before treating an environment as production-ready:

```bash
npm run verify:prod
```

By default, the command runs in local/demo mode and reports missing production integrations as warnings unless a feature is explicitly enabled. To enforce production requirements, run:

```bash
npm run verify:prod -- --production
```

The report checks required Supabase env vars, app URL shape, cron secrets, Resend/OpenAI/publish-worker/Sentry configuration, and whether demo/seed credentials are present. It reports variable names and remediation hints only; it must not print secret values. This check verifies configuration shape, not deployment ownership, webhook delivery, database backups, Supabase RLS policy state, or UAT approval.

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
