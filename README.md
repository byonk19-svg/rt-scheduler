# RT Scheduler

Web app for respiratory therapy scheduling with role-based workflows:
- Auth + role-aware dashboard
- Availability requests
- 6-week schedule cycle management
- Shift board (swap/pickup posts with manager approval)

## Tech Stack
- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)

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

## CI (GitHub Actions)
Workflow: `.github/workflows/ci.yml`

- `Lint and Build` runs on every push and pull request.
- `Playwright E2E` runs when the following repository secrets are set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - optional: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`

## Useful Commands
```bash
npm run lint
npm run build
npm run seed:users
npm run test:e2e
```
