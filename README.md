# RT Scheduler

Web app for respiratory therapy scheduling with role-based workflows:

- Auth + role-aware dashboard
- Availability requests
- 6-week schedule cycle management
- **Canonical staff schedule:** [`/coverage`](./src/app/coverage/page.tsx) (`view=week`); compatibility routes (`/schedule`, `/therapist/schedule`) redirect there
- **Therapist availability:** 6-week grid on `/therapist/availability` — Available (default), Unavailable, Must work (autodraft constraint); see [`CLAUDE.md`](./CLAUDE.md) for override semantics
- Shift board (swap/pickup posts with manager approval)

Current architecture and quality snapshot: [`docs/REPO_HEALTH.md`](docs/REPO_HEALTH.md)

## Tech Stack

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)

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
