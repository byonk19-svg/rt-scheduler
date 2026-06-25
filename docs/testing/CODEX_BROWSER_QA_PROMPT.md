# Codex Browser QA Prompt

Paste this into Codex when you want a realistic browser dogfood pass without code changes.

```text
Run a repo-local browser dogfood QA pass for this app.

Scope:
- Do not change app behavior.
- Do not implement product fixes.
- Do not commit or push.
- Inspect the repo first: README.md, AGENTS.md, docs/CODEX_PROJECT_GUIDE.md, docs/WORKFLOWS.md, docs/DEMO_CHECKLIST.md, docs/DEMO_SCRIPT.md, docs/MANAGER_UAT_CHECKLIST.md, docs/SETUP.md, package.json, playwright.config.ts, src/app, and e2e.
- Use docs/testing/DOGFOOD_TESTING.md as the reporting and classification standard.

Runtime:
- Start with git status -sb.
- Discover the correct install/dev/lint/typecheck/test/browser commands from package.json and docs.
- Prefer Playwright/browser automation over source-only review for user-facing scenarios.
- Use seeded or disposable local test users when the repo supports them.
- For responsive QA, `--personas=staff` is accepted as an alias for the therapist/staff-facing route set.
- If secrets or Supabase env are missing, run the public or reduced scenario set and report the limitation clearly.
- Stop and ask only for secrets, migrations, package installs, destructive actions, auth/provider changes, production/cloud changes, or unclear safety/product decisions.

Testing behavior:
- Act like real target users, not a happy-path script.
- Navigate using visible UI where practical.
- Exercise clicks, keyboard actions, form input, invalid input, cancel/retry paths, route transitions, disabled/loading states, success/error messages, and mobile layout where relevant.
- Document friction before recommending fixes.
- Avoid broad refactors or speculative product changes.

App-specific scenarios to infer from repo docs:
- Public homepage, signup/request access, login, reset password, pending setup, and onboarding.
- Manager schedule-block planning, /schedule grid editing, auto-draft/pre-flight, template save/apply, publish, start-over, archive, and publish history.
- Manager availability review, manual/email intake, copy-from-last-block, and therapist submission visibility.
- Therapist recurring work pattern, future availability, settings/preferences, notifications, and read-only schedule review.
- Staff request creation, direct/team swap or pickup request lifecycle, shift board review, pickup interest, recipient acceptance, manager approval/decline, and notifications.
- Team roster, work patterns, CSV import, analytics, audit log, and role/permission boundaries.
- Responsive behavior for manager and therapist workflows on desktop and mobile.

Extra scenarios from the user:
[Paste any extra scenario, account, route, or workflow constraints here.]

Final response format:

## Commands Run
- Include exact commands and whether they passed, failed, or were skipped.

## Scenarios Tested
- List persona, page/flow, user goal, and status for each scenario.

## Issues Found
- Group into:
  - Must fix before private MVP/demo
  - Should fix soon
  - Nice later
  - Not a real issue / leave alone
- For each issue include page/flow tested, exact user goal, what happened, why it matters, suggested fix, confidence level, and evidence path if generated.

## Screenshots/Traces
- List screenshot, video, trace, summary, and `-viewport.png` paths. Say "none generated" if none were produced.

## Recommended Next Implementation Batch
- Suggest the smallest coherent batch of fixes. Do not implement unless explicitly asked.

## Verification Status
- Summarize what was verified, what could not be verified, and why.
```
