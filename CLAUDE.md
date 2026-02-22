# Teamwise Scheduler - Project Context

Updated: 2026-02-22

## What this app is
Teamwise is a scheduling app replacing a manual paper grid for respiratory therapy staffing.
It supports cycle-based scheduling, availability requests, and shift board workflows.

## Current Product State
- Core pages are live: home, login, signup, dashboard, availability, schedule, shift board.
- Branding and UI have been updated to Teamwise.
- Manager scheduling now supports both:
  - Auto-generate draft schedules (primary workflow).
  - Drag-and-drop month calendars for manual edits and hole-filling.

## Scheduling Rules (Current)
- Weekly rule (therapists): target exactly 3 worked days per week (Sun-Sat).
- Daily coverage rule (per shift type, per day): min 3 and max 5.
- Manager can override rules when needed.
- Day and night are managed as separate calendars/coverage lanes.
- Therapists can be moved between day and night by manager drag-drop.

## Calendar UX (Current)
- Manager calendar view shows all months in the selected cycle date range.
- Each month renders both:
  - Day Shift Calendar
  - Night Shift Calendar
- Coverage meter is shown on each date card as `count/3-5`.
- Dragging supports:
  - Assign therapist from side panel to a date.
  - Move existing shift between dates/shifts.
  - Remove shift by dragging to remove zone.
- Undo button appears after drag-drop actions.

## Availability UX (Current)
- Duplicate availability request submission is blocked.
- User receives clear error when submitting a duplicate date for the same cycle.

## Roles
- `manager`: build/edit schedules, publish cycles, review availability, approve/deny shift posts.
- `therapist`: submit availability, view published schedule, post swap/pickup requests.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Deploy target: Vercel + Supabase

## Environment and Scripts
- Runtime env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Seed scripts in `package.json`:
  - `npm run seed:demo`
  - `npm run seed:users`
- Seed scripts load `.env.local` via:
  - `node --env-file=.env.local ...`
- `seed:users` requires:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Database Tables
- `profiles`: id, full_name, email, role, shift_type
- `schedule_cycles`: id, label, start_date, end_date, published
- `shifts`: id, cycle_id, user_id, date, shift_type, status
- `availability_requests`: id, user_id, cycle_id, date, reason
- `shift_posts`: id, shift_id, posted_by, message, type, status

## Key Files
- `src/app/schedule/page.tsx` - cycle controls, auto-generate, publish validation, schedule views
- `src/components/manager-month-calendar.tsx` - manager drag/drop month calendars (day/night, coverage, undo)
- `src/app/api/schedule/drag-drop/route.ts` - drag/drop assign/move/remove + validation rules
- `src/app/availability/page.tsx` - request form + duplicate prevention
- `src/app/dashboard/page.tsx` - role-aware dashboard
- `src/app/login/page.tsx` - login
- `src/app/signup/page.tsx` - signup
- `src/app/shift-board/page.tsx` - swap/pickup board
- `src/app/auth/signout/route.ts` - signout
- `src/lib/supabase/client.ts` - browser Supabase client
- `src/lib/supabase/server.ts` - server Supabase client
- `src/proxy.ts` - route protection (redirects to `/login` when unauthenticated)

## Notes
- If drag-drop fails, first verify target date is inside the active cycle range.
- Manager month calendar now intentionally hides out-of-range dates.
- Local and GitHub branch are synced when last verified.

## Docs
- `docs/DECISIONS.md`
- `docs/SETUP.md`
- `docs/DATABASE.md`
