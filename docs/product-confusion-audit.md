# Product Confusion Audit

Date: 2026-05-16

Objective: find and fix places where RT Scheduler could confuse a real respiratory therapy user, lead, or manager. This pass used `CONTEXT.md` as the product vocabulary source and intentionally avoided schema, RLS, architecture, and business-rule changes.

## Pages and Routes Reviewed

| Page                | Route                                                                                  | Primary audience                   | Audit notes                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Manager Dashboard   | `/dashboard/manager`                                                                   | Managers                           | Triage page for current Schedule Block attention, today staffing, review queues, and next deadline.             |
| Team Schedule       | `/schedule`                                                                            | Managers, leads, staff             | Unified grid for Schedule Block visibility. Managers can edit when permitted; staff read live schedule context. |
| My Shifts           | `/staff/my-schedule`, `/therapist/schedule`, `/staff/schedule` redirect to `/schedule` | Staff                              | Redirects into the unified Schedule view. Staff permission remains read-only in the grid.                       |
| Availability        | `/therapist/availability`                                                              | Staff                              | Schedule Block exception entry for Need Off and Need to Work.                                                   |
| Availability Review | `/availability`, `/availability/intake`                                                | Managers                           | Manager review and entry workspace for missing responses, exceptions, intake, and lock/reopen utilities.        |
| Shift Board         | `/shift-board`, `/requests/new`, `/staff/requests`                                     | Staff, leads, managers             | Shared swaps, pickups, direct requests, and manager review surface.                                             |
| Requests            | `/requests`, `/requests/user-access`                                                   | Managers                           | Entry point for Shift Board workflow and user access requests.                                                  |
| Approvals           | `/approvals`                                                                           | Managers                           | Preliminary schedule claims and change requests before final publish.                                           |
| Publish             | `/publish`, `/publish/[id]`                                                            | Managers                           | Schedule Block lifecycle/history and publish email log.                                                         |
| Lottery             | `/lottery`                                                                             | Managers, leads, staff with access | Shift-specific reduction decision workflow that applies results back to Team Schedule and My Shifts.            |
| Staff History       | `/staff/history`                                                                       | Staff                              | Personal Shift Board history for posts, direct requests, claims, and pickup interest.                           |
| Team/Roster         | `/team`                                                                                | Managers                           | Team profile, role, active/inactive, roster, and work pattern management.                                       |
| Audit Log           | `/settings/audit-log`                                                                  | Managers                           | Manager-visible history for scheduling and staffing actions.                                                    |

## Top Confusion Points Found

1. Several high-traffic surfaces still used "cycle" in user-facing copy, including manager dashboard context, therapist availability, publish history, availability review, and therapist dashboard workflow messages.
2. Shift controls sometimes showed "Day" and "Night" alone, which weakens the required Day shift and Night shift language.
3. Therapist availability blank states used "this cycle" and "cycle-only changes," which conflicted with the Schedule Block vocabulary and could make a non-technical therapist wonder whether the page was a different workflow.
4. Publish history mixed "Schedule blocks" section copy with "Cycle" table headers and actions, making lifecycle actions feel disconnected from the Schedule page.
5. Preliminary approvals labeled the context as "Preliminary cycle" even though the manager is deciding on a preliminary Schedule Block.
6. Availability review empty/context states used internal cycle wording in manager editor and therapist context panels.
7. Schedule edit error messages and published-readonly banners used internal cycle wording, so managers could see different terminology while fixing an assignment.

## Fixes Implemented

- Replaced user-facing "cycle" copy with "Schedule Block" across the audited high-confidence surfaces.
- Updated manager dashboard context and status copy from "Current cycle" and "Draft cycle" to Schedule Block language.
- Updated therapist availability copy to make the selected Schedule Block explicit, including blank states, submission detail, lock messages, side-panel summaries, copy-from-last-block action, and note persistence guidance.
- Updated Schedule grid toolbar shift tabs to show "Day shift" and "Night shift."
- Updated Lottery controls to show "Day shift" and "Night shift."
- Updated Publish history and publish detail labels from Cycle to Schedule Block where visible to managers.
- Updated Availability Review manager editor/context copy to say Schedule Block grid and Schedule Block empty states.
- Updated Availability request history search, expanded details, and empty-state copy to use Schedule Block language.
- Updated therapist settings copy so recurring pattern is clearly separate from Schedule Block-only Future Availability changes, and default shift options say Day shift and Night shift.
- Updated schedule duplicate/out-of-range/not-found errors and the published-readonly banner to use Schedule Block language.
- Updated Staff History shift chips to show Day shift and Night shift instead of raw `day` or `night`.
- Updated therapist workflow dashboard copy so staff see Schedule Block language in next-action messaging.
- Updated tests that assert the affected user-facing copy.

## Issues Deferred

- Analytics still uses "cycle" terminology in chart/table names. It was not in the requested primary route list, and a safe rename should consider metric naming and any exports/docs using those labels.
- Recurring pattern setup still uses "repeating cycle" language. That appears to describe a work-pattern algorithm rather than a Schedule Block, so it needs product confirmation before renaming.
- Database identifiers, query params, RPC names, event types, and internal test fixture IDs still use `cycle`. Those were intentionally left unchanged.
- Some labels come from stored Schedule Block names. If historical rows contain "Cycle" in their label, the UI will still display the stored label.
- Browser validation was not attempted yet in this pass; local seeded auth/env should be used before treating the audit as visual-complete.

## Product Questions Needing Human Decision

1. Should Analytics be renamed from "Cycle fill rates" to "Schedule Block fill rates," including chart headings and table columns?
2. Should "repeating cycle" in recurring work pattern setup be renamed, or is that a distinct scheduling-pattern concept users already understand?
3. Should `/schedule` show a stronger read-only banner for staff and lead viewers, or is the current permission-specific cell disabling enough?
4. Should publish history expose "Archived" and "Offline" definitions inline, or is the current action copy enough for managers?
5. Should stored labels containing "Cycle" be migrated or only corrected as new Schedule Blocks are created?

## Manual QA Recommendations

1. As a manager, open `/dashboard/manager`, `/schedule`, `/availability`, `/approvals`, `/publish`, `/lottery`, `/team`, and `/settings/audit-log`. Confirm every page quickly answers: current Schedule Block, shift context, what needs action, and whether actions are manager-only.
2. As a therapist, open `/schedule`, `/therapist/availability`, `/shift-board`, `/requests/new`, and `/staff/history`. Confirm read-only schedule visibility does not look editable and availability does not imply Available is a required explicit choice.
3. As a lead, open `/schedule`, `/shift-board`, and `/lottery`. Confirm Day shift/Night shift context is explicit and lead visibility does not imply full manager editing permission.
4. In Publish, inspect an empty history state, a live block, an offline block, and a draft block. Confirm managers understand archive, delete draft, take offline, republish, and publish email log as separate concepts.
5. In Availability Review, inspect missing responses, submitted with exceptions, submitted no exceptions, and email intake review. Confirm inactive or archived staff do not appear as current scheduling choices unless historical context requires them.
