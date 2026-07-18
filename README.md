# RT Scheduler

Web app for respiratory therapy scheduling with role-based workflows:

- Auth + role-aware dashboard with pending-access approval plus required first-run staff onboarding
- Availability requests
- 6-week schedule cycle management
- **Canonical staff schedule:** [`/schedule`](<./src/app/(app)/schedule/page.tsx>) is the single live schedule surface. Managers edit the row-by-date grid inline; leads can update published assignment status; therapists see the same grid read-only with their own row pinned at the top.
- **Schedule compatibility:** [`/coverage`](<./src/app/(app)/coverage/page.tsx>), `/staff/schedule`, `/staff/my-schedule`, and `/therapist/schedule` redirect to `/schedule` while preserving query context for old bookmarks and action redirects.
- **Unified grid:** [`src/components/schedule-grid`](./src/components/schedule-grid) renders cycle selection, Draft/Published state, Day/Night switching, totals, needs-off markers, assign/status popovers, and print entrypoints.
- **Therapist availability:** 6-week grid on `/therapist/availability` — **Available** (default: neutral day, no forced on/off), **Unavailable**, **Must work** (hard autodraft `force_on`). When a therapist marks **Need Off** on a date that already has an active-cycle scheduled shift, the page shows a warning banner but still allows saving; see [`CLAUDE.md`](./CLAUDE.md)
- Shift board (swap/pickup posts with manager approval)

## Auth + Access Model

- Public homepage (`/`) is therapist-first marketing: luminous background, trust-forward copy, product preview frame, and clear CTAs — **Get started** + **Sign in** in the header, **Sign in** + **Request access** in the hero (Vitest contracts in `src/app/page.test.ts`).
- Therapists request access via `/signup` (first/last name, optional phone, email, password).
- Managers are **not** created via public signup; they are provisioned admin-side.
- After a successful request, users are redirected to `/login?status=requested` (no automatic session). The public signup flow now always uses that generic redirect rather than disclosing whether the submitted name matched an internal roster row. Server-side roster auto-match can still provision role/settings immediately for matched users; unmatched signups stay pending (`profiles.role = null`) until manager approval.
- Pending users can authenticate but are gated away from app workflows until manager approval.
- Manager approves pending users in `Requests -> User Access Requests` and assigns role at approval time (`therapist` or `lead`).
- Newly approved or roster-matched therapists and leads are then routed through `/onboarding` before entering the normal app. Required first-run steps are normal schedule, schedule preferences, and notifications/appearance; `Future Availability` is recommended but non-blocking.
- Declining an access request deletes the pending account.

Current architecture and quality snapshot: [`docs/REPO_HEALTH.md`](docs/REPO_HEALTH.md)

Demo readiness checklist: [`docs/DEMO_CHECKLIST.md`](docs/DEMO_CHECKLIST.md)

Controlled demo script: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

## Cycle Workflow

- [`/schedule`](<./src/app/(app)/schedule/page.tsx>) is the live schedule grid for all roles. It uses [`schedule-grid-data.ts`](<./src/app/(app)/schedule/schedule-grid-data.ts>) to load cycles, shifts, force-off markers, operational status, pre-flight data, and role permissions.

- **Team Schedule** (manager nav label; route [`/schedule`](<./src/app/(app)/schedule/page.tsx>), rendered via [`ScheduleGrid`](./src/components/schedule-grid/ScheduleGrid.tsx)) - create and staff 6-week blocks, auto-draft, pre-flight, inline assign/unassign, designate lead, update published assignment status, print, and publish. Same cycle-selection rule everywhere: URL cycle if valid, else draft, else published, else none (empty state, not a fake grid).
- **My Shifts** (staff nav label; route [`/schedule`](<./src/app/(app)/schedule/page.tsx>)) - read-only staff entry point for the same Schedule Block context, with the therapist row highlighted and preliminary/final state labels kept visible.
- Auto-draft now opens a pre-flight report first, summarizing likely unfilled slots, missing leads, and forced must-work misses using the real current shift set for that cycle.
- Managers edit staffing by clicking grid cells. Leads can update published assignment status (`OC`, `LE`, `CX`, `CI`) from staffed cells.
- `/coverage` is now a compatibility redirect to `/schedule`; the old block-board and roster-layout toggle have been removed.
- Schedule cycle templates:
  - **Save as template** from a published cycle
  - **Start from template** for draft cycles
  - templates serialize staffing only; availability settings are intentionally not included
- **Availability** — therapist requests and manager **Plan staffing** for the selected cycle.
- **Availability email intake** — managers can ingest one email with body text plus multiple form attachments; high-confidence items auto-apply while unresolved items stay in the `/availability` review queue, where managers can now view the stored original email/OCR text, reparse stale items, or delete troubleshooting batches.
- **Publish History** ([`/publish`](<./src/app/(app)/publish/page.tsx>)) — two parts: (1) **Schedule blocks** — all non-archived cycles; archive drafts or delete drafts; **Start over** takes a live block offline; (2) **Publish email log** — delivery rows per publish; **Delete history** removes only that log row, not the block.
- **Analytics** ([`/analytics`](<./src/app/(app)/analytics/page.tsx>)) — manager view for recent cycle fill rates, therapist submission compliance, and force-on miss patterns.
- `New 6-week block` can optionally copy staffing from the latest published cycle. `Clear draft` clears draft assignments while unpublished.
- Published cycles stay editable on Schedule; `Archive cycle` sets `archived_at` and hides the block from pickers (see [`CLAUDE.md`](./CLAUDE.md) for data model).
- Managers can bulk-import roster rows from a generic CSV at [`/team/import`](<./src/app/(app)/team/import/page.tsx>) before reviewing them in the roster admin tab on `/team`.

## Team Work Patterns

Managers can review and edit recurring day-of-week staffing rules in one place at [`/team/work-patterns`](<./src/app/(app)/team/work-patterns/page.tsx>).

The page:

- groups therapists by day vs night shift
- shows current work/off day chips plus weekend rotation
- opens a dedicated edit dialog for the selected therapist
- keeps the older quick-edit modal section intact for additive access

## Tech Stack

- Next.js (App Router; **16.2.6**) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)

Local tooling noise (Playwright MCP dumps, generated `artifacts/`) is gitignored — see `.gitignore`.

## Operational Status Model

- `shifts` stores planned assignments for cycle/date/role.
- Real-time operational status (for example `on_call`, `call_in`, `cancelled`, `left_early`) is stored in `shift_operational_entries`.
- Schedule/headcount metrics use "working scheduled" semantics: planned assignments minus active operational entries.
- Staff Shift Board requests are future-only; same-day shift changes are handled by contacting the manager by phone.
- Assignment status updates are written through `update_assignment_status` RPC and audited.
- Lead-only schedule behavior is role-driven in product logic: `role = 'lead'` is the source of truth across Team, Schedule, print/export, and swap-partner filtering.

## Mutation Guardrails

- Schedule mutation routes reject untrusted cross-origin requests using shared origin/referer checks in `src/lib/security/request-origin.ts`.
- Post-publish audit logging for coverage edits is derived server-side from the affected slot state (past date or active operational entry), not from client-supplied flags.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill values.
3. Run app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

When using `next dev`, the first visit to each route can be slow because Next compiles that route on demand. To pay
that cost up front before clicking through the app, run this in a second terminal after the dev server is ready:

```bash
npm run dev:warm
```

If you have saved browser auth with `npm run auth:save -- --start http://127.0.0.1:3000/login`, the warmup command
will also reuse `.auth/storageState.json` so authenticated routes can be compiled before your manual pass.

For final workflow/UAT validation, prefer the production build instead of `next dev`:

```bash
npm run build
npm run start:prod:local
```

Then validate against `http://127.0.0.1:3001`. Use `next dev` for iteration, not the final truth source for browser behavior.

## Seed Demo Data

The demo seed script is idempotent and creates:

- one published cycle + one draft cycle
- sample shifts for therapist profiles
- sample availability requests
- one sample shift board post

For a fuller UAT dataset, run:

```bash
npm run seed:functional
```

That seed creates Teamwise real-roster demo accounts, a populated published cycle, an empty draft cycle for Auto-draft testing, and seeded swap-request scenarios for `/requests/new` and `/shift-board`. It also marks login-enabled staff demo accounts as onboarding-complete for walkthroughs.

Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Run:

```bash
npm run seed:demo
```

## Seed Fake Employees

Creates idempotent test Auth users and matching `profiles` rows.

Run:

```bash
npm run seed:users
```

Defaults:

- users: `employee01@teamwise.test` ... `employee08@teamwise.test`
- password: `Teamwise123!`
- roles: therapist
- shift types: alternating day/night

Optional env overrides:

- `SEED_USERS_COUNT`
- `SEED_USERS_DOMAIN`
- `SEED_USERS_PREFIX`
- `SEED_USERS_PASSWORD`
- `SEED_INCLUDE_MANAGER` (`true` creates `manager@<domain>`)
- `SEED_USERS_ONBOARDING_COMPLETE` (`true` marks seeded staff ready for app-surface walkthroughs)

## Sync team roster from a file (ops / email list)

Creates or updates **Auth** users and **`profiles`** from a text file (emails + names). This is **not** the same as the **`employee_roster`** name pre-match table on **`/team`** (used by the server-side signup trigger to auto-provision matched users without exposing that roster match to the public signup UX).

Requires **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** (e.g. via `.env.local`).

```bash
npm run sync:roster -- --file ./roster.txt --dry-run
npm run sync:roster -- --file ./roster.txt
```

See comments at the top of `scripts/sync-team-roster.mjs` for line formats and options.

## Team CSV Import Wizard

Managers can also import roster rows from a generic CSV through [`/team/import`](<./src/app/(app)/team/import/page.tsx>).

The wizard:

- reads `.csv` or `.txt`
- maps source headers to Teamwise roster fields
- validates each row
- allows importing valid rows while skipping invalid ones

This is separate from:

- the fixed-format bulk paste tool inside **Employee roster**
- `npm run sync:roster`, which creates auth users and `profiles`

## Shift Reminders

- Daily 24-hour reminder processing runs through [`/api/cron/shift-reminders`](./src/app/api/cron/shift-reminders/route.ts).
- The cron schedules reminder delivery for next-day `scheduled` shifts only.
- Each reminder is deduplicated through the `shift_reminder_outbox` unique `(shift_id, remind_type)` constraint.
- Successful reminders send both:
  - email via Resend
  - an in-app notification row in `notifications`

## Cleanup Seeded Demo Users

Removes seeded/demo auth users and their cascaded profile/schedule data.

Default behavior is a dry run:

```bash
npm run cleanup:seed-users
```

Execute the deletion:

```bash
npm run cleanup:seed-users -- --execute
```

Default match rules are intentionally narrow:

- domain: `teamwise.test`
- prefixes: `demo-manager`, `demo-lead-`, `demo-therapist`, `employee`
- exact email: `manager@teamwise.test`

Optional overrides:

- `--domain=<domain1,domain2>`
- `--prefix=<prefix1,prefix2>`
- `--email=<email1,email2>`
- env: `CLEANUP_ALLOWED_DOMAINS`, `CLEANUP_EMAIL_PREFIXES`, `CLEANUP_EXACT_EMAILS`

Use archive/inactive status in the Team UI for real staff whose history should remain visible. Use this cleanup command only for seeded/demo auth accounts that should be fully removed.

## Cleanup Local Artifacts

Dry-run cleanup for repo-local generated output only:

- generated directories under the current checkout root: `.next`, `.next-dev`, `.tmp`, `artifacts`, `playwright-report`, `shots`, `test-results`
- root temp/log files that match local Codex or temp naming (`.codex-*.log`, `.codex-*.err.log`, `.codex-*.out.log`, `.tmp-*`, legacy root `tsconfig.tsbuildinfo`)
- stale `.worktrees/*` helper directories whose absolute path is no longer registered with `git worktree list`

Command:

```bash
npm run cleanup:local
```

Apply the cleanup:

```bash
npm run cleanup:local -- --execute
```

## E2E Tests

Playwright smoke tests are in `e2e/`.

Run:

```bash
npm run test:e2e
```

Therapist visual validation shortcut:

```bash
npm run screens:therapist
```

That script prefers `SHOT_STAFF_EMAIL` / `SHOT_PASSWORD` when they work, but if the seeded staff login is stale it falls back to creating a temporary therapist user, authenticating Playwright with Supabase cookies, capturing the therapist routes, and deleting the temporary user afterward.

Final responsive demo/UAT capture lane:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run qa:responsive
```

Run it against the local production server after `npm run build` and `npm run start:prod:local`.
The command captures desktop (`1440x900`), tablet (`834x1112`), and mobile (`390x844`) PNGs for:

- public homepage, login, and signup
- manager dashboard, Schedule, Availability, Team import, and Audit log
- therapist dashboard, therapist schedule, and therapist availability

Screenshots and `summary.json` are written under `artifacts/responsive-qa/<timestamp>/` and mirrored to
`artifacts/responsive-qa/latest/`. The `artifacts/` directory is local-only and gitignored; do not commit these images.

Coverage improves when these env vars point at a seeded local/demo Supabase environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SHOT_MANAGER_EMAIL` or `E2E_USER_EMAIL` (defaults to `julie.d@teamwise.test`)
- `SHOT_STAFF_EMAIL` (defaults to `layne@teamwise.test`)
- `SHOT_PASSWORD` or `E2E_USER_PASSWORD` (defaults to the demo password)

If Supabase auth env vars are missing, `npm run qa:responsive` automatically runs in reduced public-only mode and
prints that state in the terminal and `summary.json`. To force public-only mode even when auth env vars exist, run:

```bash
npm run qa:responsive -- --mode=public
```

To require authenticated seeded coverage and fail when auth cannot be established, run:

```bash
npm run qa:responsive -- --mode=seeded
```

Optional filters:

```bash
npm run qa:responsive -- --viewports=mobile,tablet --personas=manager
```

Recommended lane:

- `npm run test:e2e` against `next dev` for routine regression coverage
- `npm run build` + `npm run start:prod:local` + screenshot/UAT checks against `http://127.0.0.1:3001` before trusting product-level workflow behavior

Focused workflow suites:

- `e2e/manager-schedule-roster.spec.ts` - unified Schedule grid render/edit/status smoke
- `e2e/coverage-publish-flow.spec.ts` - publish validation and override flow through the schedule APIs
- `e2e/coverage-cycle-controls.spec.ts` - legacy coverage-route compatibility around cycle controls
- `e2e/manager-specialized-controls.spec.ts` - swap partner approval and draft-cycle archive lifecycle
- `e2e/publish-history-lifecycle.spec.ts` - publish details, delete history, and start-over lifecycle
- `e2e/pickup-interest-concurrency.spec.ts` - seeded DB-backed pickup interest primary/backup promotion coverage

These focused specs complement the broader role/workflow coverage already in the repo and are useful when debugging a single manager-facing surface.

Pickup interest concurrency coverage requires a seeded Supabase/test DB environment with service-role access:

```bash
npx playwright test e2e/pickup-interest-concurrency.spec.ts --project=chromium --workers=1
```

Optional auth flow test uses:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

## Publish Email Rollout

Required env vars for publish queue + delivery:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `PUBLISH_EMAIL_FROM`
- optional `PUBLISH_WORKER_KEY` + `PUBLISH_WORKER_SIGNING_KEY` (for signed cron/webhook auth)

For signed worker calls to `POST /api/publish/process`, send:

- `x-publish-worker-key: <PUBLISH_WORKER_KEY>`
- `x-publish-worker-timestamp: <unix-seconds>`
- `x-publish-worker-signature: <hex-hmac-sha256>`

Signature payload format:

```text
POST
/api/publish/process
<unix-seconds>
```

Run readiness check:

```bash
npm run verify:publish
```

If you only want in-app publish without email delivery, run:

```bash
npm run verify:publish -- --allow-no-email
```

## Inbound Availability Email Intake

Managers can now receive staff request emails and apply parsed dates into availability planning.

What the app does:

- accepts `email.received` webhooks at `/api/inbound/availability-email`
- acknowledges the webhook immediately, then completes OCR/parsing in background so Resend does not get stuck retrying long OCR requests
- fetches full email content plus attachments from Resend receiving
- matches the sender email to an employee profile when possible
- parses text like `Need off Mar 24, Mar 26` or `Can work Apr 2`
- splits reduced PTO-form email bodies on repeated `Employee Name:` blocks so one email can yield multiple per-employee intake items
- can OCR supported image attachments through the OpenAI Responses API when configured
- creates an intake record for manager review on [`/availability`](./src/app/availability/page.tsx)
- lets managers inspect the stored original email body plus attachment OCR text from the intake card
- lets managers reparse a stored intake when OCR/parser behavior changes
- lets managers delete old troubleshooting or replay rows from the intake queue
- applies parsed dates into `availability_overrides` as manager-entered inputs
- renders scanned PDF pages and retries OCR using multiple page-image variants and fixed-form-like region prompts when direct PDF extraction returns no text
- reads OCR text from the actual OpenAI Responses message payload shape, not just `output_text`
- expands clear PTO recurrence phrases like `Off Tuesday + Wednesdays` across the active cycle window when one active block is available, while leaving malformed OCR fragments in review instead of inventing dates

Current production behavior:

- photographed PTO form images like `IMG_0262.jpeg` now OCR and parse into structured requests successfully
- forwarded-email body boilerplate is ignored instead of becoming a fake availability request
- items still land in `needs_review` when business rules require it, for example when OCR dates do not match any active schedule cycle
- `/availability` intake cards now expose the stored original email text and attachment OCR text so managers can verify what was actually ingested before applying, reparsing, or deleting the batch

Required env vars:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Optional OCR env vars:

- `OPENAI_API_KEY`
- `OPENAI_OCR_MODEL` (defaults to `gpt-4.1-mini`)

Setup outline:

1. In Resend, enable receiving for either a custom inbox domain or a Resend-managed receiving domain.
2. Create a webhook for `email.received` pointing to:

```text
https://your-app-domain/api/inbound/availability-email
```

3. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`.
4. Forward or send request emails/forms to the receiving inbox.
5. Open `/availability` as a manager and review the **Email Intake** panel.

Current MVP limits:

- automatic parsing is best when the email body is typed and structured
- reduced PTO-style employee blocks can parse without the full form scaffold, but malformed OCR fragments still stay in the review queue by design
- image attachments (`png`, `jpg`, `jpeg`, `webp`, `gif`) can be OCR'd when OpenAI is configured
- PDF attachments are first attempted through direct PDF extraction, then through rendered page-image OCR when needed
- very poor handwritten scans can still remain unreadable even after preprocessing and fixed-form-like region prompts; those items stay in the review queue with stored OCR failure reasons
- sender matching currently uses the sender email address against `profiles.email`
- the Resend API key must have receiving-capable permissions; a send-only key cannot fetch inbound email content

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

- `Lint and Build` runs on every push and pull request.
- `Playwright E2E` runs when the following repository secrets are set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - optional: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`

When all seeded Supabase secrets are present, the CI Playwright lane includes DB-backed pickup concurrency coverage. Without those secrets, CI runs reduced public/auth E2E coverage and explicitly excludes DB-backed concurrency coverage.

## Local CI Fallback (when GitHub Actions is unavailable)

Run the same quality checks locally:

```bash
npm run ci:local
```

Quick pre-push profile:

```bash
npm run ci:local:quick
```

Full checks with e2e:

```bash
npm run ci:local:e2e
```

Notes:

- A Husky `pre-push` hook runs `ci:local:quick` automatically.
- To bypass once (for emergencies): `SKIP_LOCAL_CI=1 git push`

## Useful Commands

```bash
npm run lint
npm run build
npm run ci:local
npm run seed:users
npm run cleanup:seed-users
npm run test:e2e
```

## Appearance

- Theme preference is managed in [`/profile`](<./src/app/(app)/profile/page.tsx>) under **Appearance**.
- Options: **Light**, **System**, **Dark**
- Root theme state is applied by [`ThemeProvider.tsx`](./src/components/ThemeProvider.tsx) using `tw-theme` in localStorage.
- Print forces light token values even if the app is currently in dark mode.
