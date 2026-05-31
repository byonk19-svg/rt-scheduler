# Audit Implementation Handoff

Date: 2026-05-31

This document records the current pickup point after the healthcare scheduling audit follow-through work. It is intended as the first file to read when resuming this work in a new chat.

## Current Repository State

- Local branch at reassessment: `main`
- Local `main` was synced with `origin/main`
- Latest merged audit follow-up at reassessment: `52ce5307 Merge pull request #155 from byonk19-svg/codex/preflight-ineligible-assignments`
- The original audit source docs were intentionally left untracked during implementation:
  - `docs/AUDIT_REPORT.md`
  - `docs/HIGH_IMPACT_IMPROVEMENTS.md`
  - `docs/QUICK_WINS.md`

Do not accidentally stage those three audit source docs unless the user explicitly asks to preserve them in the repo.

## Verification At Reassessment

The reassessment did not change application code. The current `main` passed:

- `npm run lint`
- `npm run test:unit`
  - 237 test files passed
  - 1,445 tests passed
- `npm run build`
- `npm run typecheck`
- `git diff --check`

## Completed Audit Work

The highest-risk audit findings have been addressed and merged:

- Manager dashboard open-shift pressure no longer routes managers into Lottery.
- Manager planner availability writes, deletes, and copy actions were hardened with app-layer target validation.
- Schedule Block lifecycle labels now distinguish states such as Draft, Preliminary, Published, Offline, and Archived where they matter.
- Schedule labels were cleaned up around Need Off, Day shift, Night shift, and lead markers.
- Shift request vocabulary now uses actor-facing copy:
  - Requester: Need coverage
  - Responder: Pick up shift
  - Manager/object: Coverage request or Trade request
  - Queue/list: Open coverage requests
- Manager Access navigation is first-class and includes pending access visibility.
- Request composer UX was improved without changing backend request semantics.
- Pre-flight readiness moved from aggregate counts toward actionable issue rows.
- Pre-flight now surfaces missing availability, open Shift Board requests, and ineligible assignments before schedule release.
- Published/preliminary readiness guards now use the blocking readiness issue model for critical release blockers.
- Availability provenance for manager-entered records was made visible.
- Schedule access-denied states now explain manager-only restrictions instead of looking broken.
- Analytics visible copy now uses Schedule Block terminology instead of exposing user-facing "cycle" language.

## Current Assessment

The application is in a materially better state than the original audit snapshot. The most important safety, workflow-routing, terminology, lifecycle-visibility, and pre-flight readiness issues are now covered by focused tests and merged in small branches.

The remaining work should be treated as lower-risk product hardening and workflow refinement, not as urgent safety repair. Avoid bundling the remaining items into one large diff.

## Recommended Next Work

### 1. Manager command-center IA

Remaining audit concern: Publish, Analytics, Audit Log, settings, and some operational queues are still more secondary than a full manager command model.

Recommended slice:

- Audit current manager navigation and dashboard entry points.
- Promote only the next most important destination if evidence supports it.
- Keep this separate from pre-flight, notifications, and lifecycle changes.

### 2. Offline, republish, and archive lifecycle matrix

Remaining audit concern: offline schedules need one consistent answer for visibility, request closure, notification behavior, reversal, and republish.

Recommended slice:

- Build a lifecycle matrix first.
- Then implement one lifecycle transition at a time.
- Do not start with UI polish; start with deterministic rules and tests.

### 3. Notification matrix

Remaining audit concern: notifications exist across schedule, shift-board, availability, and publish flows, but event ownership, routing, dedupe, and reversal behavior should be explicit.

Recommended slice:

- Create a notification event matrix in code or docs.
- Add tests around the highest-risk event transitions first:
  - preliminary sent/refreshed
  - final published
  - schedule taken offline
  - shift request accepted, withdrawn, denied, approved
  - manager-entered availability

### 4. Availability editor overwrite safeguards

Remaining audit concern: copy/clear actions can overwrite meaningful availability selections.

Recommended slice:

- Add confirmation or friction only around destructive overwrite paths.
- Keep normal save/submit flow unchanged.
- Add tests for copy/clear replacing existing selections.

### 5. Browser smoke walkthroughs

Remaining audit concern: unit/build verification is strong, but a final persona walkthrough would catch remaining real-use confusion.

Recommended slice:

- Use seeded manager, lead, therapist, and pending-user states.
- Walk manager dashboard, Schedule, Availability, Shift Board, Access, Publish, Analytics, and therapist request creation.
- Prefer repo-local test auth setup over a human browser session.

## Guardrails For The Next Chat

- Start with `git status --short --branch`.
- Keep the three audit source docs out of commits unless the user explicitly asks otherwise.
- Continue using small PR-sized batches.
- Do not mix lifecycle/notification/manager IA/request UX work in the same branch.
- For behavior changes, run focused tests first, then `npm run test:unit`, `npm run lint`, `npm run build`, `npm run typecheck`, and `git diff --check`.
- On this repo, run `npm run build` before `npm run typecheck` if `.next/types` may be missing.
