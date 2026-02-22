# RT Scheduler — Project Context for Claude

## What this app is
A web app that replaces a manual paper scheduling grid for a respiratory therapy department.
It generates 6-week shift schedules, lets staff submit availability, and handles shift swaps.

## Current Status
- Step 3 of 6 in progress (Auth)
- Steps 1 & 2 complete (scaffold + database)
- Login, signup, and dashboard pages are built
- Bug: profile name not loading on dashboard (RLS policy conflict suspected)

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (new-york style)
- React 19 with React Compiler enabled (`reactCompiler: true` in `next.config.ts`)
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr` + `@supabase/supabase-js`
- Deploy target: Vercel + Supabase

## Roles
- `manager` — builds/edits schedules, approves swaps, views all availability
- `therapist` — submits availability, views published schedule, posts swap requests

New users who sign up via `/signup` are assigned `role: 'therapist'` by default.
Managers must be promoted manually in the database.

## Environment Variables
Required in `.env.local` (not committed to repo):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Database Tables
All tables include a `created_at` timestamp. Schema is managed in the Supabase dashboard — no migration files are committed to this repo. See `docs/DATABASE.md` for full schema and RLS policy documentation.

- **profiles** — id, full_name, email, role, shift_type, created_at
- **schedule_cycles** — id, label, start_date, end_date, published, created_at
- **shifts** — id, cycle_id, user_id, date, shift_type, status, created_at
- **availability_requests** — id, user_id, cycle_id, date, reason, created_at
- **shift_posts** — id, shift_id, posted_by, message, type, status, created_at

### RLS Summary
- Profiles: users see own row; managers see all
- Schedule cycles: everyone sees published; managers create/edit
- Shifts: everyone sees shifts in published cycles; managers manage all
- Availability requests: users see own; managers see all
- Shift posts: everyone can read; users manage own; managers approve/deny

## Key Files
```
src/
├── app/
│   ├── page.tsx                   — Homepage (no auth required)
│   ├── layout.tsx                 — Root layout (Geist font, metadata)
│   ├── login/page.tsx             — Login (client component, email/password)
│   ├── signup/page.tsx            — Signup (client component, collects full_name + shift_type)
│   ├── dashboard/page.tsx         — Dashboard (server component, role-aware)
│   └── auth/signout/route.ts      — POST signout handler → redirects to /login
├── middleware.ts                  — Route protection (unauthenticated → /login)
├── lib/
│   ├── supabase/
│   │   ├── client.ts              — Browser Supabase client (createBrowserClient)
│   │   └── server.ts              — Server Supabase client (createServerClient + cookies)
│   └── utils.ts                   — Shared utilities (cn helper)
└── components/
    └── ui/                        — shadcn/ui components: badge, button, card,
                                     dialog, input, label, table
```

## Auth Flow
1. `/signup` — collects full_name, email, password, shift_type; passes metadata to `supabase.auth.signUp()`; redirects to `/dashboard`
2. `/login` — email/password via `supabase.auth.signInWithPassword()`; redirects to `/dashboard`
3. `/auth/signout` — POST route calls `supabase.auth.signOut()`; redirects to `/login`
4. `middleware.ts` — runs on all routes (except `_next/static`, `_next/image`, `favicon.ico`); redirects unauthenticated users to `/login`
5. `dashboard/page.tsx` — server component; verifies session with `supabase.auth.getUser()`, fetches `profiles` row by `user.id`

## Known Issues
- Dashboard not displaying profile `full_name` or `role` — likely an RLS policy preventing the server-side profile fetch
- `src/app/layout.tsx` metadata still contains default Next.js template values ("Create Next App")

## Milestones
- [x] Step 1 — Repo scaffold
- [x] Step 2 — Database + RLS
- [ ] Step 3 — Auth (in progress)
- [ ] Step 4 — Availability requests
- [ ] Step 5 — Schedule grid
- [ ] Step 6 — Shift board + polish

## Pacing
Step Mode — one step at a time. Each step ends with "Reply DONE" to signal completion before moving to the next milestone.

## Docs
- `docs/DECISIONS.md` — Architecture and design decisions
- `docs/SETUP.md` — Local dev setup guide
- `docs/DATABASE.md` — Full schema with field types and RLS policy details

## Development Commands
```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run lint    # ESLint
```
