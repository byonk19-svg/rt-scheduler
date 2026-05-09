# RT Scheduler

Scheduling operations for respiratory therapy teams, including availability, published schedules, coverage review, and post-publish request workflows.

## Language

**Schedule Block**:
A 6-week respiratory therapy scheduling period that always starts on Sunday.
_Avoid_: cycle, period, schedule cycle, roster cycle in user-facing UI

**Shift Visibility**:
Therapists default to their own shift; Team Schedule may show both Day shift and Night shift as read-only visibility, while My Shifts stays personally scoped. Leads and managers may toggle Day/Night wherever their role has schedule access.
_Avoid_: implying shift visibility grants edit permission

**Shift Default**:
Team Schedule uses a Day, Night, Both toggle order and opens on Day by default for broad schedule views. Leads default to their regular Day or Night shift in lead-scoped views. Therapists default to their own shift in personal views.
_Avoid_: defaulting broad schedule views to a dense Both view

**Availability Exception**:
A therapist's Schedule Block input for days that should differ from the normal scheduling baseline. The therapist-facing exception states are Need Off and Need to Work. Unmarked days do not need an Available label.
_Avoid_: making Available an explicit therapist choice

**Availability Baseline**:
The therapist's inherited normal scheduling context for a Schedule Block, including any recurring schedule pattern carried forward from the past. Baseline days may be displayed for context, but they are not therapist-entered exceptions.
_Avoid_: treating baseline days as Available requests
_Avoid_: editing recurring pattern inside the Schedule Block exception calendar

**Need Off**:
A therapist availability exception meaning the therapist needs not to be scheduled for their regular shift on that day.
_Avoid_: unavailable, can't work, blocked unless quoting implementation details
_Avoid_: treating Need Off as a soft preference

**PTO Reason**:
An optional reason attached to a **Need Off** exception when the therapist or intake source identifies the off request as paid time off. PTO is not a separate availability state.
_Avoid_: treating PTO as separate from Need Off

**Availability Submission**:
A therapist's confirmation that they reviewed a Schedule Block. A submission may contain Need Off or Need to Work exceptions, or no exceptions.
_Avoid_: assuming submitted availability always contains day-level entries

**Availability Edit Window**:
The period before availability closes or schedule building starts when a therapist may edit a submitted Availability Submission. After the window closes, changes become manager-managed or move to later workflows.
_Avoid_: silently changing availability after managers have started schedule planning

**Availability Locked**:
The state after a manager manually closes availability collection or starts creating a draft schedule for the Schedule Block. Therapists can no longer silently edit submitted availability.
_Avoid_: exposing backend draft or cycle terminology to explain the lock

**Reopen Availability**:
An intentional manager action that reopens a locked Availability Edit Window without deleting existing draft schedule or manager planning data.
_Avoid_: reopening availability silently or clearing draft planning as a side effect

**Manager Availability Plan**:
Manager-entered scheduling intent for a therapist within a Schedule Block. It is a separate layer from therapist-submitted availability exceptions and should not erase who submitted what.
_Avoid_: overwriting therapist submission language with manager planning language
_Avoid_: using creator, source, or intake provenance as a substitute for why the planning entry exists

**Manager Availability Queue**:
The manager review order for availability submissions: missing submissions first, submitted with exceptions second, submitted with no exceptions third.
_Avoid_: burying missing submissions below detailed submitted entries

**Availability Readiness Summary**:
A manager-facing summary of whether availability collection is ready for schedule building, including submitted count, missing count, exception count, lock state, and warnings.
_Avoid_: blocking schedule building without explaining what is missing

**Applied Intake Item**:
An email or manual intake item whose parsed availability requests have actually been written into Availability Exceptions or a Manager Availability Plan. Parser confidence alone is not applied state.
_Avoid_: labeling an intake item as applied before the availability write succeeds

**My Shifts**:
The therapist-facing view of the full Schedule Block, with the therapist's scheduled days highlighted and non-working days still visible for orientation.
_Avoid_: reducing My Shifts to only a list of worked days

**Team Schedule**:
The canonical live published schedule for all roles, showing who is working across a Schedule Block and current operational statuses such as Scheduled, On Call, Cancelled, Call In, and Left Early.
_Avoid_: splitting Team Schedule and Live Schedule into separate primary workflow concepts

**Operational Status Change**:
A live post-publish status update on a scheduled shift, such as On Call, Cancelled, Call In, or Left Early. Managers and leads may toggle these changes from Team Schedule when permitted; staff see the resulting status.
_Avoid_: treating operational status changes as draft schedule edits
_Avoid_: Sick as a top-level operational status; use Call In instead
_Avoid_: using legacy `shifts.status` or `shifts.assignment_status` fields as the source of truth for live operational state

**Left Early**:
An operational status meaning a scheduled therapist left before the scheduled shift ended. It is informational for the day and does not affect the staffing ratio for that day.
_Avoid_: treating Left Early as coverage loss

**On Call**:
An operational status meaning the therapist remains connected to the shift as backup but is not active bedside coverage. It should not automatically create a coverage gap when the manager intentionally moved them on call due to staffing needs.
_Avoid_: counting On Call as actively working coverage

**Cancelled**:
An operational status meaning a manager cancelled the scheduled shift because the staff member was not needed, usually because of overstaffing. Cancelled does not create a coverage gap.
_Avoid_: using Cancelled for call-ins or unresolved staffing gaps

**Call In**:
An operational status meaning a scheduled therapist cannot work the shift. Call In is the only operational status that automatically creates possible coverage impact and should route managers or leads to resolution when staffing falls below target.
_Avoid_: using Call In for overstaffing cancellations

**Lottery Decision**:
A staff reduction decision that can apply **Cancelled** or **On Call** operational statuses to Team Schedule and My Shifts while preserving decision history and reason.
_Avoid_: treating Lottery output as separate from the live schedule

**Lottery Visibility**:
Role-based access to Lottery information. Managers and leads can view and apply decisions across shifts, and therapists can view their shift's lottery order and their own position without apply controls.
_Avoid_: hiding lottery order from therapists when transparency is expected
_Avoid_: judgmental labels such as at risk or penalty

**Pickup Resolution**:
The approved result of a pickup workflow that adds or assigns a therapist to the live Team Schedule while preserving the original operational status, such as Call In, on the original assignment.
_Avoid_: treating Shift Board approval as separate from Team Schedule truth

**Open Shifts Responder Queue**:
The ordered list of therapists who respond to an Open Shifts post. The first responder is primary, later responders are backups, and the manager selects or approves the final resolution.
_Avoid_: hiding responder order from therapists or managers

**Approved Swap**:
A manager-approved swap whose final assignments are reflected on Team Schedule and My Shifts while Shift Board preserves the request lifecycle and history.
_Avoid_: showing approved swaps only as request history without updating the live schedule

**Shift Board**:
The shared workflow for therapists, leads, and managers to handle swaps, pickups, and direct shift requests after a schedule exists.
_Avoid_: using Requests, Pickups, or Shift Swaps as separate primary navigation concepts
_Avoid_: treating route/API action names as the lifecycle model; Shift Board state transitions should be explicit domain commands

**Shift Board Section**:
A shared section name used across roles: Needs Action, Open Shifts, My Requests, and History. Section contents and available actions vary by role and permission.
_Avoid_: giving each role a different board structure for the same workflow

**New Shift Board Request**:
The therapist entry point for creating a new trade or give-up request. Picking up a shift is not created here; therapists pick up shifts by opening an existing Open Shifts item and responding to it.
_Avoid_: "Pick up a shift" as a new-request option

**Give Up Shift Request**:
A therapist request to give up a scheduled shift by either asking a specific teammate or posting it to Open Shifts. Manager approval still finalizes the schedule change.
_Avoid_: forcing every give-up request through a specific teammate first

**Calendar-started Shift Request**:
A shift board request started from a selected scheduled day in My Shifts, prefilled with the selected shift. Therapists should not have to leave the calendar and re-select the same shift to start a give-up or trade request.
_Avoid_: forcing request creation to start only from Shift Board

**Schedule Impact Preview**:
A visual before/after preview of how a swap, give-up, or pickup would affect the involved days, shifts, people, coverage counts, and downstream schedule truth. Therapists see it before sending a request; managers see it before approval.
_Avoid_: hiding coverage impact until after request submission or approval

**Post-publish Change Marker**:
A subtle Team Schedule or My Shifts indicator that a visible assignment or status changed after the original publish. The current schedule truth remains primary, with change details available in selected-day detail.
_Avoid_: cluttering schedule cells with full history

**Restrained Status Design**:
Operational statuses should be easy to understand without overwhelming users with many competing colors. Use text labels, grouping, icons, and subtle tone differences before adding strong color.
_Avoid_: relying on a different saturated color for every status

**Status Abbreviation**:
A compact manager/table-only label such as OC, CX, CI, or LE. Normal UI should use full labels like On Call, Cancelled, Call In, and Left Early.
_Avoid_: abbreviations in therapist-facing UI or selected-day detail without a legend

**Mobile Priority**:
Mobile design prioritizes therapist quick use first, lead day-of operations second, and manager triage third. Dense manager schedule building can remain desktop-first.
_Avoid_: compressing every manager workbench into the primary mobile experience

**Workflow History**:
History shown inside the workflow it belongs to, such as Shift Board History, Lottery History, Team Schedule post-publish details, or My Shifts past blocks.
_Avoid_: History as a vague standalone primary navigation item

**Primary Workflow Navigation**:
The small role-based set of main workflows. Therapists use Dashboard, My Shifts, Team Schedule, Availability, and Shift Board. Leads use Dashboard, Team Schedule, Shift Board, Lottery, and limited Availability visibility if needed. Managers use Dashboard, Coverage, Team Schedule, Availability, Shift Board, and Lottery.
_Avoid_: promoting Roster, Publish, History, Print, Export, or Requests into separate primary workflow concepts

**Attention Surface**:
The combination of Dashboard summary, inline workflow context, and notification history used to show user-relevant changes without duplicating noise.
_Avoid_: relying only on global notifications or repeating the same alert everywhere

**Role-specific Dashboard**:
A dashboard whose information hierarchy matches the user's role: therapist personal next action, lead day-of regular-shift operations, or manager both-shift operational triage.
_Avoid_: one generic dashboard trying to serve all roles equally

**Lead Dashboard**:
The lead-facing dashboard for today or next-shift operations on the lead's regular shift, including Team Schedule status, Call In impact, operational status attention, Lottery decision context, and Shift Board visibility without manager final approval.
_Avoid_: turning lead dashboard into manager schedule planning

**Lead Experience Activation**:
Lead-facing tools appear based on permanent lead permission, even when the lead is not assigned as lead that day.
_Avoid_: hiding lead tools just because the lead is not lead on the selected day

**Lead Tools Indicator**:
A small UI indicator showing that a user has permanent lead tools for their regular shift. It is separate from selected-day assignment language such as Assigned lead today.
_Avoid_: implying permanent lead tools depend on being lead that day

**Coverage**:
The manager staffing workbench for building, reviewing, fixing, and maintaining coverage across a Schedule Block.
_Avoid_: presenting Coverage as the general staff schedule

**Coverage Availability Signal**:
A compact manager-facing signal in Coverage showing relevant availability context for a therapist, such as Need Off, Need to Work, No submission, or No exceptions.
_Avoid_: embedding the full availability calendar in every assignment picker

**Before Publish Checklist**:
A manager-facing Coverage checklist of issues that must be reviewed before publishing, including Need Off overrides without reason, Need to Work not honored without reason, missing lead coverage, staffing below target, and missing availability submissions needing acknowledgement.
_Avoid_: burying publish blockers across unrelated page sections

**Publish Blocker**:
A Before Publish Checklist issue that prevents publishing until resolved, such as a Need Off override without reason, Need to Work not honored without reason, missing required lead coverage, or critical staffing below target without acknowledgement.
_Avoid_: allowing high-trust or critical staffing issues to publish silently

**Publish Warning**:
A Before Publish Checklist issue that can be acknowledged and published with manager judgement, such as acknowledged missing availability submissions, non-critical staffing concerns, or workload warnings.
_Avoid_: blocking all warnings as if they were critical errors

**Schedule Blocks Utility**:
A manager utility inside Coverage for viewing current and past Schedule Blocks, publish status, publish history, take-offline actions, safe delete where allowed, and start-over actions.
_Avoid_: treating Publish as a separate primary workflow

**Schedule Block State**:
The resolved lifecycle state of a Schedule Block, such as draft, preliminary active, published live, offline, or archived. The state should be derived in one place before it is relied on across Coverage, Team Schedule, Availability, Publish History, and therapist dashboards.
_Avoid_: scattering raw `published`, preliminary snapshot, shift-count, and archive checks across workflow code

**Take Schedule Block Offline**:
A reversible manager action that removes a published Schedule Block from staff live schedule visibility while preserving history and dependencies.
_Avoid_: hard-deleting published schedule history
_Avoid_: requiring staff notification by default

**Schedule Block Delete**:
A destructive manager action that should be allowed only for drafts or unpublished blocks with no live dependencies.
_Avoid_: deleting published blocks from normal UI

**Start Schedule Block Over**:
A manager action for resetting draft or unpublished planning state after impact review. Published blocks require a safer lifecycle such as taking offline or creating a new revision.
_Avoid_: silently clearing published schedule history

**Roster View**:
A table, print, or export-oriented view mode of the Team Schedule.
_Avoid_: treating Roster as a separate primary scheduling workflow

**Need to Work**:
A hard therapist availability exception meaning the therapist needs to work that day, not a soft volunteer preference.
_Avoid_: Request to Work, volunteer, prefer to work, can work
_Avoid_: treating Need to Work as only a recommendation boost

**Availability Shift Scope**:
Therapist-entered availability exceptions default to the therapist's regular shift. Cross-shift availability is manager-managed or advanced, not the default therapist flow.
_Avoid_: making Need Off or Need to Work ambiguous across Day and Night

**Direct Swap Request**:
A swap request sent to one specific teammate before manager approval.
_Avoid_: private swap, specific-person swap, direct teammate ask

**Direct Request Response**:
The specific teammate's accept or decline response to a Direct Swap Request or direct give-up request. Acceptance moves the request to manager approval; it does not change Team Schedule by itself.
_Avoid_: treating teammate acceptance as final schedule approval

**Request Waiting State**:
A therapist-visible lifecycle label that states who the request is waiting on, such as Waiting on teammate, Waiting on manager, Approved, Declined, Denied by manager, or Withdrawn.
_Avoid_: using Accepted alone when manager approval is still required

**On-behalf Shift Board Post**:
A Shift Board post created by a manager, or by a lead if permitted, for a therapist after an operational or verbal request. It must show who created it and who it is for.
_Avoid_: making manager-entered requests look therapist-submitted

**Manager Final Approval**:
The required manager approval step before a Shift Board request can change Team Schedule or My Shifts. Leads may have visibility or operational support permissions, but final swap, give-up, or pickup approval is manager-only.
_Avoid_: letting lead actions finalize schedule-changing Shift Board requests

**Lead Operational Status Permission**:
Permission for leads to toggle live operational statuses on Team Schedule across shifts when allowed. It does not include final approval of Shift Board schedule changes.
_Avoid_: treating lead status updates as manager final approval

**Open Swap Request**:
A swap request posted for manager review without committing to one teammate up front.
_Avoid_: generic swap, board swap, open ask

**Suggested Swap Partner**:
The teammate named on a swap request before final manager approval.
_Avoid_: claimant, assignee, automatic partner

**Coverage-safe swap**:
A swap whose final approved exchange keeps both affected shifts acceptably covered after each therapist moves.
_Avoid_: valid swap, fixed swap, good swap

**Manager-review warning**:
A clear pre-submit warning that a proposed swap can still be sent but is not currently coverage-safe.
_Avoid_: soft error, maybe okay, caution only

**Swap consequence**:
The specific downstream staffing problem a proposed swap would create on the other affected shift.
_Avoid_: hidden detail, side effect, technical note

**Operational consequence**:
The manager-facing statement of exactly which shift is affected and what coverage rule the swap would break.
_Avoid_: soft warning, generic issue, vague blocker

**Manager-assigned partner**:
The teammate a manager selects while resolving an open swap request.
_Avoid_: converted direct request, forced recipient, hidden assignee

**Swap wizard**:
A dedicated full-page guided flow for creating or responding to swap requests.
_Avoid_: embedded form, generic request page, mini composer

## Relationships

- A **Direct Swap Request** names exactly one **Suggested Swap Partner**
- An **Open Swap Request** may name zero or one **Suggested Swap Partner**
- A manager approval finalizes the **Suggested Swap Partner** on either swap path
- A **Direct Request Response** gates manager review but does not update Team Schedule until manager approval
- **Request Waiting State** labels should make it clear when a teammate accepted but the request is still waiting on manager approval
- **On-behalf Shift Board Post** entries must show manager/lead attribution and the therapist the post is for
- **Manager Final Approval** is required before Shift Board swaps, give-up requests, or pickups change Team Schedule or My Shifts
- **Lead Operational Status Permission** may allow lead status toggles across Day and Night shifts, but Shift Board final approval remains manager-only
- A manager can set a **Manager-assigned partner** while resolving an **Open Swap Request**
- A **Suggested Swap Partner** can be evaluated as a **Coverage-safe swap** or not before manager approval
- A proposed swap that is not **Coverage-safe** should surface a **Manager-review warning** instead of being blocked outright
- A therapist-facing verdict should summarize the outcome first and explain the **Swap consequence** second
- A therapist should complete swap actions inside a **Swap wizard**, not an embedded generic request form
- A manager-facing review should present the **Operational consequence** directly, including the affected shift
- **Shift Visibility** is independent from edit permission; a therapist may view both shifts on Team Schedule without gaining manager edit tools
- **Shift Default** for Team Schedule is Day first, then Night, then Both; lead-scoped views use the lead's regular shift and therapist personal views use the therapist's own shift
- Team Schedule's Both view is summary/read-only for operational status changes; managers and leads must select Day or Night before toggling live statuses
- Dashboard defaults differ from Team Schedule: manager dashboards summarize both shifts, lead dashboards default to the lead's regular shift with optional cross-shift summary, and therapist dashboards stay personal
- Therapist availability is exception-based: unmarked days stay at the **Availability Baseline**, while **Need Off** and **Need to Work** are explicit exceptions
- The recurring pattern should appear as a compact **Availability Baseline** summary with a separate edit flow, not as part of the main exception calendar
- Recurring pattern edits apply to future Schedule Blocks by default; applying them to the current open Schedule Block baseline requires explicit choice
- Therapist-entered availability exceptions use **Availability Shift Scope**: default to the therapist's regular shift unless a manager-managed or advanced cross-shift flow explicitly says otherwise
- Therapist availability entry should show the regular shift once at the top; manager availability views should show shift on each therapist row or card because managers scan mixed staff
- **PTO Reason** may explain a **Need Off** exception, but PTO does not create a separate scheduling state
- **Need Off** and **Need to Work** both override the **Availability Baseline** for the selected Schedule Block
- **Need Off** is a hard scheduling no; manager override requires a visible reason and must not make it look like the therapist agreed
- Publish/preflight should require a manager reason for any **Need Off** override before the Schedule Block can be published
- A therapist should be notified when a manager overrides **Need Off** and schedules them anyway; My Shifts should show the conflict and manager reason when present
- **Need to Work** is a hard scheduling intent; if another scheduling rule prevents it, Coverage must show a manager conflict warning instead of silently ignoring it
- Publish/preflight should require a manager reason when **Need to Work** is not honored before the Schedule Block can be published
- If **Need to Work** cannot be honored, avoid noisy draft-time notifications; at publish, My Shifts and notification should make the unhonored request clear with manager note when present
- An **Availability Submission** can be valid with no exceptions; it records that the therapist reviewed the Schedule Block
- Therapists may edit an **Availability Submission** only during the **Availability Edit Window**; after schedule building starts or the window closes, changes are manager-managed or handled through later workflows
- Late Need Off or Need to Work changes after **Availability Locked** are manager-managed; therapists should not silently edit locked availability
- **Availability Locked** begins when a manager closes availability collection or starts a draft schedule; UI should use plain labels such as Availability open, Availability submitted, Availability locked, and Schedule building started
- **Reopen Availability** requires confirmation and impact messaging when draft schedule work has already started
- A **Manager Availability Plan** is separate from therapist-submitted exceptions; conflicts should be visible instead of making it look like the therapist changed their submission
- **Manager Availability Queue** should prioritize missing submissions, then submissions with Need Off or Need to Work exceptions, then no-exception submissions
- **Availability Readiness Summary** should warn when submissions are missing or exceptions need review, but should not hard-block manager schedule building unless a separate rule requires it
- Managers may proceed to Coverage when availability is not ready, but starting schedule building should warn about missing submissions and confirm that availability will lock
- **My Shifts** shows the full Schedule Block with personal scheduled days highlighted; selected-day coworker detail defaults to the therapist's own shift, while both-shift context belongs in Team Schedule
- **My Shifts** keeps Scheduled, On Call, Cancelled, Call In, and Left Early visible instead of hiding changed shifts
- **Team Schedule** is the canonical live published schedule; **Roster View** is only a display mode for table, print, or export needs
- **Operational Status Change** controls belong on Team Schedule for managers and leads when permitted, while staff see those statuses read-only
- The same **Operational Status Change** control may appear in Coverage, but Team Schedule and Coverage must share one persistence, permission, notification, and lifecycle model
- Client-side Coverage permissions are display hints only; server actions and API routes are the authority and must return clear denied-state feedback when access changes
- When an **Operational Status Change** creates a coverage issue, the live status should still be saved; the app should surface the coverage impact and route managers to Coverage or Shift Board rather than auto-filling another therapist
- **Cancelled** means the staff member was not needed and should not create a coverage gap
- **Left Early** should show on Team Schedule but should not affect the staffing ratio for that day
- **On Call** remains visible on Team Schedule but should be grouped separately from actively working staff, should not count as active bedside coverage, and should not automatically create a coverage gap when intentionally assigned
- **Call In** is the only operational status that automatically creates possible coverage impact and should route managers or leads to Coverage or Shift Board when staffing falls below target
- Lottery is driven by Team Schedule: live schedule changes update the Lottery view, and a **Lottery Decision** applies **Cancelled** or **On Call** back to Team Schedule and My Shifts
- A **Lottery Decision** is shift-specific: managers apply it to Day or Night, not Both
- **Lottery Visibility** lets managers and leads apply decisions across shifts, and lets therapists view their shift order and own position without apply controls
- Therapists may see the full lottery order for their shift using neutral language, with manager-only rationale and apply controls hidden
- Lottery remains a primary workflow for managers and leads, with contextual links from Team Schedule selected-day detail; lead-applied decisions require attribution/history, and therapists see lottery position/order context without needing a primary Lottery nav item
- A **Pickup Resolution** updates Team Schedule as the live truth after approval; Shift Board owns request lifecycle, Team Schedule owns the resulting schedule view
- An **Approved Swap** updates Team Schedule and both therapists' My Shifts views, while Shift Board keeps lifecycle history
- A **Post-publish Change Marker** should show when swaps, pickups, Lottery decisions, or operational status changes altered the original published schedule
- **Restrained Status Design** should make status clear without overwhelming the schedule with many competing colors
- **Status Abbreviation** is only acceptable in dense manager table views with a visible legend or tooltip; normal UI should use full labels
- **Mobile Priority** should keep mobile focused on therapist schedule/availability/Shift Board use, lead day-of Team Schedule and Lottery work, and manager triage rather than dense schedule building
- **Workflow History** belongs inside each workflow rather than as a standalone primary navigation concept
- **Primary Workflow Navigation** should stay small; supporting views such as Schedule Blocks, Roster View, History, Print, Export, Profile, and Settings stay nested or secondary
- **Attention Surface** should use Dashboard for top action summaries, inline page context for relevant workflow state, and notification bell/history for full notification record
- Dashboards should be **Role-specific Dashboard** surfaces that can share components but not the same information hierarchy
- Therapists should land on their dashboard for next shift, availability state, Shift Board actions, and recent schedule changes, with My Shifts one click away
- **Lead Dashboard** focuses on day-of regular-shift operations, not schedule planning
- Leads should land on **Lead Dashboard**, with Team Schedule one click away for live schedule work
- Managers should land on manager dashboard for triage, with Coverage one click away for build/edit work
- **Lead Experience Activation** depends on permanent lead permission, not day-specific lead assignment
- **Lead Tools Indicator** should distinguish permanent lead tools from being assigned lead on a selected day
- Primary navigation should stay conceptually small: My Shifts for personal schedule, Team Schedule for shared live truth, Coverage for manager staffing work, Availability before the schedule is built, **Shift Board** for post-publish swaps, pickups, and direct shift requests, and Lottery for staff reduction decisions
- **Coverage** is manager-first; leads should mainly use Team Schedule, with scoped coverage visibility for their regular shift where needed
- Leads operate live schedule workflows through Team Schedule, Lottery, and Shift Board visibility; full Coverage build/publish remains manager-first
- **Coverage Availability Signal** should help managers understand candidate fit without overloading assignment views
- **Before Publish Checklist** should group publish blockers and warnings with links to affected day/therapist details
- **Publish Blocker** items prevent publishing until resolved, while **Publish Warning** items can be acknowledged and published with manager judgement
- Missing availability submissions are **Publish Warning** items that require manager acknowledgement but do not hard-block publish
- Critical staffing below target is a **Publish Blocker** until a manager acknowledgement and reason is recorded; after acknowledgement it can publish as a warning
- Missing required lead coverage is a **Publish Blocker** until resolved or acknowledged with manager reason; after acknowledgement it remains visible as a warning
- Published operational warnings are manager/lead visible by default; staff see only warnings that directly affect them personally, such as their own Need Off override, Need to Work not honored, or operational status
- Publish belongs inside **Coverage**; **Schedule Blocks Utility** handles published block history, take-offline, safe delete, and start-over actions
- Publishing a **Schedule Block** supersedes any active preliminary snapshot for that same block; staff must not see a block as both preliminary-active and published-live
- Published Schedule Blocks should be taken offline rather than hard-deleted; delete is limited to safe drafts/unpublished blocks, and start-over requires impact review
- Taking a Schedule Block offline does not require staff notification by default, but manager UI should preserve who took it offline and when
- Offline Schedule Blocks are hidden from active staff My Shifts and Team Schedule, and from normal staff history by default; managers retain access in Schedule Blocks utility
- An offline Schedule Block may be republished only if no replacement block is already published for the same date range, and republish requires impact confirmation
- Coverage owns Schedule Block lifecycle utilities; Availability uses a simple Schedule Block selector for submission collection and review without destructive lifecycle actions
- **Shift Board** is the shared workflow name for all roles; specific terms such as Direct Swap Request, Open Swap Request, and Pickup Request belong inside the workflow, not in primary navigation
- **Shift Board Section** names stay consistent across roles, while actions and contents are permission-specific
- Shift Board defaults to **Needs Action** for all roles; if empty, show a clear empty state and counts that point to Open Shifts, My Requests, and History
- **Open Shifts** contains pickup opportunities and open swap requests together, with clear item type labels and optional filters rather than separate primary sections
- **New Shift Board Request** creates trade or give-up requests only; pickup responses start from existing Open Shifts posts
- A **Give Up Shift Request** can target a specific teammate or be posted to Open Shifts; manager approval remains required before Team Schedule changes
- Posting a **Give Up Shift Request** to Open Shifts does not remove the original therapist from Team Schedule; the original therapist remains scheduled until manager approval finalizes a replacement or other resolution
- **Open Shifts Responder Queue** should show primary and backup responders, including "you are first in line" or backup position for the current therapist when applicable
- A **Calendar-started Shift Request** should prefill the selected My Shifts assignment and offer Give up this shift or Trade this shift from selected-day detail
- A **Schedule Impact Preview** should show the overall schedule effect before a therapist sends a request and before a manager approves swaps, give-up requests, or pickup resolutions
- A therapist request with a coverage concern should show a **Manager-review warning** in the **Schedule Impact Preview** but remain sendable unless it is structurally invalid

## Example dialogue

> **Dev:** "When a therapist says they want to swap, is that always a board post?"
> **Domain expert:** "No. The default is a **Direct Swap Request** to one teammate. An **Open Swap Request** is the fallback when they do not have a specific person yet."

> **Dev:** "If a teammate can take my shift, is that enough to show the swap is okay?"
> **Domain expert:** "No. We should show whether the full exchange is a **Coverage-safe swap**, meaning both shifts still work after the swap."

> **Dev:** "If the swap is not coverage-safe yet, do we block the therapist?"
> **Domain expert:** "No. We still allow the request, but the UI must show a **Manager-review warning** before they send it."

> **Dev:** "Do we show the full staffing reason, or just a simple status?"
> **Domain expert:** "Show the verdict first, then the **Swap consequence** underneath so the therapist can see exactly what would break."

> **Dev:** "Should the manager see the same swap labels as the therapist?"
> **Domain expert:** "No. Managers should see the **Operational consequence** in precise scheduling language, including which shift is affected."

> **Dev:** "If an open swap finds a real partner during review, do we make a new workflow?"
> **Domain expert:** "No. The manager can set a **Manager-assigned partner** and resolve the same open swap request."

> **Dev:** "Should swap creation stay inside the general requests page?"
> **Domain expert:** "No. This should be a dedicated **Swap wizard** so the guidance, verdicts, and confirmation steps stay easy to follow."

## Flagged ambiguities

- "swap request" was being used to mean both **Direct Swap Request** and **Open Swap Request** - resolved: the default therapist path is **Direct Swap Request**, and **Open Swap Request** is a separate secondary path
- "fix the problem" was ambiguous - resolved: show whether the proposal is a **Coverage-safe swap**, not just whether one side of the exchange gets filled
- "warning" versus "block" was ambiguous - resolved: non-coverage-safe swaps remain sendable, but must show a **Manager-review warning**
- "why is this unsafe?" was ambiguous - resolved: show the verdict first and the **Swap consequence** as secondary supporting detail
- manager wording versus therapist wording was ambiguous - resolved: therapist UI uses simple verdicts, manager UI uses direct **Operational consequence** language
- manager assignment versus workflow conversion was ambiguous - resolved: an **Open Swap Request** can gain a **Manager-assigned partner** during review without becoming a separate workflow type
- swap composition surface was ambiguous - resolved: therapist swap creation should use a dedicated **Swap wizard**
