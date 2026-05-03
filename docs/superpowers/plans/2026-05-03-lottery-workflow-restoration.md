# Lottery Workflow Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the missing manager-facing Lottery workflow so managers can always reach a real `/lottery` page from both the shell navigation and the inbox.

**Architecture:** Treat this as a restore-and-promote lane, not a greenfield feature. Reuse the verified Lottery implementation preserved in `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\...`, restore the missing page/component/service/API files into the active checkout, then wire the existing manager IA seams (`workflow-links`, `app-shell-config`, manager inbox) to that canonical route.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase server/admin clients, Vitest, Playwright

---

## File Map

| File                                                                 | Change | Responsibility                                                                                       |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `src/lib/workflow-links.ts`                                          | Modify | Add canonical `lottery` manager workflow destination                                                 |
| `src/components/shell/app-shell-config.ts`                           | Modify | Add `/lottery` to shell route allowlist, manager Schedule active-state logic, and Schedule local nav |
| `src/components/shell/app-shell-config.test.ts`                      | Modify | Lock shell grouping and `/lottery` active-nav behavior                                               |
| `src/components/manager/ManagerTriageDashboard.tsx`                  | Modify | Add always-visible Lottery workflow card to the inbox main column                                    |
| `src/components/manager/ManagerTriageDashboard.test.ts`              | Modify | Lock Lottery card copy, href, and placement                                                          |
| `src/app/(app)/dashboard/manager/page.tsx`                           | Modify | Pass canonical `lotteryHref` into the inbox component                                                |
| `src/app/(app)/route-metadata.test.ts`                               | Modify | Add `/lottery` metadata sweep coverage                                                               |
| `src/app/(app)/lottery/page.tsx`                                     | Create | Server page entry for manager-facing Lottery route                                                   |
| `src/app/(app)/lottery/page.test.ts`                                 | Create | Lock auth redirect, manager gating, and snapshot handoff                                             |
| `src/components/lottery/LotteryClientPage.tsx`                       | Create | Client-side Lottery workspace UI restored from verified worktree source                              |
| `src/lib/lottery/service.ts`                                         | Create | Shared Lottery actor loading, snapshot loading, request/list/apply/history service surface           |
| `src/lib/lottery/recommendation.ts`                                  | Create | Lottery recommendation logic restored from verified source                                           |
| `src/lib/lottery/recommendation.test.ts`                             | Create | Lock recommendation behavior before/with restore                                                     |
| `src/lib/lottery/status-reconciliation.ts`                           | Create | Keep Lottery apply/undo aligned with assignment-status truth                                         |
| `src/lib/lottery/status-reconciliation.test.ts`                      | Create | Lock reconciliation behavior                                                                         |
| `src/app/api/lottery/workflow-routes.test.ts`                        | Create | Lock request/list/apply/history route contracts before restore                                       |
| `src/app/api/lottery/{apply,history,list,request,snapshot}/route.ts` | Create | Restore Lottery API route surface                                                                    |
| `e2e/lottery-workflow.spec.ts`                                       | Create | Restore the verified end-to-end Lottery workflow regression                                          |

### Restore Source

Use the existing verified worktree as the content source of truth for missing Lottery files:

- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\app\(app)\lottery\page.tsx`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\components\lottery\LotteryClientPage.tsx`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\lib\lottery\{service,recommendation,status-reconciliation}.ts`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\lib\lottery\{recommendation,status-reconciliation}.test.ts`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\app\api\lottery\workflow-routes.test.ts`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\app\api\lottery\{apply,history,list,request,snapshot}\route.ts`
- `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\e2e\lottery-workflow.spec.ts`

Do not redesign these files while restoring them. First restore behavior faithfully, then make only the minimum integration adjustments required by the active checkout.

---

### Task 1: Restore manager shell Lottery contracts

**Files:**

- Modify: `src/lib/workflow-links.ts`
- Modify: `src/components/shell/app-shell-config.ts`
- Modify: `src/components/shell/app-shell-config.test.ts`

- [ ] **Step 1: Add failing shell tests for Lottery**

  In `src/components/shell/app-shell-config.test.ts`, add a new test block that proves all three shell-level expectations:

  ```ts
  it('treats /lottery as a manager Schedule workflow', () => {
    const sections = buildManagerSections(0)
    const scheduleSection = sections.find((section) => section.key === 'schedule')

    expect(scheduleSection?.subItems.map((item) => item.label)).toEqual([
      'Schedule workspace',
      'Roster view',
      'Analytics',
      'Availability',
      'Publish',
      'Approvals',
      'Lottery',
    ])
    expect(scheduleSection?.subItems.find((item) => item.label === 'Lottery')?.href).toBe(
      '/lottery'
    )

    const context = getShellContext({
      pathname: '/lottery',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('schedule')
    expect(
      context.localNav?.items.find((item) => item.label === 'Lottery')?.active('/lottery')
    ).toBe(true)
  })
  ```

- [ ] **Step 2: Run the shell test and verify it fails**

  Run:

  ```powershell
  npx vitest run "src/components/shell/app-shell-config.test.ts"
  ```

  Expected: FAIL because `Lottery` does not exist in `buildManagerSections()` and `/lottery` is not schedule-active yet.

- [ ] **Step 3: Implement the minimal shell restore**

  Update `src/lib/workflow-links.ts` to add the canonical link:

  ```ts
  export const MANAGER_WORKFLOW_LINKS = {
    dashboard: '/dashboard/manager',
    approvals: '/approvals?status=pending',
    coverage: '/coverage?view=week',
    publish: '/coverage?view=week',
    lottery: '/lottery',
    team: '/team',
  } as const
  ```

  Then update `src/components/shell/app-shell-config.ts` in three places:

  ```ts
  const SHELL_ROUTES = [
    '/dashboard',
    '/coverage',
    '/analytics',
    '/availability',
    '/shift-board',
    '/publish',
    '/profile',
    '/approvals',
    '/preliminary',
    '/requests',
    '/notifications',
    '/swaps',
    '/team',
    '/settings',
    '/therapist',
    '/schedule',
    '/lottery',
  ] as const
  ```

  ```ts
  function isManagerScheduleRoute(pathname: string): boolean {
    return (
      pathname === '/coverage' ||
      pathname === '/analytics' ||
      pathname === '/schedule' ||
      pathname === '/availability' ||
      pathname === '/publish' ||
      pathname.startsWith('/publish/') ||
      pathname === '/approvals' ||
      pathname === '/lottery'
    )
  }
  ```

  ```ts
  {
    href: MANAGER_WORKFLOW_LINKS.lottery,
    label: 'Lottery',
    active: (pathname) => pathname === '/lottery',
  },
  ```

  Append the new local item after `Approvals` to minimize churn in the existing Schedule ordering.

- [ ] **Step 4: Re-run the shell test and verify it passes**

  Run:

  ```powershell
  npx vitest run "src/components/shell/app-shell-config.test.ts"
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the shell contract restore**

  ```powershell
  git add src/lib/workflow-links.ts src/components/shell/app-shell-config.ts src/components/shell/app-shell-config.test.ts
  git commit -m "Restore Lottery in the manager shell contract"
  ```

---

### Task 2: Add the inbox Lottery workflow card

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.test.ts`
- Modify: `src/components/manager/ManagerTriageDashboard.tsx`
- Modify: `src/app/(app)/dashboard/manager/page.tsx`

- [ ] **Step 1: Add a failing inbox card test**

  In `src/components/manager/ManagerTriageDashboard.test.ts`, add a test proving the inbox renders a stable Lottery card with the canonical href:

  ```ts
  it('renders an always-visible Lottery workflow card with the canonical route', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Published',
        currentCycleDetail: 'Live',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by May 11',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        lotteryHref: '/lottery',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    expect(html).toContain('Lottery')
    expect(html).toContain('fair claimant selection')
    expect(html).toContain('Open Lottery')
    expect(html).toContain('href="/lottery"')
  })
  ```

  Add `lotteryHref` to all existing `createElement(ManagerTriageDashboard, { ... })` calls in this file:

  ```ts
  lotteryHref: '/lottery',
  ```

- [ ] **Step 2: Run the dashboard test and verify it fails**

  Run:

  ```powershell
  npx vitest run "src/components/manager/ManagerTriageDashboard.test.ts"
  ```

  Expected: FAIL because `lotteryHref` is not a known prop and the card markup does not exist yet.

- [ ] **Step 3: Implement the inbox card and wire the href**

  Add `lotteryHref: string` to `ManagerTriageDashboardProps`, destructure it, and render a dedicated card in the left column between `ScheduleProgress` and `Recent Activity`:

  ```tsx
  <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
    <CardHeader className="pb-2 pt-4">
      <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Lottery
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 pb-4">
      <p className="text-base font-semibold text-foreground">Run and review lottery decisions</p>
      <p className="text-sm text-muted-foreground">
        Use Lottery for fair claimant selection on eligible published shifts.
      </p>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5 px-3 text-xs" asChild>
        <Link href={lotteryHref}>
          Open Lottery
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </CardContent>
  </Card>
  ```

  Then pass the canonical href from `src/app/(app)/dashboard/manager/page.tsx`:

  ```tsx
  lotteryHref={MANAGER_WORKFLOW_LINKS.lottery}
  ```

- [ ] **Step 4: Re-run the dashboard test and verify it passes**

  Run:

  ```powershell
  npx vitest run "src/components/manager/ManagerTriageDashboard.test.ts"
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the inbox workflow card**

  ```powershell
  git add src/components/manager/ManagerTriageDashboard.tsx src/components/manager/ManagerTriageDashboard.test.ts src/app/(app)/dashboard/manager/page.tsx
  git commit -m "Promote Lottery on the manager inbox"
  ```

---

### Task 3: Restore the `/lottery` server page contract

**Files:**

- Create: `src/app/(app)/lottery/page.tsx`
- Create: `src/app/(app)/lottery/page.test.ts`
- Modify: `src/app/(app)/route-metadata.test.ts`

- [ ] **Step 1: Write the failing page contract test**

  Create `src/app/(app)/lottery/page.test.ts` using the same mocking style as `src/app/(app)/shift-board/page.test.ts`:

  ```ts
  import { createElement } from 'react'
  import { renderToStaticMarkup } from 'react-dom/server'
  import { beforeEach, describe, expect, it, vi } from 'vitest'

  const { redirectMock, createClientMock, loadLotteryActorMock, loadLotterySnapshotMock } =
    vi.hoisted(() => ({
      redirectMock: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`)
      }),
      createClientMock: vi.fn(),
      loadLotteryActorMock: vi.fn(),
      loadLotterySnapshotMock: vi.fn(),
    }))

  vi.mock('next/navigation', () => ({ redirect: redirectMock }))
  vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
  vi.mock('@/lib/lottery/service', () => ({
    loadLotteryActor: loadLotteryActorMock,
    loadLotterySnapshot: loadLotterySnapshotMock,
  }))
  vi.mock('@/components/lottery/LotteryClientPage', () => ({
    default: ({ initialSnapshot }: { initialSnapshot: { selectedDate: string | null } }) =>
      createElement('div', null, `Lottery workspace ${initialSnapshot.selectedDate}`),
  }))

  import LotteryPage from '@/app/(app)/lottery/page'
  ```

  Add two tests:

  ```ts
  it('loads the lottery snapshot for managers and renders the shared client page', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'manager-1' } } })) },
    })
    loadLotteryActorMock.mockResolvedValue({ userId: 'manager-1', role: 'manager' })
    loadLotterySnapshotMock.mockResolvedValue({ selectedDate: '2026-04-23', selectedShift: 'day' })

    const html = renderToStaticMarkup(
      await LotteryPage({ searchParams: Promise.resolve({ date: '2026-04-23', shift: 'day' }) })
    )

    expect(loadLotteryActorMock).toHaveBeenCalledWith('manager-1')
    expect(loadLotterySnapshotMock).toHaveBeenCalledWith({
      actor: { userId: 'manager-1', role: 'manager' },
      shiftDate: '2026-04-23',
      shiftType: 'day',
    })
    expect(html).toContain('Lottery workspace 2026-04-23')
  })

  it('redirects non-managers to the staff dashboard', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'therapist-1' } } })) },
    })
    loadLotteryActorMock.mockResolvedValue(null)

    await expect(LotteryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )
  })
  ```

  In `src/app/(app)/route-metadata.test.ts`, add:

  ```ts
  ['src/app/(app)/lottery/page.tsx', "title: 'Lottery'"],
  ```

- [ ] **Step 2: Run the page and metadata tests and verify they fail**

  Run:

  ```powershell
  npx vitest run "src/app/(app)/lottery/page.test.ts" "src/app/(app)/route-metadata.test.ts"
  ```

  Expected: FAIL because `src/app/(app)/lottery/page.tsx` does not exist yet.

- [ ] **Step 3: Restore the page file from the verified worktree**

  Create `src/app/(app)/lottery/page.tsx` using the existing source in `C:\dev\rt-scheduler-off-onedrive\.worktrees\lottery-ship\src\app\(app)\lottery\page.tsx`.

  The restored file should preserve this shape:

  ```ts
  import type { Metadata } from 'next'
  import { redirect } from 'next/navigation'

  import LotteryClientPage from '@/components/lottery/LotteryClientPage'
  import { loadLotteryActor, loadLotterySnapshot } from '@/lib/lottery/service'
  import { createClient } from '@/lib/supabase/server'

  export const metadata: Metadata = {
    title: 'Lottery',
  }
  ```

  Preserve the verified search-param behavior:

  ```ts
  type LotterySearchParams = {
    date?: string | string[]
    shift?: string | string[]
  }
  ```

  Preserve the verified redirect flow:
  - unauthenticated -> `/login`
  - authenticated without Lottery manager actor -> `/dashboard/staff`

- [ ] **Step 4: Re-run the page and metadata tests and verify they pass**

  Run:

  ```powershell
  npx vitest run "src/app/(app)/lottery/page.test.ts" "src/app/(app)/route-metadata.test.ts"
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the restored server page contract**

  ```powershell
  git add src/app/(app)/lottery/page.tsx src/app/(app)/lottery/page.test.ts src/app/(app)/route-metadata.test.ts
  git commit -m "Restore the Lottery page entry point"
  ```

---

### Task 4: Restore the Lottery backend and client workspace from the verified worktree

**Files:**

- Create: `src/components/lottery/LotteryClientPage.tsx`
- Create: `src/lib/lottery/service.ts`
- Create: `src/lib/lottery/recommendation.ts`
- Create: `src/lib/lottery/recommendation.test.ts`
- Create: `src/lib/lottery/status-reconciliation.ts`
- Create: `src/lib/lottery/status-reconciliation.test.ts`
- Create: `src/app/api/lottery/workflow-routes.test.ts`
- Create: `src/app/api/lottery/apply/route.ts`
- Create: `src/app/api/lottery/history/route.ts`
- Create: `src/app/api/lottery/list/route.ts`
- Create: `src/app/api/lottery/request/route.ts`
- Create: `src/app/api/lottery/snapshot/route.ts`
- Create: `e2e/lottery-workflow.spec.ts`

- [ ] **Step 1: Restore the failing Lottery tests first**

  Create these test files by porting the verified source from the `lottery-ship` worktree:
  - `src/lib/lottery/recommendation.test.ts`
  - `src/lib/lottery/status-reconciliation.test.ts`
  - `src/app/api/lottery/workflow-routes.test.ts`

  The route test file should keep the exact hoisted mock surface for:

  ```ts
  createClientMock
  isTrustedMutationRequestMock
  loadLotteryActorMock
  addLotteryRequestMock
  removeLotteryRequestMock
  addLotteryListEntryMock
  moveLotteryListEntryMock
  applyLotteryDecisionMock
  loadLotteryHistoryMock
  ```

  Also create `e2e/lottery-workflow.spec.ts` from the verified source, preserving the `loginForLottery()` auth helper and the seeded serial flow.

- [ ] **Step 2: Run the restored Lottery tests and verify they fail**

  Run:

  ```powershell
  npx vitest run "src/lib/lottery/recommendation.test.ts" "src/lib/lottery/status-reconciliation.test.ts" "src/app/api/lottery/workflow-routes.test.ts"
  ```

  Expected: FAIL because the implementation files and route handlers are still missing.

- [ ] **Step 3: Restore the implementation files from the verified worktree**

  Port these files into the active checkout with content matching the verified worktree versions:
  - `src/components/lottery/LotteryClientPage.tsx`
  - `src/lib/lottery/service.ts`
  - `src/lib/lottery/recommendation.ts`
  - `src/lib/lottery/status-reconciliation.ts`
  - `src/app/api/lottery/apply/route.ts`
  - `src/app/api/lottery/history/route.ts`
  - `src/app/api/lottery/list/route.ts`
  - `src/app/api/lottery/request/route.ts`
  - `src/app/api/lottery/snapshot/route.ts`

  Preserve these verified behaviors from the prior implementation:
  - `loadLotteryActor()` is the manager gate used by both page and route layers
  - `loadLotterySnapshot()` drives the page snapshot and accepts `shiftDate` plus `shiftType`
  - mutation routes keep `isTrustedMutationRequest` enforcement before touching Lottery services
  - apply behavior routes through the assignment-status reconciliation seam instead of inventing a parallel status authority

  Do not redesign the client page on restore. Keep the existing `LotteryClientPage` interaction model first, then adapt only if the active checkout has real compile-time drift.

- [ ] **Step 4: Re-run the restored Lottery tests and verify they pass**

  Run:

  ```powershell
  npx vitest run "src/lib/lottery/recommendation.test.ts" "src/lib/lottery/status-reconciliation.test.ts" "src/app/api/lottery/workflow-routes.test.ts" "src/app/(app)/lottery/page.test.ts"
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the restored Lottery workspace**

  ```powershell
  git add src/components/lottery/LotteryClientPage.tsx src/lib/lottery/service.ts src/lib/lottery/recommendation.ts src/lib/lottery/recommendation.test.ts src/lib/lottery/status-reconciliation.ts src/lib/lottery/status-reconciliation.test.ts src/app/api/lottery/workflow-routes.test.ts src/app/api/lottery/apply/route.ts src/app/api/lottery/history/route.ts src/app/api/lottery/list/route.ts src/app/api/lottery/request/route.ts src/app/api/lottery/snapshot/route.ts e2e/lottery-workflow.spec.ts
  git commit -m "Restore the Lottery workflow implementation"
  ```

---

### Task 5: Run full verification and browser proof

**Files:**

- Verify only

- [ ] **Step 1: Run the focused Lottery unit and route suite**

  Run:

  ```powershell
  npx vitest run "src/components/shell/app-shell-config.test.ts" "src/components/manager/ManagerTriageDashboard.test.ts" "src/app/(app)/route-metadata.test.ts" "src/app/(app)/lottery/page.test.ts" "src/lib/lottery/recommendation.test.ts" "src/lib/lottery/status-reconciliation.test.ts" "src/app/api/lottery/workflow-routes.test.ts"
  ```

  Expected: PASS.

- [ ] **Step 2: Run typecheck**

  Run:

  ```powershell
  npx tsc --noEmit
  ```

  Expected: PASS.

- [ ] **Step 3: Run lint**

  Run:

  ```powershell
  npm run lint
  ```

  Expected: PASS.

- [ ] **Step 4: Run the restored Lottery browser regression**

  Use the previously verified port-3001 shape from this repo family. If port 3000 is busy, set the env vars explicitly:

  ```powershell
  $env:PORT='3001'
  $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
  $env:PLAYWRIGHT_WORKERS='1'
  npm run test:e2e -- e2e/lottery-workflow.spec.ts
  ```

  Expected: PASS when Supabase env values are available. The restored E2E test should:
  - seed a manager plus therapists
  - sign in with `loginForLottery()`
  - open `/lottery`
  - request/add/list/apply
  - verify history

- [ ] **Step 5: Manual browser proof in the running app**

  In the browser, verify all three user-facing claims:
  - manager Schedule local nav includes `Lottery`
  - manager inbox shows the dedicated `Lottery` workflow card
  - clicking either entry point opens the real `/lottery` page

  If manual auth friction blocks this pass, use the restored `loginForLottery()` pattern from `e2e/lottery-workflow.spec.ts` as the disposable automation-friendly auth seam instead of relying on a human session.

- [ ] **Step 6: Commit any final integration fixes**

  ```powershell
  git add .
  git commit -m "Verify and finalize the Lottery workflow restoration"
  ```

---

## Self-Review

### Spec coverage

- manager shell promotion: covered by Task 1
- manager inbox dedicated workflow card: covered by Task 2
- real `/lottery` route: covered by Task 3
- restore missing page/component/service/API files: covered by Task 4
- unit, typecheck, lint, and browser verification: covered by Task 5

No spec sections are currently uncovered.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain
- Restore steps name the exact canonical source paths in `.worktrees/lottery-ship`
- Verification commands are explicit and Windows-compatible

### Type consistency

- canonical manager route key: `lottery`
- canonical route path: `/lottery`
- shared prop name: `lotteryHref`
- service entry points: `loadLotteryActor`, `loadLotterySnapshot`
