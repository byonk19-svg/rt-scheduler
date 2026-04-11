# Therapist-First Homepage Redesign

**Date:** 2026-04-11  
**Status:** Approved for implementation

## Background

The public homepage already has the correct product frame and route shape, but it still reads like a generic SaaS hero. The redesign should make a respiratory therapist feel two things immediately:

1. **Trust** - the product feels calm, reliable, and professionally grounded
2. **Usefulness** - the workflow looks clear and low-friction for day-to-day staffing work

The page should stay focused on the homepage hero experience. This is not a multi-section marketing rewrite, a navigation overhaul, or a product strategy change.

---

## Goal

Redesign `src/app/page.tsx` into a therapist-first landing page with a clinical premium feel. The final page should preserve the existing product story while making the visual direction more intentional and memorable.

Success is:

- therapists feel reassured rather than sold to
- the page feels premium without feeling sterile
- the app preview looks embedded in the page rather than dropped in afterward
- the implementation remains idiomatic to the current Next.js + Tailwind codebase

---

## Audience

Primary audience: **respiratory therapists** evaluating whether this workspace will make their weekly scheduling experience calmer and clearer.

Secondary consideration: managers still need to recognize the product as operationally credible, but the page should not optimize for executive-dashboard energy.

---

## Chosen Direction

### Recommended aesthetic: Luminous Clinical

The homepage will use a **clinical premium** tone:

- warm ivory surfaces instead of cold white
- mineral teal as the trusted product anchor
- amber kept as a restrained accent, not a dominant marketing color
- heavy, confident typography with more breathing room and calmer supporting copy

The one memorable visual move is **warm clinical light**. A faint **schedule-grid rhythm** can support it, but the grid should remain secondary and atmospheric.

### Explicit non-goals

- no portrait-led or lifestyle photography
- no generic startup gradients
- no denser dashboard-first aesthetic
- no large new content stack below the fold unless implementation reveals a clear usability reason

---

## Page Structure

Keep the current single-screen homepage structure and improve its visual discipline rather than replacing it.

### Header

- preserve the current brand mark, sign-in link, and primary CTA
- refine spacing and balance so the header feels quieter and more premium
- keep CTA hierarchy obvious without making the top bar feel sales-heavy

### Hero

- retain the current hero-first architecture: eyebrow, headline, support copy, CTA pair, approval note, preview frame
- update copy tone only as needed to better match therapist-first reassurance and everyday usefulness
- tighten text measure so the hero reads as deliberate, not oversized for its own sake

### Preview frame

- keep the preview directly beneath the hero messaging
- visually anchor it into the page with ambient framing layers, softer edge treatment, and stronger integration with the background light
- the preview should feel like a window into the workspace, not a detached screenshot card

---

## Component Plan

The implementation may remain in `src/app/page.tsx` if the file stays readable. If visual complexity grows, split only into focused local homepage components:

- `LandingHeader`
- `LandingHero`
- `LandingPreviewFrame`

Decorative background systems should live in `src/app/globals.css` as reusable utility classes or CSS variables instead of introducing unnecessary component logic.

This redesign should prefer small, reversible edits over new abstractions.

---

## Visual System

### Typography

- keep the existing `Plus Jakarta Sans` heading system because it already matches the product and repo conventions
- tune headline scale, tracking, and line breaks for calm authority rather than brute size
- keep supporting copy lighter and narrower to create a better trust-to-action rhythm

### Color

- deepen the existing ivory / teal / amber palette into a more intentional set of surface and glow values
- use CSS variables where new recurring values are needed
- teal remains the dominant product signal
- amber remains a supporting accent for badges and attention moments only

### Background treatment

- build a luminous background field using layered radial gradients
- add subtle grain or atmospheric softness only if it can be achieved cleanly in CSS
- keep the schedule-grid texture very faint and secondary

### Layout

- add more negative space around the hero block
- keep the page left-aligned and confident rather than centered like a generic template
- make the transition from hero content to product preview feel continuous

---

## Motion

Motion should be restrained and high-value:

- soft reveal for hero content on load
- subtle lift or depth treatment for the preview frame
- optional hover polish for CTAs

Do not add decorative continuous motion. Reduced-motion preferences must remain respected.

---

## Implementation Notes

- detect and follow existing project patterns: Next.js App Router, Tailwind 4, `next/image`, current button primitives, and existing CSS token usage
- match the repo's current look and component conventions rather than importing a disconnected marketing style
- if new CSS utilities are added, keep them small and clearly named
- preserve current accessibility basics: semantic header/main structure, accessible link/button labels, clear CTA text

---

## Files Expected To Change

- `src/app/page.tsx` - homepage structure and visual composition
- `src/app/globals.css` - supporting visual tokens and homepage-specific background utilities
- optionally `src/app/page.test.ts` - if homepage copy assertions need to be updated to the approved design language

No new dependencies should be introduced.

---

## Verification

Implementation should be considered complete only when all of the following are true:

- homepage renders cleanly in the Next app
- no console errors appear during page load
- layout holds at common mobile and desktop widths
- CTA hierarchy remains clear in both header and hero
- the final page clearly reads as therapist-first, trust-forward, and useful

Visual review standard:

- primary signal is calm trust
- secondary signal is practical scheduling clarity
- the page feels intentionally designed, not generic
