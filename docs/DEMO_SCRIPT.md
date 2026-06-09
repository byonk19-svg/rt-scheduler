# Teamwise Demo Script

Use this script for a controlled local demo after running the validation checklist. It is a walkthrough guide, not production certification.

Current validated checkpoint:

- Commit: `0401187d Record final demo readiness after E2E fixes`
- Full Chromium Playwright: `90` passed, `10` skipped, `0` failed
- Production-mode manager and staff smoke passed locally
- Schedule mutation refactor lane remains paused

## Before the Demo

Run the demo from seeded test data only. Do not use real staff records, real secrets, or production Supabase data.

Recommended prep:

```bash
npm run seed:functional
npm run build
npm run start:prod:local
```

Open:

```text
http://127.0.0.1:3001
```

Demo accounts from the functional seed:

- Manager: `julie.d@teamwise.test` / `Teamwise123!`
- Staff: `layne@teamwise.test` / `Teamwise123!`

## Opening

1. Start on the public homepage.
2. Explain that Teamwise helps respiratory therapy teams collect availability, build schedule blocks, manage shift requests, and keep staff on one shared schedule surface.
3. State the boundary clearly: this is demo-ready locally, not production-certified.

## Manager Walkthrough

1. Sign in as the manager.
2. Open the manager dashboard.
3. Open `/schedule`.
4. Show that `/schedule` is the canonical live schedule surface.
5. Switch between Day and Night.
6. Change the selected schedule block.
7. Show the draft block and the staffing grid.
8. Demonstrate or describe:
   - assign therapist
   - unassign therapist
   - designate lead
   - lead cells display `1` with yellow highlighting
9. Open `/availability`.
10. Show manager visibility into staff availability submissions.
11. Open `/requests`.
12. Show request workflow entry points.
13. Open `/shift-board`.
14. Show open coverage requests, waiting requests, and history at a high level.

Keep the manager path focused on scheduling confidence. Avoid diving into implementation details unless asked.

## Staff Walkthrough

1. Sign out, then sign in as the seeded staff account.
2. Confirm staff lands in the staff app, not onboarding.
3. Open the staff dashboard.
4. Open `/schedule`.
5. Show that staff can read the same schedule surface without manager-only mutation controls.
6. Open `/therapist/availability`.
7. Show availability entry at a high level.
8. Open `/requests` or `/requests/new`.
9. Show how a staff member starts a shift request.
10. Open `/shift-board`.
11. Show that staff can view relevant request status without manager review controls.
12. Open `/profile`.

## Close

Summarize the validated state:

- Quality checks are green.
- Unit tests are green.
- Dependency audit has `0` vulnerabilities at the checkpoint.
- Full Chromium E2E is green.
- Production-mode manager and staff smoke passed.

Then restate the caveat:

Teamwise is ready for a controlled local demo, but production deployment, secrets, Supabase project config, RLS, cron, webhooks, backups, and real-user UAT still need separate production validation.
