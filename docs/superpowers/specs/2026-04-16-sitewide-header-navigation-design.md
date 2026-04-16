# Sitewide Header Navigation Design

Date: 2026-04-16
Status: Approved

## Goal

Standardize the website header/navigation system so the product feels like one coherent application: one shared authenticated app header, one shared public header pattern, one compact local section-nav pattern, and one smaller page-intro pattern applied consistently across relevant routes.

## Problem

The current app shell solves some global wayfinding, but the header system is still inconsistent in the places that matter most:

- the authenticated shell currently stacks a dark primary bar with a dark secondary bar, which makes the top of the app feel repetitive and heavy
- global navigation and section navigation are too similar in treatment, so hierarchy is weaker than it should be
- page title areas are larger than necessary and vary by route
- several routes render custom header or tab markup instead of composing a shared system
- public and auth pages each repeat their own brand/header structure instead of sharing a single public pattern

The result is a product that works functionally but does not read as one deliberate, reusable header system.

## Scope

This redesign covers:

- authenticated in-app global header structure and behavior
- section-level navigation treatment for routes with subsections
- page intro/title treatment
- shared spacing, sizing, and active-state tokens for those patterns
- reuse of the same shared primitives across all applicable authenticated pages
- a separate shared public/auth header pattern for marketing and auth routes

This redesign does not cover:

- route restructuring or permission policy changes
- changing the existing color palette
- replacing account, notification, or sign-out functionality
- rewriting content-heavy page bodies unrelated to the shell/header system
- introducing bespoke page-specific header variants unless a shared variant is intentionally defined

## Approved Product Decisions

### 1. Split public and authenticated shells the normal way

The site should use two shared header families:

- `authenticated app shell`: the primary product navigation system for `/dashboard`, `/team`, `/requests`, `/availability`, `/coverage`, `/publish`, `/approvals`, `/settings`, therapist pages, and similar in-app routes
- `public/auth shell`: a separate shared header pattern for `/`, `/login`, `/signup`, `/reset-password`, and similar non-app routes

This is the normal product split. It keeps public pages internally consistent without forcing the app shell onto auth flows.

### 2. One authenticated header structure with role-based visibility

Managers and staff should use the same authenticated header structure, not separate shell implementations.

Role differences should be handled by shared route metadata and permission-gated nav visibility:

- same logo/brand placement
- same primary-nav slot
- same utility-actions slot
- same mobile interaction model
- same active-state treatment

Only the visible nav items differ by permission.

### 3. One sticky global bar only

The authenticated app should keep a single sticky global header as the only major sticky header element.

The current stacked secondary dark bar should be removed. Section-level tabs should move onto the page surface below the global bar.

### 4. Local section nav belongs on the page surface

Routes with subsections should use a compact shared local-nav pattern rendered below the global header and above the page intro/content.

Examples:

- manager People section: `Team / Requests`
- manager Schedule section: `Coverage / Availability / Publish / Approvals`

This local nav must be visually distinct from the global app nav:

- lighter surface treatment
- compact segmented/tab styling
- not sticky by default
- same spacing and interaction rules anywhere it appears

### 5. Dashboards keep orientation but use lighter intros

Dashboards should still show a title and short supporting line, but through a lighter intro variant with less vertical height.

This preserves orientation while getting users to useful content faster.

## Existing Codebase Constraints

The current implementation already provides useful starting points:

- [`src/components/AppShell.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/AppShell.tsx) owns the authenticated shell and the route-based nav model
- `buildManagerSections()` in that file already defines the right top-level grouping (`Today`, `Schedule`, `People`)
- [`src/components/schedule-roster/WorkflowTabs.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/schedule-roster/WorkflowTabs.tsx) is close to the correct local-nav primitive
- [`src/components/manager/ManagerWorkspaceHeader.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/manager/ManagerWorkspaceHeader.tsx) and [`src/components/ui/page-header.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/ui/page-header.tsx) overlap in responsibility
- [`src/components/team/TeamWorkspaceClient.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/team/TeamWorkspaceClient.tsx) and [`src/components/team/team-workspace.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/team/team-workspace.tsx) each implement custom local tablists
- [`src/components/schedule-roster/TopAppHeader.tsx`](/Users/byonk/OneDrive/Desktop/rt-scheduler/src/components/schedule-roster/TopAppHeader.tsx) is a separate top-header implementation that should not remain a parallel shell pattern
- public/auth pages such as [`src/app/(public)/page.tsx`](</Users/byonk/OneDrive/Desktop/rt-scheduler/src/app/(public)/page.tsx>), [`src/app/(public)/login/page.tsx`](</Users/byonk/OneDrive/Desktop/rt-scheduler/src/app/(public)/login/page.tsx>), and [`src/app/(public)/signup/page.tsx`](</Users/byonk/OneDrive/Desktop/rt-scheduler/src/app/(public)/signup/page.tsx>) repeat brand/header structures independently

The redesign should build on those pieces instead of introducing a second shell architecture.

## Recommended Architecture

### Shared authenticated shell primitives

The authenticated experience should be decomposed into a small set of shared primitives:

- `AppHeader`
  - brand/logo on the left
  - primary global nav in the center-left region
  - utility actions on the right
  - mobile trigger and drawer behavior
- `LocalSectionNav`
  - compact segmented/tab navigation rendered on the page surface
  - used only when a route has local subsections
- `PageIntro`
  - title
  - short supporting sentence
  - optional summary chips
  - optional actions
- `PageShell`
  - composes `LocalSectionNav`, `PageIntro`, and shared content spacing

`AppShell` should remain the authenticated route wrapper, but it should compose these primitives instead of directly implementing both global and local header bars itself.

### Shared public/auth shell primitive

Public and auth routes should share one lighter `PublicHeader` pattern:

- same brand treatment
- shared right-side auth actions
- shared horizontal padding/container alignment
- same responsive behavior across marketing and auth pages

This can still allow auth pages to keep their current two-panel layouts. The requirement is shared header structure, not identical full-page composition.

## Navigation Model

### Global app nav

The global authenticated nav should remain the highest-level wayfinding layer.

Recommended manager grouping:

- `Today`
- `Schedule`
- `People`

Recommended staff grouping remains flatter, but inside the same header component:

- `Dashboard`
- `Schedule`
- `Availability`
- `Open shifts`

The route metadata should decide:

- visible global items
- active top-level item
- whether a local section nav exists
- which local item is active
- page intro content

### Local section nav

Local nav should be driven from the same shared route metadata, not page-specific tab markup.

It should:

- render below the sticky global header
- live on the page surface
- use `aria-current`, `role="navigation"` semantics, and visible focus states
- use consistent active styling that is clearly different from global nav styling

## Visual Rules

### Height and spacing tokens

The redesign should centralize shell layout tokens/constants for:

- authenticated global header height: `56px`
- shared app content top offset derived from that header height
- local section-nav inner height and padding
- page intro padding and title spacing
- shared page container width and horizontal padding

These values should not be hardcoded independently inside multiple pages.

### Active states

Active state rules must be shared and restrained:

- top-level active item uses shape and emphasis without becoming a second banner
- local-nav active item uses a lighter surfaced selection treatment
- active state should not rely on color alone; shape, underline, inset accent, or ring cues are acceptable

### Intro sizing

Page intros should become smaller and more uniform:

- tighter top and bottom padding
- concise subtitle spacing
- summary chips and actions aligned to the same content grid
- no oversized decorative card treatment unless intentionally reused by the shared intro primitive

## Route Application Strategy

### Authenticated routes

Apply the shared authenticated pattern across every in-app route that uses the app shell.

This includes:

- manager dashboard and staff dashboard
- schedule/coverage workflows
- people/team/requests workflows
- therapist pages
- settings/profile/notifications and related app pages

### Public/auth routes

Apply the shared public header pattern to:

- home/landing page
- login
- signup
- reset password
- similar public routes

## Accessibility Requirements

The shared system must preserve or improve the current accessibility baseline:

- keep a skip link to main content
- preserve visible keyboard focus styles on all nav and utility controls
- use semantic `header` and `nav` landmarks
- use `aria-current` for current page/section states
- keep contrast compliant with the existing palette
- preserve keyboard-operable tab or link behavior for local section nav

## Testing Strategy

### Unit and render tests

- shell/nav tests should verify route metadata maps to the expected global and local items
- tests should verify the secondary dark sticky bar is no longer part of `AppShell`
- header tests should verify active-state and accessibility attributes (`aria-current`, skip link presence, mobile trigger semantics)
- page intro tests should verify shared spacing/styling contracts where those are currently covered by component tests

### Regression tests

- manager Schedule pages still show the correct section tabs
- People pages still show `Team / Requests`
- staff nav still routes to the correct destinations
- notification bell, account menu, therapist-view switch, and sign-out remain intact
- public/auth pages still render the expected entry actions and route links

### Manual verification

- desktop and mobile authenticated shell
- mobile drawer behavior
- local section tabs on sectioned pages
- lighter intro on dashboards
- public header consistency across home/login/signup

## Intentional Exceptions

These exceptions should remain intentional rather than accidental:

- public/auth pages use a separate shared header family from the authenticated app shell
- pages without subsections do not render local section nav
- dashboards use the lighter intro variant rather than the fuller page-intro variant

No other page-specific header variation should remain unless a new shared variant is explicitly introduced for a product reason.

## Acceptance Criteria

- the authenticated app uses one shared global header pattern across all app pages
- local section tabs are visually distinct from global nav and rendered on the page surface
- page intros are smaller and more consistent
- duplicated one-off header markup is reduced in favor of shared primitives
- public/auth pages share one public header pattern
- active section/page orientation is clearer than before
- the current color palette remains intact
- existing routing, permissions, notifications, account controls, and navigation behavior continue to work
