# RT Scheduler - Project Context for Claude

## What this app is
A web app that replaces a manual paper scheduling grid for a respiratory therapy department.
It generates 6-week shift schedules, lets staff submit availability, and handles shift swaps.

## Current Status
- Step 6 of 6 completed (Shift board + polish)
- Steps 1 through 5 completed (scaffold, database, auth, availability, schedule grid)
- Login, signup, dashboard, availability, schedule, and shift board pages are live

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Deploy target: Vercel + Supabase

## Roles
- `manager` - builds and edits schedules, publishes cycles, reviews availability, approves or denies shift posts
- `therapist` - submits availability, views published schedule, posts swap or pickup requests

## Database Tables
- profiles - id, full_name, email, role, shift_type
- schedule_cycles - id, label, start_date, end_date, published
- shifts - id, cycle_id, user_id, date, shift_type, status
- availability_requests - id, user_id, cycle_id, date, reason
- shift_posts - id, shift_id, posted_by, message, type, status

## Key Files
- `src/app/page.tsx` - home page
- `src/app/login/page.tsx` - login page
- `src/app/signup/page.tsx` - signup page
- `src/app/dashboard/page.tsx` - role-aware dashboard
- `src/app/availability/page.tsx` - availability request workflow
- `src/app/schedule/page.tsx` - schedule cycle and grid workflow
- `src/app/shift-board/page.tsx` - swap/pickup shift board workflow
- `src/app/auth/signout/route.ts` - signout handler
- `src/lib/supabase/client.ts` - browser Supabase client
- `src/lib/supabase/server.ts` - server Supabase client
- `src/proxy.ts` - route protection (redirects to /login if not authed)

## Milestones
- [x] Step 1 - Repo scaffold
- [x] Step 2 - Database + RLS
- [x] Step 3 - Auth
- [x] Step 4 - Availability requests
- [x] Step 5 - Schedule grid
- [x] Step 6 - Shift board + polish

## Pacing
Step Mode (one step at a time, ends with "Reply DONE")

## Docs
- docs/DECISIONS.md
- docs/SETUP.md
- docs/DATABASE.md
