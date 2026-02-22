# Teamwise Scheduler - Project Context

Updated: 2026-02-22

## What this app is
Teamwise is a scheduling app replacing a manual paper grid for respiratory therapy staffing.
It supports cycle-based scheduling, availability requests, and shift board workflows.

## Current Product State
- Core pages are live: home, login, signup, dashboard, availability, schedule, shift board.
- Branding and UI have been updated to Teamwise.
- Manager scheduling supports both:
  - Auto-generate draft schedules (primary workflow)
  - Drag-and-drop month calendars for manual edits and hole-filling

## Scheduling Rules
- Weekly therapist target: exactly 3 worked days per week (Sun-Sat).
- Daily coverage target: 3 to 5 per shift type per day.
- Manager override is available when needed.
- Day and night are managed as separate coverage lanes.
- Managers can move therapists between day and night via drag/drop.

## Calendar UX
- Manager calendar view shows all months in the selected cycle date range.
- Each month renders:
  - Day Shift Calendar
  - Night Shift Calendar
- Coverage meter appears on each date card as `count/3-5`.
- Drag/drop supports:
  - Assign therapist from side panel to a date
  - Move existing shift between dates and shift types
  - Remove shift by dragging to remove zone
- Undo appears after drag/drop actions.

## Availability UX
- Duplicate availability requests are blocked.
- User gets an explicit error when trying to submit the same date in the same cycle.

## Roles
- `manager`: builds/edits schedules, publishes cycles, reviews availability, approves or denies shift posts.
- `therapist`: submits availability, views published schedule, posts swap/pickup requests.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Deploy target: Vercel + Supabase

## Environment and Scripts
Runtime `.env.local` keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Seed scripts:
- `npm run seed:demo`
- `npm run seed:users`

`seed:users` requires:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

New `/signup` users are created as `role: 'therapist'` by default.
Managers must be promoted manually in Supabase.

## Database Tables
- `profiles`: id, full_name, email, role, shift_type
- `schedule_cycles`: id, label, start_date, end_date, published
- `shifts`: id, cycle_id, user_id, date, shift_type, status
- `availability_requests`: id, user_id, cycle_id, date, reason
- `shift_posts`: id, shift_id, posted_by, message, type, status

## Key Files
- `src/app/schedule/page.tsx` - cycle controls, auto-generate, publish validation, schedule views
- `src/components/manager-month-calendar.tsx` - manager drag/drop calendars (day/night, coverage, undo)
- `src/app/api/schedule/drag-drop/route.ts` - drag/drop assign/move/remove + rule validation
- `src/app/availability/page.tsx` - availability form + duplicate prevention
- `src/app/dashboard/page.tsx` - role-aware dashboard
- `src/app/login/page.tsx` - login
- `src/app/signup/page.tsx` - signup
- `src/app/shift-board/page.tsx` - swap/pickup board
- `src/app/auth/signout/route.ts` - signout
- `src/lib/supabase/client.ts` - browser Supabase client
- `src/lib/supabase/server.ts` - server Supabase client
- `src/proxy.ts` - auth route protection

## Notes
- If drag/drop fails, first verify the drop date is inside the active cycle range.
- Manager month calendar intentionally hides out-of-range dates.

## Docs
- `docs/DECISIONS.md`
- `docs/SETUP.md`
- `docs/DATABASE.md`
