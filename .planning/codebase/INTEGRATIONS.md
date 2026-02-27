# External Integrations

**Analysis Date:** 2026-02-25

## APIs and External Services

**Supabase (Core Backend):**
- Used for Postgres, Auth, and RLS-backed data access.
- Clients:
  - browser: `src/lib/supabase/client.ts`
  - server: `src/lib/supabase/server.ts`
  - admin/service role: `src/lib/supabase/admin.ts`
- Auth/session read in multiple entry points (`src/app/layout.tsx`, `src/proxy.ts`, route handlers).

**Resend Email API (Publish notifications):**
- Outbound email endpoint: `https://api.resend.com/emails`.
- Integration file: `src/lib/publish-events.ts` and processing route `src/app/api/publish/process/route.ts`.
- Auth via `RESEND_API_KEY`; sender via `PUBLISH_EMAIL_FROM` (or `RESEND_FROM_EMAIL`).

## Data Storage

**Primary Database:**
- Supabase Postgres.
- Schema/migrations managed in `supabase/migrations/*.sql`.
- Key domain tables include:
  - `profiles`
  - `shifts`
  - `schedule_cycles`
  - `shift_posts` / request-related tables
  - `notifications`, `publish_events`, `notification_outbox`.

**File/Artifact Storage:**
- Repo-level artifacts for tests/reports:
  - `test-results/`
  - Playwright report artifacts uploaded in CI.

## Authentication and Identity

**Auth Provider:**
- Supabase Auth.
- Role checks from JWT metadata with DB fallback in `src/proxy.ts`.

**Authorization:**
- RLS policies defined in migrations (initial schema and follow-up hardening).
- Manager-only write operations enforced by policy and/or API route guards.

## Monitoring and Observability

**App logging:**
- Console logging (`console.error`/`console.warn`) in server actions and routes.
- No dedicated external APM service configured in repository files.

**Audit/Notification domain logging:**
- Internal audit table writes via `src/lib/audit-log.ts`.
- In-app notification writes via `src/lib/notifications.ts`.

## CI/CD and Deployment

**CI:**
- GitHub Actions: `.github/workflows/ci.yml`.
- Jobs:
  - `quality`: npm ci, lint, build.
  - `e2e`: Playwright with Supabase secrets.

**Hosting conventions:**
- Next.js deployment path (README references Vercel-compatible flow).
- Runtime configuration through environment variables.

## Environment Configuration

**Development:**
- Secrets in `.env.local` (gitignored).
- Seed scripts:
  - `npm run seed:demo`
  - `npm run seed:users`

**CI:**
- Supabase URL/anon key pulled from GitHub Secrets.
- Optional auth test credentials (`E2E_USER_EMAIL`, `E2E_USER_PASSWORD`).

## Webhooks and Callbacks

**Supabase auth callback:**
- Public route handling at `/auth/callback` (middleware allows it).

**Publish email worker endpoint:**
- `POST /api/publish/process` supports internal worker-key header (`x-publish-worker-key`) and manager-auth fallback.

---

*Integration audit: 2026-02-25*
*Update when external providers or env contracts change*
