# RT Scheduler Project Guide

Use this with the root `AGENTS.md` guidance. Keep changes small, lifecycle-aware, and verified.

## Project Shape

- RT Scheduler is a Next.js App Router and TypeScript respiratory therapy scheduling app.
- Supabase owns auth, database access, RLS, and server-side scheduling data flows.
- `/schedule` is the canonical live schedule surface.

## High-Risk Areas

- `src/app/api/schedule/drag-drop/route.ts` is high-risk. Avoid broad rewrites; preserve lifecycle, authorization, audit, and notification behavior.
- `src/components/schedule-grid/ScheduleGrid.tsx` is complex. Prefer small, tested extractions over large refactors.

## Safety Rules

- Do not commit secrets, `.env` files, local auth or session artifacts, screenshots, or logs.
- Before claiming completion, run checks relevant to the change, such as formatting, lint, typecheck, focused tests, and route/workflow verification where applicable.
