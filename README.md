# RT Scheduler

Web app for respiratory therapy scheduling with role-based workflows:

- Auth + role-aware dashboard
- Availability requests
- 6-week schedule cycle management
- **Canonical staff schedule:** [`/coverage`](./src/app/coverage/page.tsx) (`view=week`); server entry is `page.tsx` and interactive client logic lives in [`CoverageClientPage.tsx`](./src/app/coverage/CoverageClientPage.tsx). Compatibility routes (`/schedule`, `/therapist/schedule`) redirect there
- **Therapist availability:** 6-week grid on `/therapist/availability` — **Available** (default: neutral day, no forced on/off), **Unavailable**, **Must work** (hard autodraft `force_on`); see [`CLAUDE.md`](./CLAUDE.md)
- Shift board (swap/pickup posts with manager approval)

Current architecture and quality snapshot: [`docs/REPO_HEALTH.md`](docs/REPO_HEALTH.md)

## Cycle Workflow

- **Schedule** (nav label; route [`/coverage`](./src/app/coverage/page.tsx), rendered via [`CoverageClientPage.tsx`](./src/app/coverage/CoverageClientPage.tsx)) — create **New 6-week block**, staff the grid, auto-draft, preliminary, **Publish**. Same cycle-selection rule everywhere: URL cycle if valid, else active window, else next upcoming, else none (empty state, not a fake grid).
- **Availability** — therapist requests and manager **Plan staffing** for the selected cycle.
- **Publish History** ([`/publish`](./src/app/publish/page.tsx)) — two parts: (1) **Schedule blocks** — all non-archived cycles; archive drafts or delete drafts; **Start over** takes a live block offline; (2) **Publish email log** — delivery rows per publish; **Delete history** removes only that log row, not the block.
- `New 6-week block` can optionally copy staffing from the latest published cycle. `Clear draft` clears draft assignments while unpublished.
- Published cycles stay editable on Schedule; `Archive cycle` sets `archived_at` and hides the block from pickers (see [`CLAUDE.md`](./CLAUDE.md) for data model).

## Tech Stack

- Next.js (App Router; **16.1.x** patch line) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)

Local tooling noise (Playwright MCP dumps, generated `artifacts/`) is gitignored — see `.gitignore`.

## Operational Status Model

- `shifts` stores planned assignments for cycle/date/role.
- Real-time operational status (for example `on_call`, `call_in`, `cancelled`, `left_early`) is stored in `shift_operational_entries`.
- Coverage/headcount metrics use "working scheduled" semantics: planned assignments minus active operational entries.
- Assignment status updates are written through `update_assignment_status` RPC and audited.

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

## E2E Tests

Playwright smoke tests are in `e2e/`.

Run:

```bash
npm run test:e2e
```

Recommended lane:

- `npm run test:e2e` against `next dev` for routine regression coverage
- `npm run build` + `npm run start:prod:local` + screenshot/UAT checks against `http://127.0.0.1:3001` before trusting product-level workflow behavior

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
npm run test:e2e
```
