---
name: playwright-chromium-stabilization
description: Stabilize rt-scheduler Chromium Playwright runs by diagnosing fixture drift, route readiness, stale assertions, seeded Schedule Block setup, and Windows startup wrapper behavior. Use when full Chromium, nightly E2E, route readiness, seeded-state, or flaky Playwright specs fail.
version: 1.0.0
---

# Playwright Chromium stabilization

Use this when the job is to make the repo's Chromium E2E suite reliable or to report a read-only suite run.

## Hard rules from past sessions

- Do not undo `scripts/playwright-web-server.mjs`.
- Do not set `reuseExistingServer` back to true by default.
- Do not fix failures by adding arbitrary long timeouts.
- Prefer fixture, selector, route-readiness, and contract fixes.
- If the user asks for report-only output, do not edit files.

## Read-only report mode

When the user asks only to run/report, include:

- pass count
- fail count
- skipped count
- failed specs
- root-cause notes
- total runtime
- whether full Chromium is reliable enough for CI

If shell or sandbox startup fails before Playwright starts, report that as blocked. Do not invent counts.

## Diagnosis order

1. Confirm wrapper/server behavior and port ownership.
2. Run the smallest failing spec first with line reporter.
3. Inspect trace, error snapshot, and rendered DOM before changing assertions.
4. Fix shared fixture/setup drift before spec-local assertions when multiple specs fail.
5. Rerun the individual spec.
6. Only after isolated specs pass, rerun the broader Chromium lane.

## Common repo facts

- `playwright.config.ts` should start through `node scripts/playwright-web-server.mjs --port ${port}`.
- On this Windows setup, child process launch has needed `spawn('npm', ..., { shell: true })`.
- `createScheduleCycle` supports `availabilityDueAt`; availability and recurring-pattern flows often require it.
- Current UI copy has used `Day shift`, `Night shift`, `Not submitted`, `Submitted with changes for this Schedule Block.`, and `Submitted with requests`.
- Route helpers like `gotoWithRetry` and request helpers like `openShiftBoard(page)` are better than raw `page.goto` plus broad text assertions.
- If a snapshot shows a card rendered but a text assertion fails, suspect selector scope/readiness before data absence.

## Fix preferences

- Use stable roles, headings, containers, or existing helpers.
- Scope repeated labels to a panel/card/table region.
- Update stale UI expectations only when source/browser evidence shows the current UI is intentional.
- Seed active Schedule Block context explicitly instead of relying on default data.
- Keep one suite owning the Playwright server at a time; parallel suites can collide with wrapper preflight cleanup.

## Verification

```powershell
npx playwright test <spec> --project=chromium --reporter=line --workers=1
npx playwright test --project=chromium --reporter=line
```

Run relevant unit/type/lint/build checks if code outside E2E tests changes.

## Suggested subagent

- `/prompts:playwright-stabilizer` for isolated trace/snapshot analysis and minimal fix recommendations.
