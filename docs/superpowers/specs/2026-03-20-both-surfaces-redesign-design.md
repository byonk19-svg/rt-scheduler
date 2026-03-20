# Landing And Manager Dashboard Redesign

Date: 2026-03-20
Routes: `/`, `/login`, `/signup`, `/dashboard/manager`

## Goal

Refine the public auth surface and the manager dashboard so they feel like a calm clinical workspace instead of a generic SaaS product.

The redesign should:

- preserve the existing Teamwise palette and overall visual identity
- reduce decorative UI that feels templated
- make sign-in the primary public task
- keep the manager dashboard balanced and intentionally sparse
- improve hierarchy on desktop and mobile without changing core workflows

## Approved Direction

- Keep the current warm light background, teal base, and amber accent system.
- Preserve the product's overall tone instead of rebranding it.
- Make the landing page an auth-first access portal.
- Keep account creation available, but clearly secondary to sign-in.
- Remove fake product theater from the landing page.
- Keep the manager dashboard balanced instead of converting it into an urgent command center.
- Make the dashboard intentionally sparse, with stronger reading order and less dead air.

## Non-Goals

- No workflow rewrite for auth or dashboard navigation
- No new product theme or major token overhaul
- No dense operations console or alert-heavy command center treatment
- No marketing-style landing page
- No change to role-based routing or manager permissions

## Current Problem

The current UI is visually competent, but two important surfaces are under-structured.

### Landing Page

The auth screen currently splits attention between the real task and a decorative mock product view. The left panel uses a familiar AI-SaaS pattern:

- fake browser chrome
- metric tiles
- abstract product simulation
- frosted surface treatment

That makes the page feel more like a startup template than an internal clinical tool.

### Manager Dashboard

The manager dashboard currently presents four signals with nearly identical weight. It is calm, but too flat:

- the eye is not guided to the most important planning information
- the page leaves too much unused space on desktop
- healthy and important states look too similar
- empty states feel more absent than intentional

The redesign should solve these problems through layout, hierarchy, and copy rather than through louder colors or more components.

## Target Experience

### Product Tone

Teamwise should feel:

- calm
- dependable
- clinical
- ordered
- specific to respiratory scheduling

It should not feel:

- flashy
- startup-like
- promotional
- overloaded
- visually generic

### Landing Page

The public entry should behave like a front desk.

Users should immediately understand:

- this is where they sign in
- this is a trusted internal workspace
- access requests are supported, but secondary

The page should feel composed and quiet, not theatrical.

### Manager Dashboard

The first manager screen should behave like a charge board or planning sheet.

Users should immediately understand:

- the state of the current cycle
- whether the next cycle needs planning attention
- whether there are pending review items
- what to open next

The page should remain intentionally light, with only a few high-signal modules.

## Landing Page Design

### Core Direction

Keep the current color system and split-screen idea, but replace the simulated product demo with an editorial support panel.

The page should be built around one dominant object: the sign-in form.

### Desktop Composition

Use a two-part layout:

- left side: quiet brand and operational context
- right side: primary auth surface

The left side should no longer pretend to be a mini app. Instead, it should contain:

- brand mark
- concise heading
- one-sentence description
- a very small set of plain operational cues or support points

Examples of acceptable supporting content:

- schedule access
- availability updates
- team coordination

Examples of content to avoid:

- mock dashboards
- fake browser controls
- decorative metrics
- anything that looks like a generated SaaS hero

### Auth Hierarchy

Sign-in is primary.

Account creation remains visible, but secondary. It should read as:

- a clear alternative path
- not a co-equal choice

Forgot-password should remain easy to find, but visually subordinate to the main submit action.

### Mobile Composition

Mobile should not be a collapsed version of the desktop split view.

It should become a single-column access portal with:

- stronger top spacing
- immediate branding
- one clear form surface
- simpler framing

The mobile view should feel quieter and more direct than the current version.

### Copy Direction

Public copy should stay operational and restrained.

Use:

- clear sign-in language
- short contextual support text
- direct access-request language

Avoid:

- promotional phrasing
- vague trust claims
- filler reassurance

`Secured & encrypted` should be removed unless it is replaced by something more useful and product-specific.

### Interaction And States

The auth surface must support:

- sign-in
- forgot password
- account request
- success confirmation
- inline auth errors

These states should keep the same overall page hierarchy. State changes should happen inside the form area, not by reshaping the entire page.

## Manager Dashboard Design

### Core Direction

Keep the dashboard sparse, but stop treating all four signals as identical blocks.

The page should become a balanced two-zone layout:

- primary planning zone
- secondary review zone

### Layout

The primary zone should focus on cycle planning:

- current cycle
- next cycle readiness

These two items should carry the strongest visual weight.

The secondary zone should contain:

- pending approvals
- needs review

These items should remain useful, but visually quieter.

This can be achieved through:

- different module sizes
- stronger spacing rhythm
- clearer alignment
- reduced repetition

It should not rely on louder colors alone.

### Content Hierarchy

The reading order should be:

1. current cycle
2. next cycle
3. approvals
4. review updates

This preserves the balanced overview the user requested while still creating a meaningful first glance.

### Intentional Sparseness

The dashboard should still feel roomy, but not empty.

To avoid dead air:

- tighten the content width
- use stronger internal spacing
- optionally allow one narrow supporting contextual rail only if needed

Do not solve emptiness by adding more cards.

### State Expression

The dashboard needs clearer state language and visual treatment for:

- draft
- healthy
- waiting
- no next cycle
- caught up

Healthy or empty states should feel reassuring and complete, not like missing data.

### Action Treatment

Actions should remain visible, but quieter than the data.

They should feel like the next step after understanding the state, not like the primary visual event.

Ghost or text-forward actions remain appropriate, but their placement should be more consistent and tied to the most important modules.

### Mobile Behavior

Mobile should preserve hierarchy, not just stack identical blocks.

Recommended mobile order:

1. current cycle
2. next cycle
3. pending approvals
4. needs review

The first module should still read as primary. The rest should taper in emphasis.

## Visual System Constraints

The redesign should preserve the current visual system as much as possible.

### Preserve

- existing background and surface colors
- existing teal and amber relationship
- current shell styling direction
- current typography family choices

### Change

- hierarchy through scale and layout
- amount of decorative framing
- module repetition
- amount of microtype
- density of muted labels

### Avoid

- new dark-mode-first aesthetics
- neon or techy accents
- glass-heavy surfaces
- generic card-grid dashboard patterns
- gradient-heavy hero treatments

## Implementation Structure

This should stay a targeted presentation refactor.

### Likely Files

- `src/app/page.tsx`
- `src/components/manager/ManagerTriageDashboard.tsx`
- `src/components/AppShell.tsx`
- `src/app/globals.css`

### Guidelines

- Prefer reshaping existing components before introducing many new abstractions.
- Extract small presentation components only if the landing page or dashboard becomes hard to reason about.
- Reuse the existing tokens from `globals.css`.
- Keep route and data-loading behavior unchanged unless the redesign exposes a clear UI-only bug.

## Error Handling And Edge Cases

### Landing

- auth errors should stay inline and readable
- success states should confirm the next step without introducing noise
- forgot password should not feel like a separate page
- account request mode should remain clearly secondary but complete

### Dashboard

- loading states should preserve layout stability
- empty states should feel intentional
- long labels should not break the visual rhythm
- mobile should not create a cramped header or crowded first screen

## Testing Strategy

- verify desktop and mobile layouts for landing and manager dashboard
- verify sign-in, forgot-password, and account-request mode switching still works
- verify manager dashboard still reads clearly with both empty and populated states
- verify shell spacing still works across desktop and mobile
- run relevant lint and test commands for touched files before claiming completion

## Acceptance Criteria

- The landing page remains recognizably Teamwise without changing the existing palette.
- The landing page becomes auth-first and no longer uses a fake product mockup.
- Sign-in is the clear primary action.
- Account creation remains available but clearly secondary.
- Mobile landing feels intentionally designed for authentication rather than compressed desktop layout.
- The manager dashboard remains sparse and balanced.
- Current cycle and next cycle are visually prioritized over review counters.
- The dashboard no longer reads as four equal blocks.
- Empty and healthy states feel calm and intentional.
- The redesign improves hierarchy without changing core workflows or routing.
