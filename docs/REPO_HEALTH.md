# Repository Health Snapshot

Date: June 8, 2026
Branch: `main`
Validated commit: `07e7e73e66bdcdc740a05f9e1db40f47f5e605e4`

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

## Architecture Notes

- Planning data in `shifts` is intentionally separate from live operational state in `shift_operational_entries`.
- Schedule mutation APIs are business-critical and should preserve role checks, site scope, trusted-request checks, lifecycle state, notifications, and audit behavior.
- `src/app/api/schedule/drag-drop/route.ts` is high-risk because it changes schedule assignments and audit-sensitive state.
- `src/components/schedule-grid/ScheduleGrid.tsx` is complex; prefer small, tested extractions instead of broad rewrites.
- Therapist availability submission state is explicit in `therapist_availability_submissions`, not inferred from override rows alone.

## Current Verification

The following commands were run during the June 8, 2026 post-fix demo sweep:

- Passed: `npm run format:check`
- Passed: `npm run lint`
- Passed: `npm run typecheck`
- Passed: `npm run test:unit` (`250` parallel test files / `1547` tests, plus `2` browser-backed test files / `5` tests)
- Passed: `npm audit --omit=dev` (`0` vulnerabilities)
- Passed: `npm run build`
- Passed after removing stale generated `.next` output: `npm run build`
- Passed: `npm run seed:functional`
- Blocked by its hosted-project safety gate: `npm run seed:demo-schedule`
- Passed in production mode against `http://127.0.0.1:3001`: `npx playwright test e2e/manager-schedule-roster.spec.ts --project=chromium --reporter=line`
- Full Chromium Playwright was run: `npx playwright test --project=chromium --reporter=line`
  - Result: `80` passed, `10` skipped, `8` did not run, `2` failed.
  - Failed: `e2e/coverage-proactive-risk.spec.ts` did not find the pre-flight summary text after auto-draft.
  - Failed: `e2e/role-journeys.spec.ts` did not find the therapist notification text `Published schedule updated`.

Production-mode browser smoke with configured demo accounts also passed for public homepage, unauthenticated `/schedule` redirect, manager dashboard, `/team`, `/schedule`, cycle picker, day/night controls, `/availability`, `/requests`, `/profile`, manager `/shift-board`, staff `/dashboard/staff`, `/therapist/availability`, `/requests/new`, `/profile`, staff `/shift-board`, and staff `/schedule`. The staff schedule check confirmed manager-only mutation controls, including `On call`, were not present. A fast navigation smoke initially produced one aborted-fetch console error on `/requests/new`; a focused `/requests/new` production check with settle time returned `200` and captured zero console errors.

The focused production schedule spec validated assign, unassign, set lead, assignment-status update, lead cell `1` display, yellow lead highlight, and therapist read-only schedule behavior. A separate configured-manager hand walkthrough did not independently exercise move; use a focused follow-up if the move gesture must be demonstrated live.

## Known Limitations / Risk Notes

- This is still demo-stage unless production deployment, secrets, Supabase project config, cron, webhooks, backups, and UAT are verified.
- Schedule mutation logic remains business-critical and should be changed carefully.
- Seeded E2E coverage depends on Supabase secrets and service-role access.
- The full local Chromium E2E suite is not green as of this snapshot; triage the two failing specs before claiming complete E2E confidence.
- `npm run seed:demo-schedule` requires `SEED_DEMO_SCHEDULE_PROJECT_REFS` for hosted dev/test Supabase projects and should not be allowlisted for production projects.
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
