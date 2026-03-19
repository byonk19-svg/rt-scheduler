# Preliminary Schedule Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a staff-visible preliminary schedule workflow that managers can send before final publish, with live claim locking, change requests, manager approval, and in-app notifications only.

**Architecture:** Add a preliminary-schedule layer on top of existing `schedule_cycles` and `shifts` instead of duplicating the real schedule as a second publish system. Keep manager ownership in the current coverage/publish flow, add therapist-facing preliminary pages plus a manager approvals queue, and centralize reservation and approval rules in small server-side helpers and RPC-safe server actions.

**Tech Stack:** Next.js App Router, Supabase Postgres/Auth/RLS, server actions, Tailwind/shadcn patterns, Vitest, Playwright.

---

## File Map

### New database files

- Create: `supabase/migrations/20260319113000_add_preliminary_schedule_tables.sql`
  - preliminary snapshot, shift-state, request tables
  - indexes and uniqueness constraints
  - minimal RLS policies or RPC grants if needed

### New shared library files

- Create: `src/lib/preliminary-schedule/types.ts`
  - shared TS types for snapshot state, request types, and approval statuses
- Create: `src/lib/preliminary-schedule/selectors.ts`
  - mapping DB rows into manager and therapist UI models
- Create: `src/lib/preliminary-schedule/mutations.ts`
  - focused helpers for send snapshot, claim slot, request change, approve, deny, refresh snapshot
- Create: `src/lib/preliminary-schedule/notifications.ts`
  - wraps `notifyUsers` for preliminary-specific titles/messages
- Create: `src/lib/preliminary-schedule/selectors.test.ts`
- Create: `src/lib/preliminary-schedule/mutations.test.ts`

### Manager route files

- Modify: `src/app/coverage/page.tsx`
  - add `Send preliminary` entry point and status badge
- Modify: `src/app/schedule/actions.ts`
  - wire preliminary send/refresh action if coverage page already imports from here
- Replace: `src/app/approvals/page.tsx`
  - stop redirecting to shift board
  - render manager queue for preliminary requests and existing approval work, or at minimum preliminary requests first
- Create: `src/app/approvals/actions.ts`
  - server actions for approve/deny preliminary requests
- Create: `src/app/approvals/preliminary-requests.test.tsx` or `src/app/approvals/page.test.tsx`

### Therapist route files

- Create: `src/app/preliminary/page.tsx`
  - therapist-facing preliminary schedule route
- Create: `src/app/preliminary/actions.ts`
  - claim-open-slot and request-change actions
- Create: `src/components/preliminary/PreliminaryScheduleView.tsx`
- Create: `src/components/preliminary/PreliminaryShiftCard.tsx`
- Create: `src/components/preliminary/PreliminaryRequestHistory.tsx`
- Create: `src/components/preliminary/PreliminaryScheduleView.test.tsx`

### Notification and navigation files

- Modify: `src/lib/notifications.ts`
  - add target support if preliminary records need new notification routing
- Modify: `src/components/NotificationBell.tsx`
  - route preliminary notifications to `/preliminary` or `/approvals`
- Modify: `src/components/AppShell.tsx`
  - add therapist-accessible preliminary nav item if approved by product direction

### Existing schedule and approval-adjacent files to inspect during implementation

- Inspect/possibly modify: `src/app/shift-board/page.tsx`
  - reuse patterns for request history and status chips where useful
- Inspect/possibly modify: `src/app/requests/new/page.tsx`
  - reuse therapist request UI conventions

### End-to-end and regression tests

- Create: `e2e/preliminary-schedule.spec.ts`
  - full manager/therapist workflow

### Docs

- Modify: `CLAUDE.md`
  - document new preliminary schedule flow, migration, and route behavior

---

## Chunk 1: Data Model And Core Rules

### Task 1: Add the preliminary schedule schema

**Files:**

- Create: `supabase/migrations/20260319113000_add_preliminary_schedule_tables.sql`
- Test: validate with local/remote `supabase db push`

- [ ] **Step 1: Write the migration with explicit constraints**

Include:

```sql
create table public.preliminary_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.schedule_cycles (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  sent_at timestamptz not null default now(),
  status text not null check (status in ('active', 'superseded', 'closed')),
  created_at timestamptz not null default now()
);

create unique index preliminary_snapshots_one_active_per_cycle_idx
on public.preliminary_snapshots (cycle_id)
where status = 'active';

create table public.preliminary_shift_states (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  state text not null check (state in ('tentative_assignment', 'open', 'pending_claim', 'pending_change')),
  reserved_by uuid references public.profiles (id),
  active_request_id uuid,
  updated_at timestamptz not null default now(),
  unique (snapshot_id, shift_id)
);

create table public.preliminary_requests (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  requester_id uuid not null references public.profiles (id),
  type text not null check (type in ('claim_open_shift', 'request_change')),
  status text not null check (status in ('pending', 'approved', 'denied', 'cancelled')),
  note text,
  decision_note text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add supporting indexes**

Add indexes for:

- `preliminary_requests(snapshot_id, status, created_at desc)`
- `preliminary_requests(requester_id, created_at desc)`
- `preliminary_shift_states(snapshot_id, state)`

- [ ] **Step 3: Add FK from `preliminary_shift_states.active_request_id` after `preliminary_requests` exists**

```sql
alter table public.preliminary_shift_states
add constraint preliminary_shift_states_active_request_id_fkey
foreign key (active_request_id) references public.preliminary_requests (id) on delete set null;
```

- [ ] **Step 4: Push migration**

Run: `supabase db push`

Expected:

- migration applies without history drift
- new tables and indexes appear remotely

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260319113000_add_preliminary_schedule_tables.sql
git commit -m "feat: add preliminary schedule schema"
```

### Task 2: Add shared preliminary types and selectors

**Files:**

- Create: `src/lib/preliminary-schedule/types.ts`
- Create: `src/lib/preliminary-schedule/selectors.ts`
- Create: `src/lib/preliminary-schedule/selectors.test.ts`

- [ ] **Step 1: Write failing selector tests**

Cover:

- active snapshot selection
- open slot mapping
- pending claim mapping
- therapist request history grouping
- manager queue grouping

Example:

```ts
it('maps a claimed open shift to pending claim state', () => {
  expect(toPreliminaryShiftCard(/* fixture */).state).toBe('pending_claim')
})
```

- [ ] **Step 2: Run the selector tests to verify failure**

Run: `npm run test:unit -- src/lib/preliminary-schedule/selectors.test.ts`

Expected: FAIL because files/functions do not exist yet

- [ ] **Step 3: Implement minimal shared types**

Define:

- `PreliminarySnapshotStatus`
- `PreliminaryShiftState`
- `PreliminaryRequestType`
- `PreliminaryRequestStatus`
- manager queue item type
- therapist card/history item types

- [ ] **Step 4: Implement selector helpers**

Include focused pure functions such as:

- `getActivePreliminarySnapshot`
- `toPreliminaryShiftCard`
- `toTherapistPreliminaryHistory`
- `toManagerPreliminaryQueue`

- [ ] **Step 5: Run the selector tests to verify pass**

Run: `npm run test:unit -- src/lib/preliminary-schedule/selectors.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/preliminary-schedule/types.ts src/lib/preliminary-schedule/selectors.ts src/lib/preliminary-schedule/selectors.test.ts
git commit -m "feat: add preliminary schedule selectors"
```

### Task 3: Add server-side mutation helpers for reservation and approval rules

**Files:**

- Create: `src/lib/preliminary-schedule/mutations.ts`
- Create: `src/lib/preliminary-schedule/mutations.test.ts`
- Inspect: `src/lib/notifications.ts`

- [ ] **Step 1: Write failing mutation tests**

Cover:

- send snapshot creates one active snapshot per cycle
- claim request reserves open slot immediately
- second claim on same slot is rejected
- change request allowed only on requester's own shift
- approve claim fills state
- deny claim releases state
- refresh snapshot updates in place instead of creating staff-visible duplicates

- [ ] **Step 2: Run the mutation tests to verify failure**

Run: `npm run test:unit -- src/lib/preliminary-schedule/mutations.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement minimal helper surface**

Create focused functions:

- `sendPreliminarySnapshot`
- `refreshPreliminarySnapshot`
- `submitPreliminaryClaimRequest`
- `submitPreliminaryChangeRequest`
- `approvePreliminaryRequest`
- `denyPreliminaryRequest`

These helpers must accept a server Supabase client and explicit actor IDs rather than reading auth internally.

- [ ] **Step 4: Add optimistic-safe reservation rules**

Implement DB checks inside helpers so a second claimant gets a clean domain error like:

```ts
throw new Error('slot_already_reserved')
```

- [ ] **Step 5: Run the mutation tests to verify pass**

Run: `npm run test:unit -- src/lib/preliminary-schedule/mutations.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/preliminary-schedule/mutations.ts src/lib/preliminary-schedule/mutations.test.ts
git commit -m "feat: add preliminary schedule mutation helpers"
```

## Chunk 2: Manager Flow

### Task 4: Add manager send/refresh preliminary actions from the schedule workflow

**Files:**

- Modify: `src/app/coverage/page.tsx`
- Modify: `src/app/schedule/actions.ts`
- Inspect: `src/app/dashboard/manager/page.tsx`

- [ ] **Step 1: Write the failing manager action test**

If there is no existing test file for schedule actions, create:

- `src/app/schedule/preliminary-actions.test.ts`

Cover:

- manager can send preliminary for a draft cycle
- non-manager is denied
- repeat send refreshes active snapshot instead of making a second active row

- [ ] **Step 2: Run the targeted manager action tests**

Run: `npm run test:unit -- src/app/schedule/preliminary-actions.test.ts`

Expected: FAIL

- [ ] **Step 3: Add `send preliminary` server action**

Use existing auth pattern from `src/app/schedule/actions.ts` and call `sendPreliminarySnapshot`.

- [ ] **Step 4: Surface preliminary status on `/coverage`**

Add:

- `Send preliminary` button for managers
- status chip like `Preliminary live`
- `Refresh preliminary` button when already active

Reuse existing page header/action styling on `/coverage`.

- [ ] **Step 5: Re-run manager action tests**

Run: `npm run test:unit -- src/app/schedule/preliminary-actions.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/coverage/page.tsx src/app/schedule/actions.ts src/app/schedule/preliminary-actions.test.ts
git commit -m "feat: add manager preliminary send action"
```

### Task 5: Replace approvals redirect with a real preliminary approvals queue

**Files:**

- Modify: `src/app/approvals/page.tsx`
- Create: `src/app/approvals/actions.ts`
- Create or Modify: `src/app/approvals/page.test.tsx`

- [ ] **Step 1: Write failing approvals page tests**

Cover:

- page loads pending preliminary requests
- approve action updates request and preliminary state
- deny action releases pending claim
- non-manager redirect still applies

- [ ] **Step 2: Run the approvals tests to verify failure**

Run: `npm run test:unit -- src/app/approvals/page.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement page and actions**

Replace the current redirect-only behavior with:

- pending queue cards
- request type chip
- note text
- approve button
- deny button

Use small server actions in `src/app/approvals/actions.ts` that call the shared mutation helpers.

- [ ] **Step 4: Revalidate the relevant routes after approval actions**

Revalidate:

- `/approvals`
- `/preliminary`
- `/coverage`
- `/dashboard/manager`

- [ ] **Step 5: Re-run approvals tests**

Run: `npm run test:unit -- src/app/approvals/page.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/approvals/page.tsx src/app/approvals/actions.ts src/app/approvals/page.test.tsx
git commit -m "feat: add preliminary approvals queue"
```

## Chunk 3: Therapist Preliminary Experience

### Task 6: Build the therapist preliminary schedule route and request actions

**Files:**

- Create: `src/app/preliminary/page.tsx`
- Create: `src/app/preliminary/actions.ts`
- Create: `src/components/preliminary/PreliminaryScheduleView.tsx`
- Create: `src/components/preliminary/PreliminaryShiftCard.tsx`
- Create: `src/components/preliminary/PreliminaryRequestHistory.tsx`
- Create: `src/components/preliminary/PreliminaryScheduleView.test.tsx`

- [ ] **Step 1: Write failing therapist view tests**

Cover:

- therapist sees active preliminary snapshot
- assigned shift shows `Request change`
- open slot shows `Claim shift`
- pending claim state disables duplicate interaction in UI
- request history shows pending/approved/denied items

- [ ] **Step 2: Run therapist view tests to verify failure**

Run: `npm run test:unit -- src/components/preliminary/PreliminaryScheduleView.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement the route loader**

`src/app/preliminary/page.tsx` should:

- require logged-in active therapist/lead/manager
- load active preliminary snapshot for the relevant cycle
- map data with selectors
- render the new client component

- [ ] **Step 4: Implement therapist actions**

`src/app/preliminary/actions.ts` should expose:

- `claimPreliminaryShiftAction`
- `requestPreliminaryChangeAction`
- `cancelPreliminaryRequestAction`

All must validate current user ownership and active status.

- [ ] **Step 5: Implement the UI**

Keep it simpler than manager staffing:

- clear `Preliminary Schedule` header
- status chips: `Tentative`, `Open`, `Pending claim`, `Pending change`
- one primary CTA per card
- lightweight note input in modal or inline expander
- request history below the main schedule list

- [ ] **Step 6: Re-run therapist view tests**

Run: `npm run test:unit -- src/components/preliminary/PreliminaryScheduleView.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/preliminary/page.tsx src/app/preliminary/actions.ts src/components/preliminary/PreliminaryScheduleView.tsx src/components/preliminary/PreliminaryShiftCard.tsx src/components/preliminary/PreliminaryRequestHistory.tsx src/components/preliminary/PreliminaryScheduleView.test.tsx
git commit -m "feat: add therapist preliminary schedule view"
```

### Task 7: Add preliminary notifications and navigation

**Files:**

- Modify: `src/lib/notifications.ts`
- Create: `src/lib/preliminary-schedule/notifications.ts`
- Modify: `src/components/NotificationBell.tsx`
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Write failing tests for routing and notification payloads**

Create targeted tests if missing:

- `src/lib/preliminary-schedule/notifications.test.ts`
- `src/components/NotificationBell.test.tsx`

Cover:

- `preliminary sent` notification targets `/preliminary`
- `preliminary request approved/denied` targets `/preliminary`
- manager review notification targets `/approvals`

- [ ] **Step 2: Run notification tests to verify failure**

Run: `npm run test:unit -- src/lib/preliminary-schedule/notifications.test.ts src/components/NotificationBell.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement preliminary notification wrapper**

Add small helpers like:

- `notifyPreliminarySent`
- `notifyPreliminaryRequestApproved`
- `notifyPreliminaryRequestDenied`
- `notifyManagerOfPreliminaryRequest`

- [ ] **Step 4: Update notification routing and shell nav**

`NotificationBell` should send preliminary events to `/preliminary` or `/approvals`.

If the product accepts a nav item, add:

- manager: `Approvals` remains
- therapist: `Preliminary Schedule`

If nav space is too tight, keep it reachable from dashboard cards instead.

- [ ] **Step 5: Re-run notification tests**

Run: `npm run test:unit -- src/lib/preliminary-schedule/notifications.test.ts src/components/NotificationBell.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications.ts src/lib/preliminary-schedule/notifications.ts src/lib/preliminary-schedule/notifications.test.ts src/components/NotificationBell.tsx src/components/NotificationBell.test.tsx src/components/AppShell.tsx
git commit -m "feat: add preliminary schedule notifications"
```

## Chunk 4: Full Workflow Verification And Documentation

### Task 8: Add end-to-end coverage for the live preliminary workflow

**Files:**

- Create: `e2e/preliminary-schedule.spec.ts`

- [ ] **Step 1: Write the E2E test**

Seed:

- one manager
- two therapists
- one draft cycle
- one open shift
- one assigned tentative shift

Scenario:

1. manager sends preliminary
2. therapist A sees preliminary
3. therapist A claims open shift
4. therapist B can no longer claim that same slot
5. therapist A requests change on an assigned shift
6. manager approves one request and denies one request
7. therapist view updates live after reload

- [ ] **Step 2: Run the E2E test and make sure it fails first**

Run: `npm run test:e2e -- e2e/preliminary-schedule.spec.ts`

Expected: FAIL before implementation is complete

- [ ] **Step 3: Fix only the remaining integration gaps**

Do not add unrelated polish here. Only close the failures exposed by the scenario.

- [ ] **Step 4: Re-run the E2E test**

Run: `npm run test:e2e -- e2e/preliminary-schedule.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add e2e/preliminary-schedule.spec.ts
git commit -m "test: cover preliminary schedule workflow"
```

### Task 9: Final verification, docs, and handoff

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update handoff docs**

Document:

- new migration filename
- `/preliminary` route behavior
- `/approvals` now includes preliminary requests
- live lock behavior for open-slot claims
- in-app notification only behavior

- [ ] **Step 2: Run the focused verification set**

Run:

```bash
npm run test:unit -- src/lib/preliminary-schedule/selectors.test.ts src/lib/preliminary-schedule/mutations.test.ts src/components/preliminary/PreliminaryScheduleView.test.tsx src/app/approvals/page.test.tsx src/app/schedule/preliminary-actions.test.ts
npm run test:e2e -- e2e/preliminary-schedule.spec.ts
```

Expected:

- all targeted tests PASS

- [ ] **Step 3: Run the full production build**

Run:

```bash
npm run build
```

Expected:

- PASS

Windows note:

- if `.next` is locked, stop the repo-local `next dev` process before rerunning

- [ ] **Step 4: Commit final docs and glue changes**

```bash
git add CLAUDE.md
git commit -m "docs: record preliminary schedule workflow"
```

---

## Execution Notes

- Follow TDD strictly for each task.
- Keep actions and selectors small; do not bury business rules in page components.
- Reuse the existing `notifyUsers` helper instead of creating a second notification channel.
- Reuse current role/permission checks through `can(...)`, extending only if a new permission is genuinely needed.
- Keep final publish separate from preliminary approval at every layer: database, actions, UI wording, and notifications.

## Suggested Commit Order

1. `feat: add preliminary schedule schema`
2. `feat: add preliminary schedule selectors`
3. `feat: add preliminary schedule mutation helpers`
4. `feat: add manager preliminary send action`
5. `feat: add preliminary approvals queue`
6. `feat: add therapist preliminary schedule view`
7. `feat: add preliminary schedule notifications`
8. `test: cover preliminary schedule workflow`
9. `docs: record preliminary schedule workflow`
