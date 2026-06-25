# Dogfood Testing

## Philosophy

Dogfood testing asks Codex to use RT Scheduler like a real respiratory therapy scheduling user, not like a test runner chasing selectors. The tester should form a real goal, navigate with the visible UI, make plausible mistakes, recover where possible, and notice where the app makes them think too hard.

Use this for private MVP/demo readiness, workflow QA, route-level browser checks, or UX/logistics review. It is not an invitation to broad refactors. Findings should be documented first; product fixes happen only after the user asks for implementation.

## Source Material

Before testing, inspect the current repo truth:

- `README.md`
- `docs/WORKFLOWS.md`
- `docs/DEMO_CHECKLIST.md`
- `docs/DEMO_SCRIPT.md`
- `docs/MANAGER_UAT_CHECKLIST.md`
- `docs/SETUP.md`
- `docs/CODEX_PROJECT_GUIDE.md`
- `src/app/` route structure
- existing focused specs in `e2e/`

Use those sources to choose scenarios and expected behavior. Do not invent unsupported product requirements.

## Test Like A Target User

Adopt the relevant persona and intent:

- manager building, editing, publishing, archiving, or reviewing a schedule block
- manager reviewing access requests, team roster, work patterns, availability intake, analytics, audit logs, and shift board requests
- lead or staff member reviewing schedule status and handling allowed workflow actions
- therapist entering recurring pattern, future availability, requests, preferences, notifications, and onboarding tasks
- pending user requesting access and understanding the waiting state

For each scenario, start with a plain-language goal such as "I need to publish next block without missing lead coverage" or "I need to ask someone to pick up my shift." Then use the app through visible controls, forms, links, buttons, keyboard focus, route transitions, and confirmation states.

## Browser Workflow

1. Start from a clean repo status with `git status -sb`.
2. Read the scenario sources listed above.
3. Choose the runtime:
   - routine E2E regression: `npm run test:e2e`
   - focused Playwright spec: `npm run test:e2e -- <spec>`
   - final product-feel QA: `npm run build`, `npm run start:prod:local`, then browser against `http://127.0.0.1:3001`
   - responsive capture: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run qa:responsive`
4. Seed only when needed and allowed by local env:
   - baseline demo: `npm run seed:demo`
   - fuller UAT workflows: `npm run seed:functional`
   - seeded users: `npm run seed:users`
5. Use Playwright/browser automation for real interactions:
   - click through navigation rather than jumping directly to every URL
   - type into forms, submit, cancel, backtrack, and retry invalid input
   - test keyboard focus where the route is form-heavy or action-heavy
   - check loading, disabled, empty, success, error, and confirmation states
   - check desktop and mobile when layout or responsive capture is relevant
6. Save screenshots, traces, or terminal output only when they support a finding. Keep generated artifacts local and out of commits unless explicitly requested.

Responsive QA accepts `manager`, `therapist`, and `staff` persona names; `staff` maps to therapist/staff-facing routes. Each route capture includes a full-page screenshot plus a `-viewport.png` screenshot for checking fixed navigation and what the user actually sees without full-page stitching artifacts.

## Friction To Record

Record friction when the experience causes:

- confusion about what state the app is in
- dead ends with no obvious next action
- repeated unnecessary thinking
- unclear next action after a save, publish, submit, approval, decline, or error
- mismatch between UI wording and actual behavior
- missing validation or validation that appears too late
- missing recovery path, cancellation path, or reversal explanation
- print, export, or readability problems where those workflows are relevant
- mobile layout issues, clipping, inaccessible controls, or horizontal overflow
- role confusion between manager, lead, therapist, staff, and pending users
- lifecycle confusion around draft, preliminary, final/published, archived, offline, submitted, accepted, declined, withdrawn, or approved states

Do not count a friction point as real merely because the UI could be prettier. Tie every finding to a user goal and operational impact.

## Finding Categories

Classify each finding into exactly one bucket:

- `Must fix before private MVP/demo`: blocks a core demo path, risks incorrect schedule/request/approval state, hides critical information, or prevents a target user from completing a required workflow.
- `Should fix soon`: does not block the demo, but causes meaningful hesitation, avoidable support burden, or likely user error.
- `Nice later`: polish, comfort, copy refinement, or lower-frequency improvement with no current workflow risk.
- `Not a real issue / leave alone`: expected behavior, intentionally constrained behavior, test-data artifact, or concern contradicted by repo docs/code.

## Evidence Required

Every finding must include:

- page or flow tested
- exact user goal
- steps performed
- what happened
- expected behavior from repo docs/code
- why it matters
- suggested fix
- confidence level: `high`, `medium`, or `low`
- evidence link or path when screenshots, videos, traces, logs, or specs were generated

Use `low` confidence when the finding depends on missing seed data, missing secrets, unclear product intent, or a route that could not be exercised with the available local environment.

## Report Shape

Keep the report implementation-ready:

```markdown
## Commands Run

## Scenarios Tested

## Findings

### Must Fix Before Private MVP/Demo

### Should Fix Soon

### Nice Later

### Not A Real Issue / Leave Alone

## Screenshots And Traces

## Recommended Next Implementation Batch

## Verification Status
```

The recommended next implementation batch should be small and coherent. Do not bundle unrelated UX polish with lifecycle or data-integrity fixes.
