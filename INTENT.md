# Teamwise — Intent & Purpose

> **For agents:** Read this before `CLAUDE.md`. This document explains _why_ the app exists and _who_ it serves. `CLAUDE.md` explains _how_ to work with the code.

---

## Context

**Organization:** Respiratory Therapy department at HCA Tomball (Houston, TX).
**Team size:** ~22 therapists.
**Built by:** The department manager, for internal use only. There is no plan to sell this to other hospitals.
**`site_id` in the schema** is an unused placeholder — it refers to HCA Tomball and has no multi-tenant significance.

---

## What Problem This Solves

Respiratory therapy departments at hospitals have always scheduled staff using shared paper calendars, spreadsheets, or whiteboards. The manager (often a director or lead RT) has to:

1. Collect availability preferences from every therapist for the next 6-week block
2. Build a shift roster that satisfies coverage minimums, lead-eligibility rules, weekend rotation fairness, and individual constraints (FMLA, PRN restrictions, etc.)
3. Share a draft with staff so they can claim open slots or flag conflicts
4. Approve changes, resolve gaps, and finally distribute the finalized schedule

This is time-consuming, error-prone, and creates coordination friction. Availability responses arrive via text, paper forms, or word-of-mouth. The manager manually checks constraints. Staff find out about their schedule late.

**Teamwise replaces that paper workflow with a structured digital system** — giving the manager tools to collect, plan, draft, preview, approve, and publish schedules; and giving therapists a clear interface to submit availability, view their schedule, and make coverage requests.

---

## Who Uses This

### Manager (scheduling director or lead)

The primary power user. Manages the full scheduling lifecycle, approves access for new staff, resolves conflicts, and publishes the final schedule. In a typical RT department this is one or two people. All the complexity of the system is exposed here — constraint checking, coverage gaps, preliminary approvals, force-on/force-off overrides.

### Lead Therapist

A senior clinician who has one additional real-time responsibility: marking whether assigned therapists actually showed up (called in sick, left early, on-call, etc.). There are multiple leads per department. Leads do not coordinate scheduling with the manager — they only update operational status on the day. They also experience the therapist UI for their own schedule and swap requests.

### Therapist (standard staff)

Uses the app primarily to submit availability (which days they need off or want to work) and to view their published schedule. Can also post or claim shift swaps through the shift board, and claim open slots during the preliminary preview window. This is a lower-frequency interaction — mostly once per 6-week cycle plus day-of swap activity.

### Pending / New Staff

Signs up, then waits for manager approval before accessing anything. The `employee_roster` pre-match on `/team` lets managers pre-load staff names so approved users get their role and profile defaults automatically on first login.

---

## The Core Scheduling Cycle (The Heartbeat of the App)

Every 6 weeks, the manager runs through this lifecycle:

```
1. Create new cycle           /coverage → "New 6-week block"
2. Collect availability       /availability → therapists submit force_on / force_off dates
3. Review + plan              /availability planner → manager sets overrides, notes conflicts
4. Auto-draft                 /coverage → pre-flight check → generate draft
5. Manual polish              /coverage → shift editor dialog → fill gaps, set leads
6. Preliminary preview        /preliminary → send snapshot; staff claim open slots
7. Approve requests           /approvals → manager reviews claims with coverage impact
8. Publish                    /coverage → final publish → email to all staff
9. Live ops (ongoing)         /shift-board → swap requests, pick-ups, call-ins
```

This cycle is the main organizing principle of the codebase. Most features exist to serve one step in this lifecycle.

---

## Key Domain Concepts

| Term                      | What it means                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cycle**                 | A 6-week scheduled block. Has a start date, end date, and published/draft state. Cycles don't auto-close — manager explicitly publishes, edits live, or archives.                                 |
| **Shift slot**            | A single day + shift type (day or night). Each slot has a coverage target of 3–5 therapists, with 4 as the goal.                                                                                  |
| **Designated lead**       | Exactly one therapist per slot holds `role='lead'`. They must be `is_lead_eligible`. All others assigned to the slot are `role='staff'`.                                                          |
| **Work pattern**          | Each therapist's recurring constraint: which days of the week they work/avoid, weekend rotation rules, and whether their work-day preferences are hard constraints or soft preferences.           |
| **Availability override** | A cycle-scoped adjustment: `force_off` (blocked), `force_on` (prioritized), or neutral (no override row = default availability). Overrides do not carry forward between cycles.                   |
| **PRN staff**             | Per-diem staff who are only eligible for auto-draft when they have an explicit `force_on` override. Their recurring work pattern alone is not enough for auto-draft inclusion.                    |
| **Preliminary snapshot**  | A preview of the draft schedule sent to staff before final publish. Staff can claim open slots or submit change requests. Manager reviews these before publishing.                                |
| **Assignment status**     | Real-time operational state for a shift (scheduled / on_call / call_in / cancelled / left_early). Informational only — does not affect coverage counts or block publish.                          |
| **Publish**               | The act of marking a cycle as official, triggering email delivery to all scheduled therapists. Cycles remain editable after publish; operational status changes are sent as in-app notifications. |

---

## What the App Is NOT

- **Not a general-purpose scheduler.** Every design decision is scoped to respiratory therapy shift scheduling in a hospital department. The 6-week cycle length, day/night split, coverage targets (3–5), PRN rules, and lead-eligibility model are domain-specific and hardcoded to that context.
- **Not a time-tracking or payroll tool.** Assignment status is informational for operational awareness, not a time record.
- **Not real-time.** The schedule is built in advance. Live swap activity is the only near-real-time workflow, and it's async (post → claim → approve).
- **Not multi-department.** `profiles.site_id` is an unused schema placeholder referring to HCA Tomball. The app is single-organization. Do not build multi-tenant features around it.

---

## Why Each Major Feature Exists

### Inbound email + OCR intake (`/api/inbound/availability-email`)

Therapists in clinical settings often use paper forms or email to submit PTO and availability. This feature meets them where they are — processing emailed availability forms (including handwritten PDFs and scanned forms via OpenAI OCR) without requiring every therapist to adopt the web app for submission.

### Pre-flight report (before auto-draft)

Auto-draft can't satisfy all constraints simultaneously. Instead of silently dropping constraints or failing, the pre-flight runs the same algorithm as the real draft and shows the manager likely gaps _before_ committing. This preserves manager trust in the tool.

### Preliminary schedule + approval queue

In practice, managers can't fill every slot during planning — some slots stay open, and staff often know their own scheduling conflicts better than a manager does. The preliminary workflow creates a structured window for staff to self-organize (claim open slots, flag problems) before the final schedule is locked. This reduces back-channel text messages and last-minute changes.

### Cycle templates

Repeating the same staffing pattern is common (especially for steady-state rosters). Templates let a manager save a published cycle's shift structure and apply it as a starting point for a new draft, without copying availability overrides (which are cycle-specific).

### Shift lottery (`/lottery`)

Some open slots aren't filled during preliminary because multiple therapists want the same slot. Rather than the manager arbitrating, the lottery provides a fair, visible mechanism for randomly assigning contested open slots. This workflow is live and used in practice.

### Staff onboarding gate (`/onboarding`)

New staff often arrive with missing profile data — work pattern, shift preferences, notification settings. The onboarding gate ensures the manager has something useful to work with before the therapist appears in the scheduling workspace.

---

## Design Philosophy

**Manager-first, therapist-aware.** The scheduling complexity lives with the manager. The therapist experience is intentionally simple — submit availability, view schedule, request swaps. Therapists should not be burdened with understanding coverage logic.

**Constraint failure is visible, not silent.** When the auto-draft can't satisfy a constraint (forced must-work missed, no eligible candidates for a slot), that failure is surfaced explicitly in the pre-flight and in the coverage UI (unfilled slot warnings, amber lead-required banners). The manager always knows what the system couldn't resolve.

**The schedule lives in `/coverage`.** Even after publish, the schedule remains editable there. There is no "locked" state. Post-publish changes are allowed because real clinical operations require flexibility.

**Avoid operational data polluting planning data.** `shifts` stores planning intent. Real-time operational status (`call_in`, `cancelled`, etc.) is a separate concern stored in dedicated fields, not mutations to the shift itself. This keeps coverage metrics meaningful — you can always see what was _planned_ vs. what _happened_.

---

## Scheduling Rules Context

The scheduling constraints in this app reflect **internal department practice**, not regulatory or union requirements. The rules (weekend rotation parity, max work days, hard/soft DOW preferences) were designed by the department manager and can be adjusted if operational needs change. No external compliance requirement locks any of them in place.

The 6-week cycle length is fixed — that is how this department actually schedules. It is not a configurable setting and should not be generalized.
