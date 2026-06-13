# Manager UAT Checklist

Use this checklist with seeded/demo data before showing Teamwise to a manager. It is written for a non-technical reviewer: the goal is to confirm the manager can tell what needs attention and what to do next.

Do not use real staff records, real secrets, or production Supabase data for this pass.

## Setup

- [ ] Start the app from a fresh build or a known-good local server.
- [ ] Sign in as a seeded manager.
- [ ] Keep the responsive QA screenshots local. Do not commit screenshot artifacts.
- [ ] Write down confusing labels, missing next steps, or places where the manager asks "what now?"

## 1. Manager Dashboard

Goal: the manager should know the first thing to handle.

- [ ] The manager can find the current Schedule Block and schedule status.
- [ ] The Manager checklist gives a calm order of work.
- [ ] Needs your attention shows a clear Priority 1.
- [ ] If nothing needs action, the dashboard says that plainly.
- [ ] If data is incomplete, the page tells the manager to use Schedule as the final staffing source.

## 2. Availability

Goal: the manager can collect missing responses without guessing.

- [ ] The page shows how many therapists are missing availability.
- [ ] The checklist says to collect, review, then edit.
- [ ] The reminder action explains who will be reminded before sending.
- [ ] Recent duplicate reminder protection is understandable.
- [ ] Submitted therapists are clearly separate from missing therapists.

## 3. Schedule

Goal: the manager can see what is safe to do next.

- [ ] The Schedule toolbar shows the selected Schedule Block.
- [ ] Day and Night are easy to switch.
- [ ] The next-step line tells the manager whether to Auto-draft, Pre-flight, send preliminary, publish, or review.
- [ ] Open shifts and lead gaps are visible before publishing.
- [ ] Post-publish or offline states do not look like ordinary draft work.

## 4. Publish

Goal: the manager can check delivery without learning technical terms.

- [ ] The Publish checklist explains that publishing starts from Schedule.
- [ ] Sent, failed, and queued counts are easy to find.
- [ ] Lifecycle actions use plain language.
- [ ] Any failure copy tells the manager what to do next without exposing internal error text.

## 5. Team Import

Goal: the manager understands that nothing changes until the final import.

- [ ] The import checklist shows Choose file, Match columns, Review rows, Apply import.
- [ ] Bad rows are clearly skipped before import.
- [ ] The final review explains that only valid rows import.
- [ ] The manager can stop before the final button without changing roster data.

## 6. Responsive Check

Goal: the same manager path is readable on desktop, tablet, and mobile.

- [ ] Run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run qa:responsive`.
- [ ] Confirm the run is seeded mode when manager and therapist auth env vars are configured.
- [ ] Review manager dashboard, schedule, availability, team import, and audit-log screenshots.
- [ ] Note any clipped text, hidden actions, or confusing ordering.

## Pass Criteria

- [ ] The manager can name the first action to take on each page.
- [ ] Important warnings are visible but not alarming.
- [ ] Empty states explain whether the manager is done or should go somewhere else.
- [ ] No page requires technical knowledge to decide the next step.
