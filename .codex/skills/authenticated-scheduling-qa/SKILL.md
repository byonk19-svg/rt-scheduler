---
name: authenticated-scheduling-qa
description: Run authenticated manager/staff scheduling QA and scoped UX/copy polish for rt-scheduler. Use for Schedule Block terminology, role-appropriate scheduling copy, authenticated screenshot capture, empty/loading/error states, scheduling dashboard clarity, and small no-redesign workflow polish.
version: 1.0.0
---

# Authenticated scheduling QA

Use this for product-facing scheduling QA where the repeated user intent is: real workflow clarity, role-safe copy, and evidence from authenticated routes.

## Defaults

- Cover manager, lead, and staff/therapist surfaces when the request is broad.
- Keep changes scoped: terminology, hierarchy, spacing, state clarity, and honest empty/error/loading states.
- Do not redesign, add features, or change scheduling behavior unless the task explicitly asks for it.
- Use `Schedule Block` in user-facing scheduling copy. Avoid `cycle`, `period`, `schedule cycle`, and `roster cycle` unless the code/API name is not displayed.
- Staff-facing text should be calm, direct, and non-technical. Do not expose raw technical errors.
- Do not invent unsupported actions in empty states.

## Surfaces to check

Start from the actual route/component map in the checkout. Common surfaces are:

- manager dashboard
- `/schedule`
- `/coverage` compatibility or coverage editing surface
- `/availability`
- `/publish`
- `/approvals`
- `/shift-board`
- staff dashboard
- staff schedule/my-shifts aliases
- therapist availability
- `/lottery`
- `/team` and roster surfaces when the request includes staffing context

## Browser QA path

Prefer the repo capture script when local auth/env is available:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
$env:SHOT_VIEWPORTS='desktop'
$env:SHOT_PERSONAS='manager,staff'
node --env-file=.env.local scripts/capture-all-screens.mjs
```

Use mobile variants when the request mentions mobile or whole-site coverage. If browser QA is blocked, inspect source and say exactly which auth/env/runtime prerequisite blocked it.

## Polish rules

- Keep one term for one concept across adjacent screens.
- Preserve manager/staff vocabulary boundaries.
- Prefer shorter labels and direct next steps over explanatory paragraphs.
- Keep existing layout and behavior unless the task asks for structural change.
- Make empty/error/loading states actionable: what happened, whether data is missing or blocked, and what to do next.
- Check for disabled-but-visible controls, duplicate labels, and ambiguous "current" versus "future" Schedule Block context.

## Tests

For copy-only changes, add or update targeted tests only where the app already asserts displayed copy or navigation labels. For behavior changes, add regression tests around the changed state path.

Common useful targets:

```powershell
npm run test:unit -- schedule publish availability dashboard therapist-workflow
npm run format:check
npm run lint
npm run typecheck
npm run build
```

## Suggested subagents

- `/prompts:scheduling-ux-copy-auditor` for authenticated route inventory, terminology drift, and role-safety findings.
- `/prompts:schedule-lifecycle-auditor` if copy confusion reflects a real lifecycle ambiguity.
