# Manager Workflow Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a canonical manager `Schedule` home, turn the old manager dashboard into an `Inbox`, and reframe manager schedule-adjacent pages under one consistent workflow hierarchy.

**Architecture:** Keep the existing detailed workflow pages (`/coverage`, `/availability`, `/approvals`, `/publish`, `/schedule`, `/analytics`) in place, but move manager primary navigation to `Inbox / Schedule / People` and add a new manager route at `/dashboard/manager/schedule`. Reuse shared manager workflow data sources so `Inbox` and the new `Schedule` home derive cycle state from the same truth as Coverage instead of introducing parallel heuristics.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind/shadcn UI, Vitest, Playwright.

---

## File Map

### New files

- Create: `src/app/(app)/dashboard/manager/schedule/page.tsx`
  - server route for the new manager schedule home
- Create: `src/components/manager/ManagerScheduleHome.tsx`
  - action-first manager schedule landing surface
- Create: `src/components/manager/ManagerScheduleHome.test.tsx`
  - component-level regression coverage for the new schedule home
- Create: `src/lib/manager-schedule-home.ts`
  - focused mapping helpers that turn manager attention/workflow data into schedule-home cards and CTA state
- Create: `src/lib/manager-schedule-home.test.ts`

### Existing files to modify

- Modify: `src/components/shell/app-shell-config.ts`
  - rename `Today` to `Inbox`
  - point manager `Schedule` primary nav to `/dashboard/manager/schedule`
  - add `Home` under the local `Schedule` section
  - keep `Coverage / Approvals / Publish / Availability / Roster / Analytics` nested under `Schedule`
- Modify: `src/components/AppShell.test.ts`
  - update nav expectations to match the new manager IA
- Modify: `src/lib/workflow-links.ts`
  - add the canonical manager schedule-home route
- Modify: `src/lib/workflow-links.test.ts`
- Modify: `src/lib/manager-workflow.ts`
  - add schedule-home-oriented links and preserve Coverage as the execution workspace
- Modify: `src/app/(app)/dashboard/manager/page.tsx`
  - narrow the existing page into inbox-first content and route messaging
- Modify: `src/components/manager/ManagerTriageDashboard.tsx`
  - rename and reframe UI copy from “Today” to `Inbox`
- Modify: `src/app/(app)/coverage/CoverageClientPage.tsx`
  - reframe labels and next-step copy so Coverage reads as the execution workspace reached from `Schedule`
- Modify: `src/app/(app)/approvals/page.tsx`
  - update subtitle and CTA copy to position Approvals within the schedule workflow
- Modify: `src/app/(app)/publish/page.tsx`
  - update title/supporting copy to position Publish as workflow stage + delivery history
- Modify: `src/app/(app)/availability/page.tsx`
  - update manager-facing heading/subtitle/entry copy to position Availability as a staffing input

### Verification files to inspect and extend if needed

- Inspect/possibly modify: `e2e/role-journeys.spec.ts`
  - add or extend a manager IA smoke path if existing helpers make that cheaper than a new spec

---

## Task 1: Lock the new manager route contracts and shell navigation

**Files:**

- Modify: `src/lib/workflow-links.ts`
- Modify: `src/lib/workflow-links.test.ts`
- Modify: `src/components/shell/app-shell-config.ts`
- Modify: `src/components/AppShell.test.ts`

- [ ] **Step 1: Write the failing nav/link tests**

Add expectations for:

```ts
expect(MANAGER_WORKFLOW_LINKS.scheduleHome).toBe('/dashboard/manager/schedule')
expect(buildManagerSections(0).find((section) => section.key === 'inbox')?.label).toBe('Inbox')
expect(buildManagerSections(0).find((section) => section.key === 'schedule')?.href).toBe(
  '/dashboard/manager/schedule'
)
expect(
  buildManagerSections(0)
    .find((section) => section.key === 'schedule')
    ?.subItems.map((item) => item.label)
).toEqual(['Home', 'Coverage', 'Approvals', 'Publish', 'Availability', 'Roster', 'Analytics'])
```

- [ ] **Step 2: Run the targeted tests to verify failure**

Run: `npm run test:unit -- src/lib/workflow-links.test.ts src/components/AppShell.test.ts`

Expected: FAIL because the new route key, labels, and local nav item ordering do not exist yet.

- [ ] **Step 3: Implement the minimal nav/link changes**

Update `src/lib/workflow-links.ts`:

```ts
export const MANAGER_WORKFLOW_LINKS = {
  dashboard: '/dashboard/manager',
  scheduleHome: '/dashboard/manager/schedule',
  approvals: '/approvals?status=pending',
  coverage: '/coverage?view=week',
  publish: '/coverage?view=week',
  team: '/team',
} as const
```

Update `src/components/shell/app-shell-config.ts` so the manager sections become:

```ts
{
  key: 'inbox',
  label: 'Inbox',
  href: MANAGER_WORKFLOW_LINKS.dashboard,
  isActive: (pathname) => pathname === '/dashboard/manager',
  subItems: [],
},
{
  key: 'schedule',
  label: 'Schedule',
  href: MANAGER_WORKFLOW_LINKS.scheduleHome,
  isActive: (pathname) =>
    pathname === MANAGER_WORKFLOW_LINKS.scheduleHome ||
    pathname === '/coverage' ||
    pathname === '/analytics' ||
    pathname === '/schedule' ||
    pathname === '/availability' ||
    pathname === '/publish' ||
    pathname.startsWith('/publish/') ||
    pathname === '/approvals',
  subItems: [
    { href: MANAGER_WORKFLOW_LINKS.scheduleHome, label: 'Home', active: (pathname) => pathname === MANAGER_WORKFLOW_LINKS.scheduleHome },
    { href: '/coverage', label: 'Coverage', active: (pathname) => pathname === '/coverage' },
    { href: '/approvals', label: 'Approvals', active: (pathname) => pathname === '/approvals' },
    { href: '/publish', label: 'Publish', active: (pathname) => pathname === '/publish' || pathname.startsWith('/publish/') },
    { href: '/availability', label: 'Availability', active: (pathname) => pathname === '/availability' },
    { href: '/schedule', label: 'Roster', active: (pathname) => pathname === '/schedule' },
    { href: '/analytics', label: 'Analytics', active: (pathname) => pathname === '/analytics' },
  ],
},
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `npm run test:unit -- src/lib/workflow-links.test.ts src/components/AppShell.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflow-links.ts src/lib/workflow-links.test.ts src/components/shell/app-shell-config.ts src/components/AppShell.test.ts
git commit -m "refactor: align manager shell around inbox and schedule"
```

## Task 2: Add the new manager Schedule home from shared manager workflow data

**Files:**

- Create: `src/lib/manager-schedule-home.ts`
- Create: `src/lib/manager-schedule-home.test.ts`
- Create: `src/components/manager/ManagerScheduleHome.tsx`
- Create: `src/components/manager/ManagerScheduleHome.test.tsx`
- Create: `src/app/(app)/dashboard/manager/schedule/page.tsx`
- Modify: `src/lib/manager-workflow.ts`

- [ ] **Step 1: Write failing helper tests for schedule-home mapping**

Cover:

```ts
it('prefers coverage as the primary action when the active cycle has unresolved staffing blockers', () => {
  expect(buildManagerScheduleHomeModel(fixtures.blockedDraft).primaryAction.href).toBe(
    '/coverage?cycle=cycle-1&view=week'
  )
})

it('surfaces approvals and publish readiness as workflow cards', () => {
  expect(
    buildManagerScheduleHomeModel(fixtures.readyDraft).workflowCards.map((card) => card.label)
  ).toEqual(['Coverage', 'Approvals', 'Publish', 'Availability'])
})
```

- [ ] **Step 2: Run the helper tests to verify failure**

Run: `npm run test:unit -- src/lib/manager-schedule-home.test.ts`

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the shared schedule-home model helpers**

Create `src/lib/manager-schedule-home.ts` with a focused builder such as:

```ts
export function buildManagerScheduleHomeModel(snapshot: ManagerAttentionSnapshot) {
  const primaryAction =
    snapshot.coverageIssues > 0
      ? {
          label: 'Continue staffing current block',
          href: snapshot.links.fixCoverage,
          description: 'Coverage blockers are preventing publish readiness.',
        }
      : snapshot.pendingApprovals > 0
        ? {
            label: 'Review pending approvals',
            href: snapshot.links.approvalsPending,
            description: 'Pending preliminary requests still need a decision.',
          }
        : {
            label: 'Review publish readiness',
            href: snapshot.links.publish,
            description: 'Coverage is clear. Confirm final readiness before publishing.',
          }

  return {
    primaryAction,
    workflowCards: [
      { label: 'Coverage', href: snapshot.links.coverage },
      { label: 'Approvals', href: snapshot.links.approvalsPending },
      { label: 'Publish', href: '/publish' },
      { label: 'Availability', href: '/availability' },
    ],
  }
}
```

- [ ] **Step 4: Write failing component tests for the new Schedule home**

Cover:

```tsx
render(<ManagerScheduleHome {...fixtureProps} />)
expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Continue staffing current block' })).toHaveAttribute(
  'href',
  '/coverage?cycle=cycle-1&view=week&filter=missing_lead&focus=first'
)
expect(screen.getByText('Coverage')).toBeInTheDocument()
expect(screen.getByText('Approvals')).toBeInTheDocument()
expect(screen.getByText('Publish')).toBeInTheDocument()
expect(screen.getByText('Availability')).toBeInTheDocument()
```

- [ ] **Step 5: Run the component tests to verify failure**

Run: `npm run test:unit -- src/components/manager/ManagerScheduleHome.test.tsx`

Expected: FAIL because the component and route do not exist yet.

- [ ] **Step 6: Implement the new route and component**

Create `src/app/(app)/dashboard/manager/schedule/page.tsx` that:

- verifies manager auth
- calls `getManagerAttentionSnapshot`
- maps it through `buildManagerScheduleHomeModel`
- renders `<ManagerScheduleHome ... />`

Create `src/components/manager/ManagerScheduleHome.tsx` with:

```tsx
<section>
  <h1>Schedule</h1>
  <p>
    Start with the next action for the current block, then move into the detailed workflow pages.
  </p>
  <Button asChild>
    <Link href={primaryAction.href}>{primaryAction.label}</Link>
  </Button>
</section>
```

Include:

- current cycle/status
- primary CTA
- compact blocker summary
- workflow cards for Coverage / Approvals / Publish / Availability
- secondary links for Roster / Analytics

- [ ] **Step 7: Re-run the helper and component tests**

Run: `npm run test:unit -- src/lib/manager-schedule-home.test.ts src/components/manager/ManagerScheduleHome.test.tsx`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/manager-schedule-home.ts src/lib/manager-schedule-home.test.ts src/components/manager/ManagerScheduleHome.tsx src/components/manager/ManagerScheduleHome.test.tsx src/app/(app)/dashboard/manager/schedule/page.tsx src/lib/manager-workflow.ts
git commit -m "feat: add manager schedule home"
```

## Task 3: Reframe the old manager dashboard into Inbox

**Files:**

- Modify: `src/app/(app)/dashboard/manager/page.tsx`
- Modify: `src/components/manager/ManagerTriageDashboard.tsx`

- [ ] **Step 1: Write the failing inbox-focused regression test**

Add a targeted assertion in a new or existing manager dashboard test surface using source-level checks if there is no rendered test yet:

```ts
expect(managerDashboardSource).toContain('Inbox')
expect(managerDashboardSource).not.toContain('Publish flow')
expect(managerDashboardSource).not.toContain('No active cycle')
```

If you add a component test instead, cover:

```tsx
render(<ManagerTriageDashboard {...fixtureProps} />)
expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
expect(screen.getByText('Pending approvals')).toBeInTheDocument()
expect(screen.queryByText('Current cycle')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the dashboard-focused test to verify failure**

Run: `npm run test:unit -- src/components/AppShell.test.ts src/components/manager/ManagerScheduleHome.test.tsx`

Expected: FAIL or missing expected Inbox semantics before the refactor.

- [ ] **Step 3: Implement the Inbox reframing**

Update `src/components/manager/ManagerTriageDashboard.tsx` so it:

- keeps the `Inbox` heading
- removes the contradictory schedule-authority summary cards
- keeps alerts, recent activity, coverage issues, pending approvals, and needs-review items
- changes top-right CTAs to workflow-friendly language such as:

```tsx
<Link href={MANAGER_WORKFLOW_LINKS.scheduleHome}>Open schedule home</Link>
<Link href={approvalsHref}>Review approvals</Link>
```

Update `src/app/(app)/dashboard/manager/page.tsx` to stop deriving dashboard copy that claims cycle authority; keep it focused on attention and review data.

- [ ] **Step 4: Re-run the targeted dashboard test**

Run: `npm run test:unit -- src/components/AppShell.test.ts src/components/manager/ManagerScheduleHome.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/dashboard/manager/page.tsx src/components/manager/ManagerTriageDashboard.tsx
git commit -m "refactor: narrow manager dashboard into inbox"
```

## Task 4: Reframe the detailed workflow pages under Schedule

**Files:**

- Modify: `src/app/(app)/coverage/CoverageClientPage.tsx`
- Modify: `src/app/(app)/approvals/page.tsx`
- Modify: `src/app/(app)/publish/page.tsx`
- Modify: `src/app/(app)/availability/page.tsx`

- [ ] **Step 1: Write failing copy/heading assertions**

Use source-level tests or focused render tests to lock the intended wording:

```ts
expect(coverageSource).toContain('execution workspace')
expect(approvalsSource).toContain('part of the current schedule workflow')
expect(publishSource).toContain('final stage of the same workflow')
expect(availabilitySource).toContain('staffing input')
```

If existing tests cover render text, prefer them over source assertions.

- [ ] **Step 2: Run the relevant tests to verify failure**

Run: `npm run test:unit -- src/components/AppShell.test.ts src/lib/workflow-links.test.ts`

Expected: at least one FAIL or missing expected copy after the new IA assumptions are introduced.

- [ ] **Step 3: Implement the page reframing**

Update:

- `CoverageClientPage.tsx`
  - change top subtitle/next-step copy to reinforce Coverage as the staffing execution workspace reached from Schedule home
- `approvals/page.tsx`
  - strengthen subtitle and empty-state CTA copy to place Approvals inside the active schedule workflow
- `publish/page.tsx`
  - change title/supporting copy so it reads as publish readiness plus delivery history, not a detached archive
- `availability/page.tsx`
  - tighten manager-facing heading/subtitle so Availability is clearly a staffing input to the same workflow

- [ ] **Step 4: Re-run the relevant tests**

Run: `npm run test:unit -- src/components/AppShell.test.ts src/lib/workflow-links.test.ts src/components/manager/ManagerScheduleHome.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/coverage/CoverageClientPage.tsx src/app/(app)/approvals/page.tsx src/app/(app)/publish/page.tsx src/app/(app)/availability/page.tsx
git commit -m "refactor: align manager workflow page framing"
```

## Task 5: Verify the manager workflow end-to-end

**Files:**

- Modify: `e2e/role-journeys.spec.ts` or create `e2e/manager-workflow-ia.spec.ts`

- [ ] **Step 1: Write the failing manager IA smoke test**

Cover:

```ts
test('manager shell routes through inbox and schedule home', async ({ page }) => {
  await loginAs(page, ctx.manager.email, ctx.manager.password)
  await expect(page.getByRole('link', { name: 'Inbox' })).toBeVisible()
  await page.getByRole('link', { name: 'Schedule' }).click()
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue staffing current block' })).toBeVisible()
})
```

- [ ] **Step 2: Run the targeted E2E spec to verify failure**

Run: `npm run test:e2e -- e2e/manager-workflow-ia.spec.ts`

Expected: FAIL before the new route and nav structure are fully wired.

- [ ] **Step 3: Implement any final wiring fixes exposed by the test**

Typical fixes:

- active-state mismatches
- wrong CTA hrefs
- missing local nav item labels
- wrong shell destination for primary `Schedule`

- [ ] **Step 4: Re-run unit and E2E verification**

Run:

```bash
npm run test:unit -- src/lib/workflow-links.test.ts src/components/AppShell.test.ts src/lib/manager-schedule-home.test.ts src/components/manager/ManagerScheduleHome.test.tsx
npm run test:e2e -- e2e/manager-workflow-ia.spec.ts
```

Expected: PASS

- [ ] **Step 5: Final quality checks**

Run:

```bash
npm run lint
npm run test:unit
```

Expected: PASS, or document any unrelated pre-existing failures before stopping.

- [ ] **Step 6: Commit**

```bash
git add e2e/manager-workflow-ia.spec.ts src
git commit -m "test: verify manager workflow unification"
```

---

## Self-Review

### Spec coverage

- Primary nav changes: covered by Task 1.
- New canonical Schedule home: covered by Task 2.
- Inbox reframing: covered by Task 3.
- Detailed-page reframing: covered by Task 4.
- Verification and trust regression checks: covered by Task 5.

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain.
- Every task names exact files, commands, and expected outcomes.

### Type consistency

- Canonical route name is consistently `/dashboard/manager/schedule`.
- Manager primary nav uses `Inbox`, `Schedule`, and `People`.
- Workflow row is consistently `Coverage / Approvals / Publish / Availability`.
