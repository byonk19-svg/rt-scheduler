# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**

- TypeScript - primary language for app code in `src/`.

**Secondary:**

- JavaScript - config and scripts (`package.json` scripts, `scripts/*.mjs`).
- SQL - schema/migration logic in `supabase/migrations/*.sql`.

## Runtime

**Environment:**

- Node.js 20.x (explicit in CI at `.github/workflows/ci.yml`).
- Browser runtime for client components in Next.js App Router.

**Package Manager:**

- npm (lockfile present: `package-lock.json`).

## Frameworks

**Core:**

- Next.js `16.1.6` (`package.json`).
- React `19.2.3` + React DOM `19.2.3`.

**UI/Styling:**

- Tailwind CSS v4 stack (`tailwindcss`, `@tailwindcss/postcss`).
- shadcn/radix usage (`components/ui/*`, `radix-ui` dependency).

**Data/Auth:**

- Supabase JS v2 (`@supabase/supabase-js`) with SSR helpers (`@supabase/ssr`).

**Testing:**

- Vitest for unit tests (`vitest.config.ts`, `src/**/*.test.ts`).
- Playwright for E2E (`playwright.config.ts`, `e2e/*.spec.ts`).

## Key Dependencies

**Critical:**

- `@supabase/supabase-js` - database/auth API access.
- `@supabase/ssr` - server/browser client wiring with cookies.
- `next` - web framework/runtime.
- `react` + `react-dom` - UI rendering.

**Infrastructure/UX:**

- `lucide-react` - iconography.
- `class-variance-authority`, `clsx`, `tailwind-merge` - class composition patterns.

## Configuration

**Environment:**

- local env file: `.env.local`.
- documented setup: `.env.example` + `README.md`.
- notable keys used by code:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - publish email keys (`RESEND_API_KEY`, `PUBLISH_EMAIL_FROM`, `PUBLISH_WORKER_KEY`).

**Build/Compiler:**

- `tsconfig.json` with strict mode and alias `@/* -> ./src/*`.
- `next.config.ts` enables `reactCompiler` and configurable dist dir.
- `eslint.config.mjs` uses Next core-web-vitals + TS config.

## Platform Requirements

**Development:**

- Node 20+ recommended to match CI.
- Supabase project credentials required for auth/data workflows.

**CI/CD:**

- GitHub Actions workflow in `.github/workflows/ci.yml`.
- quality gate: lint + build.
- optional E2E gate when Supabase secrets are configured.

**Production (current conventions):**

- Next.js deployment target (README references Vercel-oriented workflow).
- Supabase as hosted Postgres/Auth backend.

---

_Stack analysis: 2026-02-25_
_Update after dependency/runtime upgrades_
