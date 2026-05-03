# Lottery Workflow Restoration Design

Date: 2026-05-03
Status: Approved

## Goal

Restore Lottery as a real manager workflow on the website so managers can always find and open it from the same places they use for other schedule operations.

This pass should make Lottery feel like a first-class workflow surface, not a hidden route, a temporary alert, or a dead navigation label.

## Problem

The current checkout is missing the manager-facing Lottery workflow surface in the places where managers expect it:

- `src/lib/workflow-links.ts` does not expose a Lottery destination
- `src/components/shell/app-shell-config.ts` does not include Lottery in the manager Schedule section
- `src/components/manager/ManagerTriageDashboard.tsx` does not include a dedicated Lottery workflow card on the inbox
- the reserved Lottery UI directories in `src/app/(app)/lottery` and `src/components/lottery` are currently empty in this checkout

The result is an inconsistent product state:

- the repo still carries Lottery schema history through `supabase/migrations/20260421164000_add_lottery_feature.sql`
- the repo still reserves Lottery route and service seams through `src/app/api/lottery/*` and `src/lib/lottery`
- managers cannot reliably discover or use Lottery from the website itself

That leaves Lottery in a worse state than an unfinished feature. It looks partly real at the repo level while being absent or unreachable from the product surface.

## Scope

This pass covers:

- restoring a real `/lottery` manager-facing page surface
- restoring the supporting UI/component files needed for that page
- promoting Lottery into manager navigation through the shared shell metadata seams
- adding a dedicated always-visible Lottery workflow card to the manager inbox
- keeping Lottery routing canonical so shell and inbox both point to the same `/lottery` destination

This pass does not cover:

- redesigning the broader manager inbox information architecture
- changing Lottery business rules, fairness policy, or claim-resolution semantics
- introducing alert-driven conditional visibility for Lottery
- redesigning coverage, publish, approvals, or requests workflows
- adding brand-new backend capabilities unrelated to restoring the existing Lottery lane

## Approved Product Decisions

### 1. Lottery is a stable workflow, not an alert state

Lottery should always be available to managers as a workflow they can reference and open.

It should not appear only when there are pending Lottery actions, candidate shifts, or warning counts. Conditional visibility would make the workflow harder to find and would teach managers that Lottery is an exception state instead of a durable tool.

### 2. Promote Lottery in both navigation and homepage workflow surfaces

Lottery should appear in both of the manager-facing discovery paths that already define the rest of the product:

- manager shell/local nav
- manager inbox

Adding only one of these would leave the workflow feeling bolted on:

- nav-only makes Lottery look like a label without a supported homepage presence
- inbox-only makes Lottery feel discoverable once, but not stable afterward

### 3. Use a dedicated inbox workflow card

On the manager inbox, Lottery should be represented as its own workflow card in the main content column.

This card should:

- always render for managers
- explain what Lottery is for in plain language
- use one clear CTA: `Open Lottery`

It should not be implemented as:

- a top metric card, because that treats Lottery like a status counter
- a right-rail metadata row, because that makes it feel secondary instead of operational

### 4. The route must be real before the IA points at it

If shell and inbox promote Lottery, `/lottery` must load as a real manager page. The product must not ship a dead link or a placeholder route.

This means the restoration lane includes both:

- the manager IA promotion seams
- the page/component restoration seams

## Existing Codebase Constraints

The current repo already defines the correct insertion points for this work:

- `src/lib/workflow-links.ts` is the canonical workflow-link registry
- `src/components/shell/app-shell-config.ts` owns manager section membership and local navigation
- `src/app/(app)/dashboard/manager/page.tsx` owns inbox data assembly and CTA wiring
- `src/components/manager/ManagerTriageDashboard.tsx` owns the inbox card layout and workflow presentation

The repo also shows clear Lottery intent even though the UI surface is missing:

- `src/app/api/lottery/{apply,history,list,request,snapshot}` reserves the route surface for Lottery backend operations
- `src/lib/lottery` exists as a dedicated seam for Lottery-specific logic
- `supabase/migrations/20260421164000_add_lottery_feature.sql` records Lottery as a real feature in schema history

The restoration should build on these seams rather than inventing a parallel implementation path.

## Recommended Architecture

### Shared workflow-link restoration

Add `lottery` to `MANAGER_WORKFLOW_LINKS` in `src/lib/workflow-links.ts` with the canonical value:

- `/lottery`

This becomes the shared destination used by shell nav and inbox CTA wiring.

### Manager shell promotion

Add Lottery to the manager Schedule section in `src/components/shell/app-shell-config.ts`.

Expected behavior:

- `Lottery` appears alongside the other manager schedule workflows
- route activity logic recognizes `/lottery` as part of the manager schedule surface
- local nav highlights correctly when managers are on `/lottery`

This keeps Lottery inside the same mental model as Coverage, Schedule, Availability, Publish, and Approvals.

### Manager inbox workflow card

Add a dedicated Lottery workflow card to `src/components/manager/ManagerTriageDashboard.tsx`.

Recommended placement:

- in the main content column
- below the current metric/progress area
- above `Recent Activity`

Recommended content model:

- title: `Lottery`
- description: plain-language explanation of fair claimant selection for eligible published shifts
- CTA: `Open Lottery`

This card should be stable and descriptive, not metric-heavy.

### Lottery page restoration

Restore a real manager-facing `/lottery` page surface under `src/app/(app)/lottery`.

The page should:

- be reachable through the canonical `/lottery` route
- use existing manager shell conventions
- present the Lottery workflow as an actual operational page, not a placeholder

Supporting UI should live under `src/components/lottery`.

If the backend/service seams are also missing in practice, restore the minimum supporting files in `src/lib/lottery` and any required `src/app/api/lottery/*` route files so the page loads coherently and the IA does not outpace the implementation.

## UX Rules

### Manager-facing wording

Lottery copy should stay calm and explicit:

- avoid internal engineering language
- avoid making Lottery sound like an alert, escalation, or experimental tool
- explain the purpose as fair selection for eligible claimants on published shifts

### Visibility

Lottery is always visible to managers in:

- shell navigation
- manager inbox workflow surface

No conditional hide/show behavior should determine whether the workflow exists in the UI.

### CTA behavior

Every promoted Lottery entry point should route to the same canonical destination:

- `/lottery`

There should not be multiple competing Lottery destinations or alternate temporary routes.

## Testing Strategy

### Unit and render tests

Add or update tests to prove:

- `src/lib/workflow-links.ts` exports the Lottery link
- `src/components/shell/app-shell-config.ts` includes Lottery in the manager Schedule section
- manager route activity recognizes `/lottery`
- `src/components/manager/ManagerTriageDashboard.tsx` renders the Lottery workflow card and CTA

### Route verification

Add or update route-level coverage to prove:

- `/lottery` resolves as a real page
- the restored page does not 404 or render a placeholder state by mistake

### Browser verification

Run a real browser pass that proves:

- managers can see Lottery in navigation
- managers can see the dedicated Lottery card on the inbox
- clicking either entry point opens the real `/lottery` workflow

## Acceptance Criteria

- managers can always find Lottery from the shell navigation
- managers can always find Lottery from the inbox
- both surfaces point to the same canonical `/lottery` route
- `/lottery` is a real manager workflow page, not a dead link
- Lottery is presented as a stable workflow reference rather than a conditional alert surface

## Implementation Notes

- Keep the change tightly scoped to Lottery restoration and promotion
- Reuse current manager shell and inbox patterns instead of inventing bespoke navigation or dashboard primitives
- Prefer restoring the missing Lottery files into the reserved seams over creating a second parallel route or alternate naming scheme
