# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-02-22

## What This App Is
Teamwise is a respiratory therapy scheduling app replacing manual paper workflows.
Core modules: schedule cycles, availability requests, shift board swaps/pickups, manager approvals, and publish workflow.

## Current Branch Snapshot
- Active branch: `claude/write-claude-md-YSz8m`
- Latest pushed commit at handoff: `39317c9`
- `repomix-output.xml` is intentionally untracked and not pushed.

## Product Status
Core routes:
- `/` home/marketing
- `/login`
- `/signup`
- `/dashboard` (role redirect)
- `/dashboard/manager`
- `/dashboard/staff`
- `/availability`
- `/schedule`
- `/shift-board`
- `/profile`

Role model:
- `manager`
- `therapist`

## Scheduling Rules (Current)
- Weekly rule: therapist max 3 worked days per Sun-Sat week.
- Coverage rule: 3-5 therapists per day/night slot.
- Lead rule (Option A on `shifts`):
  - exactly one designated lead (`role='lead'`) per shift slot `(cycle_id, date, shift_type)`
  - designated lead must be `profiles.is_lead_eligible = true`
  - lead-eligible therapists can still be assigned as `role='staff'`
- Manager can override weekly/certain constraints where supported.

## Manager Workflow UX (Current)
- Top nav flow: `Dashboard` -> `Approvals` -> `Coverage` -> `Publish`
- Manager Dashboard improvements:
  - `Needs attention` strip as source for high-level counts
  - coverage breakdown support (missing lead, under, over)
  - publish checklist with blocker CTA
  - quick actions row reduced to actions only
- Coverage deep-link behavior:
  - `?filter=missing_lead&focus=first` supported on schedule calendar view
  - month calendar scrolls to first problematic slot and highlights it briefly

## Manager Directory Feature
- Manager dashboard includes editable team directory sections:
  - Day Shift Directory
  - Night Shift Directory
- Data source: signed-up therapist `profiles`
- Editable fields:
  - name
  - email
  - phone number
- Phone formatting:
  - normalizes to `(###) ###-####`
  - supports common US-style inputs
  - invalid phone length shows validation toast

## Technical Stack
- Next.js 16 App Router + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth + Postgres + RLS)
- Playwright for e2e
- Vitest for unit tests
- Vercel deployment target

## Environment and Scripts
Required runtime vars in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional/admin scripts:
- `npm run seed:demo`
- `npm run seed:users` (requires `SUPABASE_SERVICE_ROLE_KEY`)

Quality scripts:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## Database Notes
Main tables:
- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests`
- `shift_posts`

Recent migrations to know:
- `20260222191647_add_lead_eligibility_and_designated_lead.sql`
  - adds `profiles.is_lead_eligible`
  - adds enum `shift_role`
  - adds `shifts.role`
  - adds partial unique index for one lead per slot
  - adds RPC `set_designated_shift_lead(...)`
- `20260222195508_add_profile_phone_and_manager_profile_update_policy.sql`
  - adds `profiles.phone_number`
  - adds manager profile update RLS policy

Rollback files exist in `supabase/rollback/` for both migrations above.

## Key Files
- `src/app/dashboard/manager/page.tsx` - manager dashboard + team directory edit actions
- `src/components/ManagerAttentionPanel.tsx` - attention strip + CTA hierarchy
- `src/lib/manager-workflow.ts` - single derived dashboard summary
- `src/app/schedule/actions.ts` - publish validation + designated lead action
- `src/lib/schedule-rule-validation.ts` - weekly/coverage/lead validation summaries
- `src/components/manager-month-calendar.tsx` - coverage filtering + focus-to-first issue behavior
- `src/app/api/schedule/drag-drop/route.ts` - drag/drop assignment/move/remove constraints
- `src/proxy.ts` - auth route protection

## Quick Resume Checklist
1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npm run lint`
5. `npm run test:unit`
6. `npm run build`
7. `npm run dev`
8. Verify:
   - manager dashboard attention + publish checklist
   - cycle creation and schedule views
   - designated lead flow + missing lead warnings
   - manager directory edits (name/email/phone)
