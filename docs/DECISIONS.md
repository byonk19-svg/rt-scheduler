# Architecture Decisions

## Stack

- **Frontend:** Next.js 16.1.6 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend/DB:** Supabase (Postgres + Auth)
- **Deploy:** Vercel (frontend) + Supabase (backend)

**Why:** Free tiers cover MVP needs; Supabase handles auth + DB in one place; shadcn/ui gives polished components without a paid design system.

## Roles

- `manager` — can build/edit schedules, approve swaps, view all availability
- `therapist` — can submit availability, view published schedule, post swap requests

## Scheduling

- Each therapist has one shift type (day or night)
- New cycles generate a smart draft from submitted availability
- Manager edits draft before publishing

## Shift Swaps

- Public board for posting requests
- Swaps require manager approval to be official

## Operational State Separation

- Decision: keep `shifts` focused on planned schedule rows and store live operational status in dedicated operational-entry tables.
- Why: prevents operational overrides from mutating planning intent, gives one-active-code enforcement, and provides auditable transition history.
- Impact: coverage/headcount metrics now use "working scheduled" semantics (planned minus active operational entries).
