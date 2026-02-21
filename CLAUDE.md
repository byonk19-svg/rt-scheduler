# RT Scheduler — Project Context for Claude

## What this app is
A web app that replaces a manual paper scheduling grid for a respiratory therapy department.
It generates 6-week shift schedules, lets staff submit availability, and handles shift swaps.

## Current Status
- Step 3 of 6 in progress (Auth)
- Steps 1 & 2 complete (scaffold + database)
- Login, signup, and dashboard pages are built
- Bug: profile name not loading on dashboard (debugging in progress)

## Tech Stack
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Deploy target: Vercel + Supabase

## Roles
- `manager` — builds/edits schedules, approves swaps, views all availability
- `therapist` — submits availability, views published schedule, posts swap requests

## Database Tables
- profiles — id, full_name, email, role, shift_type
- schedule_cycles — id, label, start_date, end_date, published
- shifts — id, cycle_id, user_id, date, shift_type, status
- availability_requests — id, user_id, cycle_id, date, reason
- shift_posts — id, shift_id, posted_by, message, type, status

## Key Files
- src/app/page.tsx — homepage
- src/app/login/page.tsx — login page
- src/app/signup/page.tsx — signup page
- src/app/dashboard/page.tsx — dashboard (role-aware, bug in progress)
- src/app/auth/signout/route.ts — signout handler
- src/lib/supabase/client.ts — browser Supabase client
- src/lib/supabase/server.ts — server Supabase client
- src/middleware.ts — route protection (redirects to /login if not authed)

## Known Issues
- Dashboard not loading profile name/role — RLS policy conflict suspected
- Debugging: added console.log to dashboard to check profile fetch error

## Milestones
- [x] Step 1 — Repo scaffold
- [x] Step 2 — Database + RLS
- [ ] Step 3 — Auth (in progress)
- [ ] Step 4 — Availability requests
- [ ] Step 5 — Schedule grid
- [ ] Step 6 — Shift board + polish

## Pacing
Step Mode (one step at a time, ends with "Reply DONE")

## Docs
- docs/DECISIONS.md
- docs/SETUP.md
- docs/DATABASE.md