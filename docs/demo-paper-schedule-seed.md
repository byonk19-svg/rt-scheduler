# May-Jun 2026 Paper Schedule Demo Seed

This seed creates a safe, repeatable local/demo dataset modeled from the photographed Respiratory Therapy paper schedule labeled `May 3, 2026 - June 13, 2026`.

The app does not currently have a `departments` table, so the demo department is represented with the existing `site_id` value `paper-rt-demo` on profiles, shifts, templates, and the schedule cycle.

## What It Creates

- Demo site/department boundary: `paper-rt-demo`
- Published schedule cycle: `RT Paper Demo May 3-Jun 13 2026`
- Cycle dates: `2026-05-03` through `2026-06-13`
- Demo manager login:
  - `paper-demo-manager@paper-demo.teamwise.test`
  - password: `Teamwise123!`
- Demo therapist users:
  - `paper-demo-adrienne@paper-demo.teamwise.test`
  - `paper-demo-kim@paper-demo.teamwise.test`
  - `paper-demo-brianna@paper-demo.teamwise.test`
  - `paper-demo-barbara@paper-demo.teamwise.test`
  - `paper-demo-layne@paper-demo.teamwise.test`
  - `paper-demo-tannie@paper-demo.teamwise.test`
  - `paper-demo-aleyce@paper-demo.teamwise.test`
  - `paper-demo-lynn@paper-demo.teamwise.test`
  - `paper-demo-lisa-m@paper-demo.teamwise.test`
  - `paper-demo-irene@paper-demo.teamwise.test`
- `profiles`, `work_patterns`, and `employee_roster` rows for those users
- `shifts` rows for `1`, highlighted `1`, and `N` cells
- `availability_overrides`, `availability_requests`, and `availability_entries` for `*` and `N` cells
- `therapist_availability_submissions` for the paper schedule block
- A `cycle_templates` row containing the paper schedule staffing-count targets for sanity checking

## How To Run

Use a local Supabase stack or an explicitly allowlisted dev/test project:

```bash
npm run seed:demo-schedule
```

Hosted Supabase projects are refused unless their project ref is listed in `SEED_DEMO_SCHEDULE_PROJECT_REFS`.
Do not add a production project ref to that allowlist.

## Reset And Re-Run

The seed is repeatable. Re-running it:

- updates the demo Auth users by stable email
- upserts the demo profiles, roster rows, work patterns, and schedule cycle
- replaces only the rows scoped to the deterministic demo cycle
- does not delete unrelated schedules, shifts, profiles, or Auth users

To reset local E2E/demo data more broadly, use the existing guarded reset scripts:

```bash
npm run reset:e2e
```

`reset:e2e:fresh-auth` is the only reset path that deletes demo Auth users, and it is scoped to test/demo users.

## Fixture Notes

The readable fixture lives in `scripts/fixtures/demo-paper-schedule.mjs`.

Tokens:

- `1` means scheduled/working
- `H` means highlighted/confirmed working cell from the paper schedule
- `*` means unavailable / need-off / PTO-style marker
- `N` means night-specific marker
- `.` means blank cell

The script prints non-failing staffing-count mismatches against the paper subtotal rows. If a cell was misread from the photo, adjust the fixture directly and rerun `npm run seed:demo-schedule`.
