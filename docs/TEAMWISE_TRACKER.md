# Teamwise Tracker

`docs/teamwise-feature-user-story-tracker.xlsx` is the canonical evidence ledger for
the Teamwise scheduling workflow. Use it to connect product stories, app surfaces,
tests, defects, and verification runs without turning chat history into the source
of truth.

## Workbook Tabs

- `User Stories`: the expected behavior by story, persona, route/API surface,
  priority, verification status, manual status, automated coverage, and linked
  defects.
- `Route Inventory`: tracked `src/app` surfaces that should stay represented as
  route, layout, loading, and action files move.
- `Test Mapping`: tracked automated test files and the story or review status
  they support.
- `Defects`: `DEF-*` findings, linked stories, severity, status, fix commits,
  and retest results.
- `Test Runs`: `RUN-*` verification evidence, including commands, browser paths,
  environment, results, covered stories, artifacts, and notes.
- `Summary`: workbook-level counts and the current testing posture.

## When To Update It

Update the workbook when one of these changes:

- a new route, API route, layout, loading state, or app action file is added under
  `src/app`
- a tracked route/app action file is removed or renamed
- a new `e2e/*.spec.ts` file or `src/**/*.test.*` / `src/**/*.spec.*` file is
  added
- a real verification pass should be retained as a new `RUN-*`
- a product or test failure should be retained as a new `DEF-*`
- a fix commit changes the verification status for one or more stories

Do not update it just to burn down broad `Not reviewed in current testing loop`
rows. Those rows are inventory, not an open mandate. Review them only when a
specific story, workflow, release gate, or changed file makes the row relevant.

## Run And Defect Rules

Use the next sequential `RUN-*` ID for a verification pass that matters later.
Record the exact command or browser path, environment, result, covered stories,
artifact path if retained, and a short note. If a run exposes a real product or
test issue, add or update a linked `DEF-*` row.

Use the next sequential `DEF-*` ID only for reproducible findings or intentional
`Not reproduced - current pass` evidence. Every defect row should link to a story
when possible and should eventually name the fix commit and retest result.

For workbook-only evidence updates, keep the commit workbook-scoped unless the
same lane intentionally changes tests or app behavior.

## Validation

Run this after workbook edits and before committing tracker upkeep:

```powershell
npm run validate:teamwise
```

The validator compares the workbook against tracked source files. It fails when:

- a current `src/app` route/layout/loading/error/not-found/action/API file is
  missing from `Route Inventory`
- a current e2e or unit/spec test file is missing from `Test Mapping`
- `Summary` counts for stories, route/source entries, or automated test files are
  stale

It warns when a workbook inventory row points to a file that is no longer tracked
by git. Treat warnings as cleanup prompts, not automatic blockers.

For behavior changes, also run the focused tests or browser checks that prove the
story. The tracker validation only proves that the workbook inventory did not
drift from the repo.

## Fresh QA Evidence

Use `docs/testing/DOGFOOD_TESTING.md` for real browser dogfood passes. A good
tracker-backed pass includes visible navigation, clicks, form input or keyboard
actions where relevant, route transitions, and clear pass/fail evidence. Retain
screenshots or traces only when they support a finding, and keep generated
artifacts out of commits unless explicitly requested.
