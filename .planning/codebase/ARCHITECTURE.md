# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:**

- Full-stack Next.js monolith (App Router) backed by Supabase.
- Mixed mutation architecture:
  - server actions (`src/app/schedule/actions.ts`, etc.)
  - API routes (`src/app/api/**`).

**Key Characteristics:**

- Route-driven UI with role-based views (manager vs staff).
- Supabase-centric data model and auth.
- Business rules centralized in `src/lib/*` for reuse.

## Layers

**Presentation Layer (App + Components):**

- Purpose: render UI, gather user input, display status.
- Contains: `src/app/**/page.tsx`, `src/components/*.tsx`.
- Used by: browser users on manager/staff flows.

**Application Layer (Actions/Route Handlers):**

- Purpose: enforce workflow orchestration and side effects.
- Contains:
  - server actions in `src/app/*/actions.ts`
  - route handlers in `src/app/api/**/route.ts`.
- Depends on: Supabase clients + domain helpers.

**Domain/Rules Layer:**

- Purpose: reusable scheduling and workflow logic.
- Contains: `src/lib/schedule-rule-validation.ts`, `src/lib/schedule-helpers.ts`, `src/lib/manager-workflow.ts`, `src/lib/set-designated-lead.ts`.
- Used by: actions, APIs, and rendering pipelines.

**Persistence/Auth Layer:**

- Purpose: DB access, role checks, auth session handling.
- Contains: `src/lib/supabase/{client,server,admin}.ts`, SQL migrations in `supabase/migrations/`.

## Data Flow

**Manager staffing change flow (calendar/coverage):**

1. Manager action in calendar/coverage UI.
2. Mutation call via server action or API (`/api/schedule/drag-drop`, `/api/schedule/assignment-status`).
3. Validation checks (coverage, weekly limits, lead eligibility).
4. `shifts` row insert/update/delete.
5. Optional audit + notification writes.
6. UI refresh/optimistic update.

**Publish cycle flow:**

1. Manager triggers publish action.
2. Server action validates coverage and weekly rules.
3. Cycle publish flag updates.
4. Publish event/outbox rows queued.
5. Async processor route sends email batches and updates counts.

## Key Abstractions

**Schedule Slot:**

- Core abstraction around date + shift_type + assigned user + role.
- Appears across `shifts` queries and rule validators.

**Assignment Status:**

- Distinct from shift status in newer schema (`assignment_status` + metadata columns).
- Used in manager calendar overlays and assignment status API.

**Role Normalization:**

- Middleware maps `manager` vs staff-like roles (`staff`, `therapist`, `lead`) in `src/proxy.ts`.

## Entry Points

- App shell/layout: `src/app/layout.tsx`.
- Role gate/middleware proxy: `src/proxy.ts`.
- Manager schedule page: `src/app/schedule/page.tsx`.
- Coverage page: `src/app/coverage/page.tsx`.
- Core mutation APIs:
  - `src/app/api/schedule/drag-drop/route.ts`
  - `src/app/api/schedule/assignment-status/route.ts`
  - `src/app/api/publish/process/route.ts`.

## Error Handling

**Strategy:**

- Server actions: redirect with query-state error/success tokens.
- API routes: structured JSON errors with HTTP status.
- Client components: optimistic rollback + alert/toast/error banner.

## Cross-Cutting Concerns

**Auth/RBAC:**

- Enforced in middleware + route-level guards + RLS.

**Validation:**

- Weekly coverage/eligibility constraints from shared lib functions.

**Auditability:**

- Audit log and notifications triggered during schedule changes.

---

_Architecture analysis: 2026-02-25_
_Update after major flow or layer changes_
