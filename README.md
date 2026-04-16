# RT Scheduler

Web app for respiratory therapy scheduling with role-based workflows:

- Auth + role-aware dashboard with pending-access onboarding
- Availability requests
- 6-week schedule cycle management
- **Canonical staff schedule:** [`/coverage`](<./src/app/(app)/coverage/page.tsx>) supports both `Grid` and `Roster` layouts; server entry is `page.tsx`, initial snapshot loading lives in [`coverage-page-data.ts`](<./src/app/(app)/coverage/coverage-page-data.ts>), and interactive client logic lives in [`CoverageClientPage.tsx`](<./src/app/(app)/coverage/CoverageClientPage.tsx>). The therapist compatibility route (`/therapist/schedule`) still redirects there and preserves explicit `view` params
- **Mock manager roster screen:** [`/schedule`](<./src/app/(app)/schedule/page.tsx>) is now a public, deterministic roster-only screen backed by local mock data and local assignment state for UI iteration
- **Therapist availability:** 6-week grid on `/therapist/availability` — **Available** (default: neutral day, no forced on/off), **Unavailable**, **Must work** (hard autodraft `force_on`); see [`CLAUDE.md`](./CLAUDE.md)
- Shift board (swap/pickup posts with manager approval)

## Auth + Access Model

- Public homepage (`/`) is therapist-first marketing: luminous background, trust-forward copy, product preview frame, and clear CTAs — **Get started** + **Sign in** in the header, **Sign in** + **Create account** in the hero (Vitest contracts in `src/app/page.test.ts`).
- Therapists request access via `/signup` (first/last name, optional phone, email, password).
- Managers are **not** created via public signup; they are provisioned admin-side.
- After a successful request, users are redirected to `/login?status=requested` (no automatic session). The public signup flow now always uses that generic redirect rather than disclosing whether the submitted name matched an internal roster row. Server-side roster auto-match can still provision role/settings immediately for matched users; unmatched signups stay pending (`profiles.role = null`) until manager approval.
- Pending users can authenticate but are gated away from app workflows until manager approval.
- Manager approves pending users in `Requests -> User Access Requests` and assigns role at approval time (`therapist` or `lead`).
- Declining an access request deletes the pending account.

Current architecture and quality snapshot: [`docs/REPO_HEALTH.md`](docs/REPO_HEALTH.md)

## Cycle Workflow

- [`/schedule`](<./src/app/(app)/schedule/page.tsx>) is the standalone mock manager roster surface. It renders from local mock data, keeps assign/unassign state in the client, and is tuned to show the full 6-week matrix at once on standard desktop widths.

- **Schedule** (nav label; route [`/coverage`](<./src/app/(app)/coverage/page.tsx>), rendered via [`CoverageClientPage.tsx`](<./src/app/(app)/coverage/CoverageClientPage.tsx>)) — create **New 6-week block**, staff the schedule in either **Grid** or **Roster** view, auto-draft, preliminary, **Publish**. Same cycle-selection rule everywhere: URL cycle if valid, else active window, else next upcoming, else none (empty state, not a fake grid).
- Managers can edit staffing from either schedule layout by clicking a day cell. Leads can update assignment status (`OC`, `LE`, `CX`, `CI`) from staffed cells in either layout.
- Users can save a default schedule layout preference (`Grid` or `Roster`) in [`/profile`](<./src/app/(app)/profile/page.tsx>); the therapist compatibility route still defers default layout selection to `/coverage` so that saved preference wins unless an explicit `view` query is present.
- **Availability** — therapist requests and manager **Plan staffing** for the selected cycle.
- **Availability email intake** — managers can ingest one email with body text plus multiple form attachments; high-confidence items auto-apply while unresolved items stay in the `/availability` review queue, where managers can now view the stored original email/OCR text, reparse stale items, or delete troubleshooting batches.
- **Publish History** ([`/publish`](<./src/app/(app)/publish/page.tsx>)) — two parts: (1) **Schedule blocks** — all non-archived cycles; archive drafts or delete drafts; **Start over** takes a live block offline; (2) **Publish email log** — delivery rows per publish; **Delete history** removes only that log row, not the block.
- `New 6-week block` can optionally copy staffing from the latest published cycle. `Clear draft` clears draft assignments while unpublished.
- Published cycles stay editable on Schedule; `Archive cycle` sets `archived_at` and hides the block from pickers (see [`CLAUDE.md`](./CLAUDE.md) for data model).

## Tech Stack

- Next.js (App Router; **16.2.3**) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)

Local tooling noise (Playwright MCP dumps, generated `artifacts/`) is gitignored — see `.gitignore`.

## Operational Status Model

- `shifts` stores planned assignments for cycle/date/role.
- Real-time operational status (for example `on_call`, `call_in`, `cancelled`, `left_early`) is stored in `shift_operational_entries`.
- Coverage/headcount metrics use "working scheduled" semantics: planned assignments minus active operational entries.
- Assignment status updates are written through `update_assignment_status` RPC and audited.
- Lead-only schedule behavior is role-driven in product logic: `role = 'lead'` is the source of truth across Team, Coverage, print/export, and swap-partner filtering.

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

## Sync team roster from a file (ops / email list)

Creates or updates **Auth** users and **`profiles`** from a text file (emails + names). This is **not** the same as the **`employee_roster`** name pre-match table on **`/team`** (used by the server-side signup trigger to auto-provision matched users without exposing that roster match to the public signup UX).

Requires **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** (e.g. via `.env.local`).

```bash
npm run sync:roster -- --file ./roster.txt --dry-run
npm run sync:roster -- --file ./roster.txt
```

See comments at the top of `scripts/sync-team-roster.mjs` for line formats and options.

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

## E2E Tests

Playwright smoke tests are in `e2e/`.

Run:

```bash
npm run test:e2e
```

Recommended lane:

- `npm run test:e2e` against `next dev` for routine regression coverage
- `npm run build` + `npm run start:prod:local` + screenshot/UAT checks against `http://127.0.0.1:3001` before trusting product-level workflow behavior

Focused workflow suites:

- `e2e/coverage-publish-flow.spec.ts` - direct Coverage publish and override flow
- `e2e/coverage-cycle-controls.spec.ts` - cycle create/delete plus auto-draft / clear-draft controls
- `e2e/manager-specialized-controls.spec.ts` - swap partner approval and draft-cycle archive lifecycle
- `e2e/publish-history-lifecycle.spec.ts` - publish details, delete history, and start-over lifecycle

These focused specs complement the broader role/workflow coverage already in the repo and are useful when debugging a single manager-facing surface.

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
  - optional: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`

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
