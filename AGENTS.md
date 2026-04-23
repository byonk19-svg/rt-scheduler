<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->

YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE CLEAR, LOW-RISK TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED.
ONLY ASK WHEN THE DECISION IS TRULY AMBIGUOUS, DESTRUCTIVE, IRREVERSIBLE, OR HAS MATERIAL PRODUCT TRADEOFFS.
IF BLOCKED, TRY A SAFER ALTERNATIVE APPROACH BEFORE ESCALATING.
USE SUBAGENTS ONLY WHEN THEY MATERIALLY IMPROVE SPEED, QUALITY, OR CORRECTNESS.

<!-- END AUTONOMY DIRECTIVE -->

# AGENTS.md — RT Scheduler

## Product intent

This is a respiratory therapy scheduling app.

The product should feel:

- simple
- obvious
- cohesive
- low-friction
- user-friendly
- maintainable

Do not treat this repo like a generic CRUD dashboard.
Optimize for real scheduling workflows, clear state, predictable actions, and fast understanding.

If the app feels disjointed, prefer:

- restructuring
- consolidation
- renaming
- layout cleanup
- state cleanup
- route simplification

over patching around weak structure.

## Primary user roles

### Therapist / staff

Primary jobs:

- review the current cycle
- enter or update availability
- save progress
- submit availability
- review published schedule information

### Lead

Primary jobs:

- review staffing
- review schedule state
- update allowed assignment statuses where permitted
- help with operational schedule review

### Manager / admin

Primary jobs:

- approve access
- create and manage 6-week cycles
- build and edit staffing
- review submissions
- publish schedules
- manage publish history
- handle exceptions and operational updates
- manage roster/team setup

## Core product surfaces

### `/coverage`

Canonical scheduling and staffing surface.
This is the main manager scheduling workspace.
Supports Grid and Roster views.

### `/schedule`

Read-only roster matrix for managers and leads.
Use this as a viewing/review surface, not the primary editing surface.

### `/therapist/availability`

Therapist availability workflow for the selected cycle.

### `/publish`

Publish history and cycle lifecycle actions.

### `/profile`

User preferences such as layout preference.

## Product workflow rules

- Current cycle or scheduling context should always be visible.
- Pages should make it obvious what the user is looking at.
- Each page should have one obvious job.
- Draft / submitted / published / finalized states must be handled consistently everywhere.
- If two routes overlap too heavily in purpose, prefer consolidation or clearer role separation.
- Important actions should appear in predictable locations.
- Terminology must stay consistent across pages, dialogs, chips, banners, tables, and buttons.
- Mobile and desktop should feel like the same product, not two unrelated implementations.
- Prefer fewer, clearer patterns over many one-off patterns.

## UX standards

Optimize for:

- clarity first
- easy scanning
- obvious next actions
- consistent page structure
- consistent status display
- minimal user memory burden
- practical, clean interfaces

Do not optimize for:

- cleverness
- flashy UI
- unnecessary complexity
- preserving bad structure because it already exists
- one-off components that solve only one page’s problem
- abstractions with no product payoff

## UX consistency rules

When editing or adding UI, prefer consistency across:

- headers
- page framing
- section titles
- action bars
- filters
- drawers
- dialogs
- tables
- roster/grid controls
- status chips
- warning banners
- empty states
- loading states

Questions to use during implementation:

- Is the page purpose obvious in 5 seconds?
- Can the user tell what cycle they are in?
- Can the user tell what state they are in?
- Is the next action obvious?
- Does this page feel like the same product as the rest of the app?
- Did this change reduce confusion or add to it?

## Architecture rules

- Centralize scheduling state rules, permission rules, and cycle-selection rules.
- Avoid duplicating scheduling, cycle, availability, staffing, or status logic across pages/components.
- Reuse existing utilities and patterns before creating new abstractions.
- Keep changes surgical unless a larger restructure clearly improves cohesion.
- Prefer deletion over addition when simplifying.
- No new dependencies without explicit need.
- Do not introduce speculative abstractions.
- Do not add configurability that the product does not need.
- Keep diffs reviewable and reversible.
- Preserve or improve behavior clarity with every change.

## Change strategy

When a request touches workflow, navigation, or UI structure:

1. Diagnose whether the problem is:
   - visual inconsistency
   - workflow confusion
   - duplicated responsibility
   - scattered business logic
   - weak information hierarchy
   - bad naming/terminology
   - route/page sprawl

2. Prefer the highest-leverage fix:
   - simplify the workflow
   - consolidate duplicate surfaces
   - standardize patterns
   - centralize state/business logic
   - rename confusing concepts
   - remove unnecessary UI

3. Do not protect the current implementation just because it already exists.

4. If a bigger restructure would clearly improve the product, recommend it and implement it when safe.

5. Stop structural cleanup when the remaining work is mostly isolated, domain-heavy widgets or micro-extractions that do not make the product meaningfully easier to understand or maintain.

## Coding rules

- Make the minimum sufficient change.
- Keep edits tightly scoped to the actual problem.
- Do not "improve" unrelated code unless required for the task.
- Lock behavior with tests before refactor/cleanup work when behavior is not already protected.
- Prefer existing patterns unless the existing pattern is part of the problem.
- If an existing pattern is causing disjointed UX or architecture, improve the pattern instead of copying it again.
- Be honest about uncertainty and verification gaps.

## Read before major UI/workflow changes

Before making major workflow or UX changes, inspect:

- the route being changed
- adjacent routes with similar responsibilities
- shared layout/components used by those routes
- current tests covering the affected workflow
- any existing cycle/state/role utilities involved

Do not redesign a page in isolation if it participates in a broader workflow.

## Commands

Install:

- `npm install`

Local dev:

- `npm run dev`

Production-like local validation:

- `npm run build`
- `npm run start:prod:local`

Lint:

- `npm run lint`

Unit tests:

- `npm run test:unit`

E2E tests:

- `npm run test:e2e`

## Verification standards

Do not claim completion without verification.

Minimum expectations:

- run lint for changed code
- run relevant unit tests when logic changed
- run relevant e2e tests when workflow or UI behavior changed
- use production-like validation for final browser/workflow trust when the behavior is sensitive to real build/runtime behavior

Repository-wide confidence checks:

- for broad refactor lanes or verification sweeps, prefer:
  - `npm run lint`
  - `npm run test:unit`
  - `npm run build`
- treat lint warnings as debt to report, not as blocking failures, unless they break the configured command

For UI/workflow work, also verify:

- the affected role can complete the workflow
- the cycle/context display is correct
- state labels are understandable
- the page is not more fragmented than before
- desktop and mobile behavior remain coherent when applicable

If Playwright is available, use it for workflow validation instead of relying only on code inspection.

## Completion contract

A task is not done unless:

- the requested change is implemented
- the affected workflow is coherent
- the change does not make the app feel more fragmented
- verification was actually run and reviewed
- known risks or gaps are reported honestly

## Final response format

Final reports must include:

- what changed
- files changed
- why the change improves the product or workflow
- what verification was run
- any remaining risks / follow-up items

## Commit guidance

Write commit messages around why the change was made, not just what changed.

Good commit messages usually include:

- the workflow or product reason
- any important constraint
- what was tested
- any known gap

## Subagent guidance

Default posture: work directly.

Use subagents only when the work clearly benefits from parallel or specialized execution, such as:

- repo mapping
- workflow audit
- UX consistency audit
- test gap review
- large bounded refactors with clear file ownership

Do not spawn subagents for trivial tasks.
Do not delegate instead of reading the code.

## Repo-specific success criteria

Success in this repo looks like:

- a manager can understand and use the scheduling surfaces without hunting
- a therapist can understand where to enter and submit availability
- schedule state is obvious
- routes feel intentionally separated, not accidentally duplicated
- the app feels like one coherent scheduling product

---

## Optional OMX compatibility note

If OMX tooling requires generated runtime sections or markers, keep those sections below this hand-written repo guidance.

Those generated sections must support this file, not override the repo-specific product rules above.

Repo-specific product/workflow guidance takes precedence over generic orchestration detail.
