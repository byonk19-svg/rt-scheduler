# Sitewide Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked and duplicated header implementations with one shared authenticated header system, one shared public header pattern, one reusable local section-nav pattern, and one smaller page-intro pattern applied consistently across the site.

**Architecture:** Keep `src/components/AppShell.tsx` as the authenticated route wrapper, but extract its shell chrome into focused shared primitives driven by route metadata. Reuse one shared local-nav component and one shared page-intro component across sectioned routes, then replace repeated public/auth brand headers with a shared public header so the site reads as one product without changing routing or permission logic.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, ESLint

---

### Task 1: Add shared shell tokens and authenticated route metadata

**Files:**

- Create: `src/components/shell/app-shell-config.ts`
- Create: `src/components/shell/app-shell-config.test.ts`
- Modify: `src/components/AppShell.tsx`
- Test: `src/components/shell/app-shell-config.test.ts`

- [ ] **Step 1: Write the failing route-metadata tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  APP_HEADER_HEIGHT,
  getManagerAppShellSections,
  getShellContext,
} from '@/components/shell/app-shell-config'

describe('app-shell-config', () => {
  it('uses a single standard authenticated header height token', () => {
    expect(APP_HEADER_HEIGHT).toBe(56)
  })

  it('maps /team into the People section with Team and Requests local items', () => {
    const context = getShellContext({
      pathname: '/team',
      canAccessManagerUi: true,
      pendingCount: 3,
    })

    expect(context.primaryKey).toBe('people')
    expect(context.localNav?.items.map((item) => item.label)).toEqual(['Team', 'Requests'])
    expect(context.localNav?.items.find((item) => item.label === 'Requests')?.badgeCount).toBe(3)
  })

  it('does not return local nav for manager dashboard', () => {
    const context = getShellContext({
      pathname: '/dashboard/manager',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('today')
    expect(context.localNav).toBeNull()
  })

  it('keeps staff navigation inside the same shell model', () => {
    const sections = getManagerAppShellSections(0)
    expect(sections.map((section) => section.key)).toEqual(['today', 'schedule', 'people'])
  })
})
```

- [ ] **Step 2: Run the metadata tests to verify they fail**

Run: `npx vitest run src/components/shell/app-shell-config.test.ts`

Expected: FAIL because the new shell config module does not exist yet.

- [ ] **Step 3: Implement the shell config module and move nav mapping into it**

```ts
export const APP_HEADER_HEIGHT = 56
export const APP_HEADER_HEIGHT_CLASS = 'h-14'
export const APP_PAGE_MAX_WIDTH_CLASS = 'mx-auto max-w-7xl px-4 md:px-6'

export type ShellNavItem = {
  href: string
  label: string
  active: (pathname: string) => boolean
  badgeCount?: number
}

export type ShellContext = {
  primaryKey: string | null
  primaryItems: ShellNavItem[]
  localNav: { ariaLabel: string; items: ShellNavItem[] } | null
}

export function getShellContext(args: {
  pathname: string
  canAccessManagerUi: boolean
  pendingCount: number
}): ShellContext {
  const primaryItems = args.canAccessManagerUi
    ? getManagerAppShellSections(args.pendingCount).map((section) => ({
        href: section.href,
        label: section.label,
        active: section.isActive,
      }))
    : getStaffAppShellItems()

  const activePrimary = primaryItems.find((item) => item.active(args.pathname)) ?? null
  const activeManagerSection = args.canAccessManagerUi
    ? getManagerAppShellSections(args.pendingCount).find((section) =>
        section.isActive(args.pathname)
      )
    : null

  return {
    primaryKey: activeManagerSection?.key ?? activePrimary?.label.toLowerCase() ?? null,
    primaryItems,
    localNav:
      activeManagerSection && activeManagerSection.subItems.length > 0
        ? {
            ariaLabel: `${activeManagerSection.label} section`,
            items: activeManagerSection.subItems.map((item) => ({
              href: item.href,
              label: item.label,
              active: item.isActive,
              badgeCount: item.showBadge ? args.pendingCount : undefined,
            })),
          }
        : null,
  }
}
```

- [ ] **Step 4: Refactor `AppShell` to import shell config instead of defining nav mapping inline**

```tsx
import {
  APP_HEADER_HEIGHT,
  APP_PAGE_MAX_WIDTH_CLASS,
  getShellContext,
} from '@/components/shell/app-shell-config'

const shellContext = getShellContext({ pathname, canAccessManagerUi, pendingCount })
```

- [ ] **Step 5: Run the metadata tests to verify they pass**

Run: `npx vitest run src/components/shell/app-shell-config.test.ts`

Expected: PASS with all route-metadata assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/app-shell-config.ts src/components/shell/app-shell-config.test.ts src/components/AppShell.tsx
git commit -m "Centralize shell nav metadata before header refactor" -m "Create a shared shell config module so global navigation, section navigation, and layout sizing tokens come from one source of truth before the visual header refactor lands.

Constraint: Existing manager and staff routing behavior must remain unchanged during shell extraction
Rejected: Keep nav mapping embedded inside AppShell | makes reusable header primitives harder to compose and test
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: New shell variants should extend route metadata, not reintroduce page-specific header logic
Tested: npx vitest run src/components/shell/app-shell-config.test.ts
Not-tested: No browser verification in this commit"
```

### Task 2: Extract the authenticated header and local section-nav primitives

**Files:**

- Create: `src/components/shell/AppHeader.tsx`
- Create: `src/components/shell/LocalSectionNav.tsx`
- Create: `src/components/shell/AppHeader.test.ts`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.ts`
- Test: `src/components/AppShell.test.ts`

- [ ] **Step 1: Write the failing shell/header assertions**

```ts
it('renders only one fixed top header bar in AppShell', () => {
  expect(appShellSource).toContain('<AppHeader')
  expect(appShellSource).not.toContain('app-shell-chrome-secondary fixed top-14')
})

it('renders local section navigation through the shared LocalSectionNav primitive', () => {
  expect(appShellSource).toContain('<LocalSectionNav')
  expect(appShellSource).not.toContain('<WorkflowTabs')
})

it('keeps the skip link and mobile drawer interactions intact', () => {
  expect(appShellSource).toContain('href=\"#main-content\"')
  expect(appShellSource).toContain("aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}")
})
```

- [ ] **Step 2: Run the shell tests to verify they fail**

Run: `npx vitest run src/components/AppShell.test.ts`

Expected: FAIL because `AppShell` still renders the secondary fixed bar and `WorkflowTabs`.

- [ ] **Step 3: Implement `AppHeader` and `LocalSectionNav`**

```tsx
export function AppHeader(props: {
  dashboardHref: string
  primaryItems: Array<{ href: string; label: string; current: boolean; badgeCount?: number }>
  unreadNotificationCount: number
  user: AppShellUser | null
  canAccessManagerUi: boolean
  mobileMenuOpen: boolean
  onToggleMobileMenu: () => void
}) {
  return (
    <header className="no-print fixed inset-x-0 top-0 z-30 h-14 border-b border-sidebar-border/80 text-sidebar-foreground shadow-tw-app-chrome app-shell-chrome-primary">
      <div className="flex h-full items-center gap-3 px-3 sm:px-4">
        <Link href={props.dashboardHref} aria-label="Teamwise dashboard">
          <Logo />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {props.primaryItems.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <DeferredNotificationBell
            variant="shell"
            initialUnreadCount={props.unreadNotificationCount}
          />
          <UserDropdown user={props.user} canAccessManagerUi={props.canAccessManagerUi} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={props.onToggleMobileMenu}
        >
          {props.mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}

export function LocalSectionNav(props: {
  ariaLabel: string
  items: Array<{ href: string; label: string; current: boolean; badgeCount?: number }>
  className?: string
}) {
  return (
    <nav aria-label={props.ariaLabel} className={cn('flex items-center gap-1', props.className)}>
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium',
            item.current
              ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <span>{item.label}</span>
          {item.badgeCount ? (
            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
              {item.badgeCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Refactor `AppShell` to compose the new primitives and remove the second fixed bar**

```tsx
<AppHeader
  dashboardHref={dashboardHref}
  primaryItems={primaryItems}
  unreadNotificationCount={unreadNotificationCount}
  user={user}
  canAccessManagerUi={canAccessManagerUi}
  mobileMenuOpen={mobileMenuOpen}
  onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
/>

<div className="min-h-screen pt-14">
  <main id="main-content" ...>
    {shellContext.localNav ? (
      <div className="mb-3 border-b border-border/60 pb-3">
        <LocalSectionNav
          ariaLabel={shellContext.localNav.ariaLabel}
          items={localItems}
        />
      </div>
    ) : null}
    {children}
  </main>
</div>
```

- [ ] **Step 5: Run the shell tests to verify they pass**

Run: `npx vitest run src/components/AppShell.test.ts`

Expected: PASS with the new single-header assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/AppHeader.tsx src/components/shell/LocalSectionNav.tsx src/components/shell/AppHeader.test.ts src/components/AppShell.tsx src/components/AppShell.test.ts
git commit -m "Refactor AppShell around one authenticated header" -m "Extract the authenticated shell chrome into shared header primitives and remove the stacked secondary fixed bar so section navigation can live on the page surface.

Constraint: Notification, account, sign-out, and therapist-view controls must remain functional during the shell refactor
Rejected: Keep WorkflowTabs mounted in the shell and only restyle it | leaves route-level nav coupled to the global header implementation
Confidence: medium
Scope-risk: moderate
Reversibility: clean
Directive: Keep only one sticky top-level authenticated header unless a future product requirement explicitly proves otherwise
Tested: npx vitest run src/components/AppShell.test.ts
Not-tested: Full browser verification still pending"
```

### Task 3: Unify page intro and local section tabs on authenticated routes

**Files:**

- Create: `src/components/shell/PageIntro.tsx`
- Modify: `src/components/manager/ManagerWorkspaceHeader.tsx`
- Modify: `src/components/manager/ManagerWorkspaceHeader.test.ts`
- Modify: `src/components/ui/page-header.tsx`
- Modify: `src/components/team/TeamWorkspaceClient.tsx`
- Modify: `src/components/team/team-workspace.tsx`
- Modify: `src/app/(app)/team/page.tsx`
- Modify: `src/app/(app)/requests/page.tsx`
- Modify: `src/app/(app)/approvals/page.tsx`
- Modify: `src/components/availability/AvailabilityOverviewHeader.tsx`
- Test: `src/components/manager/ManagerWorkspaceHeader.test.ts`

- [ ] **Step 1: Write the failing intro/header tests**

```ts
it('uses the shared PageIntro treatment instead of a bespoke manager header wrapper', () => {
  const html = renderToStaticMarkup(
    createElement(ManagerWorkspaceHeader, {
      title: 'Coverage',
      subtitle: 'Mar 22-May 2 - 6 weeks - Click a day to edit',
    })
  )

  expect(html).toContain('data-page-intro')
  expect(html).not.toContain('border-b border-border/70 bg-card/80 px-6 pb-2.5 pt-2.5')
})
```

- [ ] **Step 2: Run the intro/header tests to verify they fail**

Run: `npx vitest run src/components/manager/ManagerWorkspaceHeader.test.ts`

Expected: FAIL because the current manager header still uses its old shell-specific wrapper classes.

- [ ] **Step 3: Implement `PageIntro` and rebase header wrappers onto it**

```tsx
export function PageIntro(props: {
  title: string
  subtitle?: ReactNode
  summary?: ReactNode
  actions?: ReactNode
  compact?: boolean
  className?: string
  titleClassName?: string
}) {
  return (
    <section
      data-page-intro
      className={cn('space-y-3', props.compact ? 'py-1' : 'py-2', props.className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className={cn('app-page-title text-[1.55rem] leading-tight', props.titleClassName)}>
            {props.title}
          </h1>
          {props.subtitle ? (
            <div className="text-sm text-muted-foreground">{props.subtitle}</div>
          ) : null}
        </div>
        {props.actions ? (
          <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
        ) : null}
      </div>
      {props.summary ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {props.summary}
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 4: Remove page-specific tablists where the shell now provides local section nav**

```tsx
// src/app/(app)/team/page.tsx
<PageIntro title="Team" subtitle="Manage staffing, roles, and roster access from one workspace." />

// src/components/team/TeamWorkspaceClient.tsx
// remove the top role="tablist" strip and keep only the directory/roster panel body
```

- [ ] **Step 5: Run the intro/header tests to verify they pass**

Run: `npx vitest run src/components/manager/ManagerWorkspaceHeader.test.ts`

Expected: PASS with the shared intro marker and smaller intro treatment in place.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/PageIntro.tsx src/components/manager/ManagerWorkspaceHeader.tsx src/components/manager/ManagerWorkspaceHeader.test.ts src/components/ui/page-header.tsx src/components/team/TeamWorkspaceClient.tsx src/components/team/team-workspace.tsx src/app/(app)/team/page.tsx src/app/(app)/requests/page.tsx src/app/(app)/approvals/page.tsx src/components/availability/AvailabilityOverviewHeader.tsx
git commit -m "Unify page intros and section tabs across app routes" -m "Rebase the overlapping manager/page header implementations onto one shared intro primitive and remove page-specific local tab markup where the shell now owns section navigation.

Constraint: Team, Requests, Approvals, and Availability pages still need clear current-page orientation after intro compaction
Rejected: Keep ManagerWorkspaceHeader and PageHeader as parallel patterns | preserves duplicated page-intro styling and spacing rules
Confidence: medium
Scope-risk: moderate
Reversibility: clean
Directive: Page routes should provide intro content and actions, not reinvent shell-level tab or header markup
Tested: npx vitest run src/components/manager/ManagerWorkspaceHeader.test.ts
Not-tested: Multi-route visual verification still pending"
```

### Task 4: Consolidate the public/auth header pattern

**Files:**

- Create: `src/components/public/PublicHeader.tsx`
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/login/page.tsx`
- Modify: `src/app/(public)/signup/page.tsx`
- Modify: `src/app/(public)/reset-password/page.tsx`
- Test: `src/app/(public)/signup/page.test.ts`

- [ ] **Step 1: Write the failing public-shell assertions**

```ts
it('renders the shared public header across signup routes', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(public)/signup/page.tsx'),
    'utf8'
  )
  expect(source).toContain('<PublicHeader')
  expect(source).not.toContain('CalendarDays')
})
```

- [ ] **Step 2: Run the public-route test to verify it fails**

Run: `npx vitest run src/app/(public)/signup/page.test.ts`

Expected: FAIL because the public pages still render their own brand/header markup inline.

- [ ] **Step 3: Implement `PublicHeader` and mount it from the public layout**

```tsx
export function PublicHeader(props: {
  ctaHref?: string
  ctaLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  className?: string
}) {
  return (
    <header className={cn('border-b border-border/50 bg-background/90', props.className)}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 hover:no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--attention)]">
            <CalendarDays className="h-4 w-4 text-accent-foreground" />
          </span>
          <span>
            <span className="block font-heading text-sm font-bold text-foreground">Teamwise</span>
            <span className="block text-[0.72rem] text-muted-foreground">Respiratory Therapy</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {props.secondaryHref && props.secondaryLabel ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={props.secondaryHref}>{props.secondaryLabel}</Link>
            </Button>
          ) : null}
          {props.ctaHref && props.ctaLabel ? (
            <Button asChild size="sm">
              <Link href={props.ctaHref}>{props.ctaLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

// src/app/(public)/layout.tsx
;<div className={fraunces.variable}>
  <PublicHeader />
  {children}
</div>
```

- [ ] **Step 4: Remove repeated public/auth brand headers from the individual pages**

```tsx
// home page no longer defines its own header wrapper
<main className="min-h-screen bg-background">
  <section className="teamwise-home-luminous relative overflow-hidden">...</section>
</main>

// login/signup keep their two-column page bodies but rely on PublicHeader for top branding
```

- [ ] **Step 5: Run the public-route test to verify it passes**

Run: `npx vitest run src/app/(public)/signup/page.test.ts`

Expected: PASS with the shared public header usage in place.

- [ ] **Step 6: Commit**

```bash
git add src/components/public/PublicHeader.tsx src/app/(public)/layout.tsx src/app/(public)/page.tsx src/app/(public)/login/page.tsx src/app/(public)/signup/page.tsx src/app/(public)/reset-password/page.tsx src/app/(public)/signup/page.test.ts
git commit -m "Share one public header across home and auth routes" -m "Replace repeated public/auth brand bars with one shared public header so the website side of the product matches the same consistency standard as the authenticated shell.

Constraint: Auth forms keep their current panel layouts and messaging even though the header becomes shared
Rejected: Force the authenticated app header onto public pages | wrong information architecture for marketing and auth flows
Confidence: medium
Scope-risk: moderate
Reversibility: clean
Directive: Public/auth routes may vary in body layout, but top-of-page branding and auth actions should stay shared
Tested: npx vitest run src/app/(public)/signup/page.test.ts
Not-tested: Home/login/signup mobile browser verification still pending"
```

### Task 5: Remove remaining parallel header markup and verify the redesign

**Files:**

- Modify: `src/components/schedule-roster/TopAppHeader.tsx`
- Modify: `src/components/schedule-roster/ScheduleRosterScreen.tsx`
- Modify: `src/components/schedule-roster/WorkflowTabs.tsx`
- Modify: `src/components/AppShell.test.ts`
- Modify: `src/components/manager/ManagerWorkspaceHeader.test.ts`
- Test: `src/components/AppShell.test.ts`

- [ ] **Step 1: Write the failing cleanup assertion**

```ts
it('does not keep the mock schedule route on a separate top-header implementation', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/schedule-roster/ScheduleRosterScreen.tsx'),
    'utf8'
  )

  expect(source).not.toContain('<TopAppHeader')
})
```

- [ ] **Step 2: Run the shell regression tests to verify they fail**

Run: `npx vitest run src/components/AppShell.test.ts`

Expected: FAIL because the mock schedule screen still imports its own top app header.

- [ ] **Step 3: Reuse the shared shell primitives on the mock schedule route and align `WorkflowTabs` styling with `LocalSectionNav`**

```tsx
// ScheduleRosterScreen should render inside the shared app-shell pattern instead of mounting TopAppHeader
// TopAppHeader can be deleted or reduced to a thin compatibility export

export function WorkflowTabs(...) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1', className)}>
      {tabs.map((tab) => (
        <Link
          key={`${tab.href}-${tab.label}`}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium',
            tab.active ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <span>{tab.label}</span>
          {tab.badgeCount ? <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">{tab.badgeCount}</span> : null}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the full verification suite**

Run: `npx vitest run src/components/shell/app-shell-config.test.ts src/components/AppShell.test.ts src/components/manager/ManagerWorkspaceHeader.test.ts src/app/(public)/signup/page.test.ts`

Expected: PASS with all targeted shell/header tests green.

Run: `npm run lint -- src/components/AppShell.tsx src/components/shell src/components/public src/components/manager/ManagerWorkspaceHeader.tsx src/components/ui/page-header.tsx src/app/(app) src/app/(public)`

Expected: PASS with no lint errors in the changed header-shell surface.

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule-roster/TopAppHeader.tsx src/components/schedule-roster/ScheduleRosterScreen.tsx src/components/schedule-roster/WorkflowTabs.tsx src/components/AppShell.test.ts src/components/manager/ManagerWorkspaceHeader.test.ts
git commit -m "Finish sitewide header standardization" -m "Clean up the remaining parallel header implementation on the mock schedule route and verify the new authenticated and public header systems behave consistently across the shared shell surface.

Constraint: The redesign must preserve current navigation logic while making the shell visually and structurally consistent
Rejected: Leave the mock schedule route on a custom top header | undermines the sitewide standardization goal
Confidence: medium
Scope-risk: broad
Reversibility: clean
Directive: Treat the shell as a shared product surface; new routes should compose the existing primitives before inventing new header markup
Tested: npx vitest run src/components/shell/app-shell-config.test.ts src/components/AppShell.test.ts src/components/manager/ManagerWorkspaceHeader.test.ts src/app/(public)/signup/page.test.ts; npm run lint -- src/components/AppShell.tsx src/components/shell src/components/public src/components/manager/ManagerWorkspaceHeader.tsx src/components/ui/page-header.tsx src/app/(app) src/app/(public)
Not-tested: Browser-based visual QA and mobile interaction verification still required"
```
