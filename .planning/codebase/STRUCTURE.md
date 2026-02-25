# Codebase Structure

**Analysis Date:** 2026-02-25

## Directory Layout

```text
rt-scheduler/
+- src/
|  +- app/                 # App Router pages, route handlers, server actions
|  |  +- api/              # API routes (schedule, publish, notifications, availability)
|  |  +- schedule/         # manager schedule hub + actions
|  |  +- coverage/         # manager coverage page
|  |  +- staff/            # staff-facing routes and layout
|  |  +- dashboard/        # manager + staff dashboards
|  |  +- requests/         # shift request pages
|  +- components/          # reusable UI and calendar components
|  +- lib/                 # domain helpers, supabase clients, workflow logic
+- supabase/
|  +- migrations/          # SQL migrations
|  +- rollback/            # rollback SQL scripts
+- e2e/                    # Playwright specs
+- scripts/                # seed scripts
+- .github/workflows/      # CI pipelines
+- package.json            # scripts and dependencies
+- README.md               # setup and project notes
+- CLAUDE.md               # local project guidance
```

## Directory Purposes

**`src/app/`:**
- Purpose: route-level UI and request handlers.
- Key files:
  - `src/app/schedule/page.tsx`
  - `src/app/schedule/actions.ts`
  - `src/app/api/schedule/drag-drop/route.ts`
  - `src/app/coverage/page.tsx`.

**`src/components/`:**
- Purpose: shareable UI primitives and manager calendars.
- Key files:
  - `src/components/manager-month-calendar.tsx`
  - `src/components/manager-week-calendar.tsx`
  - `src/components/ScheduleHeader.tsx`.

**`src/lib/`:**
- Purpose: reusable business logic and adapters.
- Key files:
  - `schedule-helpers.ts`
  - `schedule-rule-validation.ts`
  - `manager-workflow.ts`
  - `supabase/{client,server,admin}.ts`.

**`supabase/migrations/`:**
- Purpose: schema and policy evolution.
- Contains timestamped SQL migrations.

## Key File Locations

**Entry points:**
- `src/app/layout.tsx` - global shell.
- `src/proxy.ts` - auth + route protection.

**Scheduling core:**
- `src/app/schedule/page.tsx` - manager schedule container.
- `src/app/schedule/actions.ts` - cycle/shift mutations.
- `src/app/api/schedule/drag-drop/route.ts` - drag/drop assignment API.

**Coverage/requests:**
- `src/app/coverage/page.tsx`
- `src/app/shift-board/page.tsx`
- `src/app/requests/new/page.tsx`.

**Tests:**
- unit: `src/**/*.test.ts`
- e2e: `e2e/*.spec.ts`.

## Naming Conventions

**Files:**
- kebab-case for modules (`manager-week-calendar.tsx`).
- route files follow Next conventions (`page.tsx`, `route.ts`, `layout.tsx`).
- tests end with `.test.ts`.

**Imports:**
- alias `@/` for `src/` modules.

## Where to Add New Code

**New scheduling feature:**
- UI: `src/components/` or `src/app/<feature>/page.tsx`.
- mutation path: `src/app/<feature>/actions.ts` and/or `src/app/api/<feature>/route.ts`.
- shared rules: `src/lib/`.
- SQL changes: `supabase/migrations/`.

**New tests:**
- unit tests next to feature module in `src/`.
- browser flow tests in `e2e/`.

## Special Directories

**`.next/`:**
- Build output (generated, not source of truth).

**`test-results/`:**
- Playwright output artifacts.

---

*Structure analysis: 2026-02-25*
*Update when route layout or domain boundaries change*
