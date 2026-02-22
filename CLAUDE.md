# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-22

## What This App Is
Teamwise is a respiratory therapy scheduling app replacing a manual paper workflow.
It covers cycle scheduling, availability requests, shift board actions, and manager approvals.

## Current Branch Snapshot
- Active branch: `claude/write-claude-md-YSz8m`
- Branch head includes recent UI/theme work:
  - `e3d923b` - Apply Teamwise Brand Kit UI across app and align theme tokens
- Working tree status when last updated in-session: clean before this `CLAUDE.md` edit

## Product Status
- Core pages are live:
  - `/` home
  - `/login`
  - `/signup`
  - `/dashboard`
  - `/availability`
  - `/schedule`
  - `/shift-board`
- Role model:
  - `manager` and `therapist`
- Calendar views:
  - manager-only month calendar drag/drop
  - therapist uses non-calendar views

## Scheduling Behavior
- Weekly therapist target: exactly 3 worked days per Sun-Sat week
- Daily coverage target: 3 to 5 therapists per shift type per day
- Manager can override scheduling limits where supported
- Day and night shifts are separate lanes
- Manager can move assignments between day and night via drag/drop

## Manager Calendar UX
- Shows all months in selected cycle range
- Renders day and night calendars per month
- Coverage meter displayed on day cards as `count/3-5`
- Drag/drop supports:
  - assign from therapist list
  - move shift between dates/types
  - remove shift via remove zone
- Undo action available after drag/drop operations

## Availability UX
- Duplicate availability date requests are blocked
- User sees explicit error for duplicate submission in same cycle

## Shift Board UX
- Shift posts support claim flow
- Swap posts can reference a linked `swap_shift_id`
- Recent fix centralized scheduling constants and improved approval logic

## Design System Status (Latest)
The app was restyled to match the provided Teamwise Brand Kit and UI package.

Applied palette/tokens in `src/app/globals.css`:
- Primary blue: `#0667A9`
- Deep blue: `#1D608E`
- Light blue: `#6AA5C8`
- Accent orange: `#E27F3F`
- Soft tint: `#CEDFE3`

Also updated:
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/teamwise-logo.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`

## Technical Stack
- Next.js App Router + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Playwright for e2e
- Vercel deployment target

## Environment and Scripts
Required runtime vars in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Seed scripts:
- `npm run seed:demo`
- `npm run seed:users`

`seed:users` also requires:
- `SUPABASE_SERVICE_ROLE_KEY`

## Database Notes
Main tables:
- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests`
- `shift_posts`

Migration folder:
- `supabase/migrations/`

Important:
- A `handle_new_user` trigger/function and auth user trigger already exist in historical migrations:
  - `20260221151001_remote_schema.sql`
  - `20260221152102_fix_profiles_rls_and_backfill.sql`
- `docs/NEXT_STEPS.md` was requested in chat but is not present in repo.

## Key Files
- `src/app/schedule/page.tsx` - schedule cycle controls and view modes
- `src/components/manager-month-calendar.tsx` - drag/drop calendar UI
- `src/app/api/schedule/drag-drop/route.ts` - drag/drop API and rule checks
- `src/app/availability/page.tsx` - availability requests
- `src/app/shift-board/page.tsx` - shift board and approvals
- `src/app/dashboard/page.tsx` - role entry point
- `src/components/teamwise-logo.tsx` - Teamwise logo components
- `src/lib/scheduling-constants.ts` - centralized scheduling constants
- `src/proxy.ts` - auth route protection

## Known Follow-Up Items
- If requested, merge `claude/write-claude-md-YSz8m` into `main` after review.
- Confirm production Supabase trigger behavior by creating a new auth user and checking `profiles` row creation.
- Add missing `docs/NEXT_STEPS.md` if team wants that doc-driven workflow.

## Quick Resume Checklist
1. `git status -sb`
2. `npm run lint`
3. `npm run build`
4. `npm run dev`
5. Verify:
   - manager calendar drag/drop
   - availability duplicate blocking
   - shift board claim/approval flow
   - branding consistency on home/login/signup/dashboard
