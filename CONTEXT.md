# RT Scheduler

Scheduling operations for respiratory therapy teams, including availability, published schedules, coverage review, and post-publish request workflows.

## Language

**Schedule Block**:
A non-overlapping 6-week respiratory therapy scheduling period for one site that always starts on Sunday. Schedule Blocks may have date gaps between them; they do not have to be perfectly back-to-back.
Normal operations use a consistent six-week cadence: the next Schedule Block usually starts the Sunday after the previous block ends.
Multiple Schedule Blocks may exist in different lifecycle states for the same site as long as their date ranges do not overlap, including multiple future Draft blocks.
Schedule Block dates are editable only before dependent availability, assignment, preliminary, or publish history exists.
Future Schedule Blocks should have an availability due date before they are visible for therapist submissions, so therapists always know the deadline for that block.
Preliminary and Final Publish target dates are manager planning milestones; they should guide schedule work but should not block therapist availability submission.
Therapist availability visibility is derived from the future Schedule Block having an availability due date; there should not be a separate manager visibility toggle.
Multiple future non-overlapping Schedule Blocks may be therapist-visible at the same time when each has an availability due date.
The current product can behave as single-location, while schema constraints may remain site-scoped for future-proofing.
_Avoid_: cycle, period, schedule cycle, roster cycle in user-facing UI
_Avoid_: forcing contiguous Schedule Blocks when adoption starts midstream or historical ranges are skipped
_Avoid_: changing Schedule Block dates after planning data exists; use Start Schedule Block Over or create a new block instead
_Avoid_: showing future therapist availability submission without a due date unless the block is still an internal manager draft
_Avoid_: hiding therapist availability submission just because Preliminary or Final Publish target dates are missing
_Avoid_: adding a separate "make visible" switch for normal future availability submission
_Avoid_: limiting therapist availability submission to only one future Schedule Block when multiple planned blocks exist
_Avoid_: overbuilding multi-site UX before the department needs it

**Schedule Block Planning**:
The manager-facing planning utility for creating or selecting future Schedule Blocks, setting the availability due date, and setting manager target dates for Send Preliminary and Final Publish.
When no future Schedule Block exists, Schedule Block Planning should suggest the next Sunday-start six-week block from the latest existing Schedule Block and prefill reasonable target dates for manager review.
The first Schedule Block Planning flow should focus on saving the next suggested block. A later bulk planning action may create several future non-overlapping Schedule Blocks at once with suggested planning dates for manager review.
Suggested Schedule Blocks are previews until the manager saves. Opening Schedule Block Planning should not automatically create draft Schedule Block rows.
Schedule Block labels should be generated from the date range by default. Custom labels may remain editable as a secondary option, but managers should not have to name standard blocks manually.
Default planning suggestions are availability due three weeks before the Schedule Block starts, Send Preliminary target two weeks before start, and Final Publish target one week before start.
Schedule Block Planning must not save overlapping Schedule Blocks. When a proposed block overlaps an existing one, the UI should explain the conflict and suggest the next valid Sunday-start block.
Schedule Block start and end dates may be edited only while the block has no dependent availability submissions, assignments, preliminary snapshots, or publish history. After dependent data exists, recovery uses a new block or a named lifecycle action rather than silent date edits.
Managers choose planning dates as calendar days, not times. Availability due, Send Preliminary target, and Final Publish target are all date-only in manager UI. The system may normalize date-only availability deadlines to an end-of-day timestamp internally, but the manager UI should not ask for a time.
Availability due dates should be before the Schedule Block start date. Late recovery after a block starts belongs in manager-managed late availability, not normal Schedule Block Planning.
Planning dates should follow this order: availability due on or before Send Preliminary target, Send Preliminary target on or before Final Publish target, and Final Publish target before the Schedule Block start date. Same-day planning targets may be allowed with a compressed-timeline warning.
Managers may edit planning dates after saving. Moving the availability due date later is ordinary; moving it earlier after therapists can see the block should require confirmation because it changes staff expectations.
After a Schedule Block becomes therapist-visible for availability, its availability due date may be replaced with another date but should not be cleared entirely. Removing therapist visibility should happen by deleting or archiving a safe empty draft block, not by erasing the deadline.
Preliminary and Final Publish target dates may be edited until the actual Send Preliminary or Final Publish action happens. Actual lifecycle actions record exact timestamps when they happen; after the actual action happens, the target date becomes historical planning context rather than the lifecycle authority.
Saving Schedule Block Planning should notify therapists only when the block becomes therapist-visible for availability for the first time, or when a visible availability due date changes materially. Editing manager-only Preliminary or Final Publish target dates should stay quiet.
Schedule Block Planning changes should be audit logged for manager traceability, including creating a therapist-visible Schedule Block, changing a visible availability due date, changing the Send Preliminary target date, and changing the Final Publish target date. Audit logging does not imply therapist notification.
Schedule Block Planning belongs under the Schedule workflow as a secondary Planning route such as `/schedule/planning`, and may be linked from the manager dashboard when the next Schedule Block is missing planning dates.
The route should prioritize future Schedule Blocks in two groups: needs planning and planned. Current or recent blocks may appear as read-only context, while old publish history and recovery actions stay in Publish History.
The manager dashboard should surface Schedule Block planning attention items, including missing next block, missing availability due date, availability due soon or past due, Preliminary target coming up, and Final Publish target coming up. Dashboard actions should link to the page where the manager can resolve the item, such as Schedule Block Planning, Availability, or Schedule.
The Schedule section's local Planning tab may show a small count for missing or overdue planning items, while primary urgency stays on the manager dashboard.
_Avoid_: making managers calculate standard six-week block dates manually
_Avoid_: making bulk multi-block creation the only way to plan the next Schedule Block
_Avoid_: creating empty draft Schedule Blocks just because a manager opened the planning page
_Avoid_: requiring managers to invent custom names for normal six-week Schedule Blocks
_Avoid_: treating suggested planning offsets as uneditable hard rules
_Avoid_: allowing overlapping Schedule Blocks, even temporarily
_Avoid_: changing Schedule Block date ranges after availability, assignment, preliminary, or publish dependencies exist
_Avoid_: asking managers to enter deadline times for normal Schedule Block Planning
_Avoid_: setting a normal availability due date after the Schedule Block has started
_Avoid_: saving planning target dates in an order that contradicts the Schedule Block lifecycle
_Avoid_: silently making a therapist-facing due date stricter after staff have already seen the Schedule Block
_Avoid_: clearing a due date from a Schedule Block after therapists could already submit against it
_Avoid_: treating planning target edits as the same thing as Send Preliminary or Final Publish
_Avoid_: notifying therapists for manager-only target date edits
_Avoid_: treating audit logging as staff notification
_Avoid_: adding Schedule Block Planning as a separate top-level primary navigation item
_Avoid_: turning Schedule Block Planning into a full historical Schedule Block archive
_Avoid_: surfacing dashboard planning reminders that dead-end somewhere the manager cannot act
_Avoid_: making primary navigation feel urgent for every routine planning reminder
_Avoid_: treating Schedule Block Planning as the place where preliminary or final publish actions actually happen
_Avoid_: exposing Schedule Block Planning as a therapist workflow

**Shift Visibility**:
Therapists default to their own shift; Team Schedule may let them switch between separate Day shift and Night shift read-only views, while My Shifts stays personally scoped. Leads and managers may toggle Day/Night wherever their role has schedule access.
_Avoid_: implying shift visibility grants edit permission

**Shift Default**:
Manager broad Team Schedule views may use Day, Night, Both toggle order and open on Day by default. Staff-facing Team Schedule uses separate Day/Night views. Leads default to their regular Day or Night shift in lead-scoped views, while therapists default to their own shift in personal views.
Therapists viewing Team Schedule should default to their own regular shift for readability, with a simple Day/Night switch available for the other separate shift view.
Leads should also default to their own regular shift, with cross-shift operational status access available through the explicit Day/Night shift switch.
Managers should return to their last selected Team Schedule shift view when available; Day is the first-time fallback.
Manager shift-view memory should be scoped per workflow, such as Team Schedule versus Coverage, so resuming one workflow does not unexpectedly change another.
_Avoid_: defaulting broad schedule views to a dense Both view
_Avoid_: dropping therapists into Both view when they primarily need their own shift context
_Avoid_: making ordinary staff use a dense combined Both view to inspect the other shift
_Avoid_: making lead day-of views behave like generic manager planning views
_Avoid_: forcing managers back to Day when they were actively working another shift view
_Avoid_: using one global manager shift preference across workflows with different jobs

**Regular Shift Change**:
A therapist profile change that affects future planning defaults, not historical assignments. Old schedules keep the actual Day or Night assignment that was saved at the time.
_Avoid_: reinterpreting old schedule rows when a therapist's current regular shift changes

**Employment Type Change**:
A therapist profile change such as FT to PRN that affects future scheduling rules. Old Schedule Blocks preserve the employment and scheduling context used when they were built or published.
_Avoid_: reinterpreting historical assignments when a therapist's current employment type changes

**Assignment Context Snapshot**:
The schedule-row context captured when an assignment is created, such as assigned shift, employment/scheduling context, and designated-lead role. Later profile changes do not rewrite this saved assignment context.
Assignment rows can reference the therapist profile for display name; they do not need to snapshot names unless future audit requirements demand old-name immutability.
_Avoid_: recalculating old assignments from the therapist's current profile state
_Avoid_: duplicating therapist display names into assignment rows without a clear audit requirement

**Auto-draft**:
The server-side schedule generation action for a Schedule Block. It creates draft assignments by applying availability, PRN mode, inactive therapist, daily uniqueness, lead priority, Need Off, Need to Work, and staffing rules consistently.
Auto-draft must not silently overwrite existing draft work; rerunning it requires confirmation or a Start Schedule Block Over-style reset.
Auto-draft is a Draft-stage generation action; after Send Preliminary, managers use grid edits and Preliminary review unless they Start Schedule Block Over.
_Avoid_: implementing auto-draft as client-side assignment generation
_Avoid_: bypassing the same hard rules that manager grid edits must obey
_Avoid_: wiping manager-edited draft assignments without explicit confirmation
_Avoid_: rerunning auto-draft over an active Preliminary Schedule without Start Schedule Block Over

**Availability Exception**:
A therapist's Schedule Block input for days that should differ from the normal scheduling baseline. The therapist-facing exception states are Need Off and Need to Work. Unmarked days do not need an Available label.
Need Off and Need to Work are mutually exclusive for the same therapist, date, and shift.
_Avoid_: making Available an explicit therapist choice
_Avoid_: adding a softer Can Work state unless the scheduling model intentionally expands beyond Need Off and Need to Work
_Avoid_: allowing a therapist to mark both Need Off and Need to Work for the same date/shift

**Availability Baseline**:
The therapist's inherited normal scheduling context for a Schedule Block, including any recurring schedule pattern carried forward from the past. Baseline days may be displayed for context, but they are not therapist-entered exceptions.
_Avoid_: treating baseline days as Available requests
_Avoid_: editing recurring pattern inside the Schedule Block exception calendar

**Standing PRN**:
A PRN therapist profile mode for PRN staff with an expected recurring work pattern, such as every weekend, whose baseline pattern can make them eligible for scheduling.
Standing PRN therapists may be included in auto-draft from their recurring baseline without requiring date-level Need to Work entries.
_Avoid_: requiring a date-level Need to Work entry for every normal standing PRN day
_Avoid_: choosing standing status separately for each Schedule Block
_Avoid_: site-scoping PRN scheduling mode before multi-site therapist behavior requires it

**Flexible PRN**:
A PRN therapist profile mode for PRN staff who are scheduled only from explicit date-level availability, including manager-entered availability supplied by the therapist, or manager force-on intent.
Flexible PRN therapists are excluded from auto-draft on dates where they have no explicit therapist-provided or manager-entered availability.
For Flexible PRN, Need to Work is explicit date-level availability and creates a hard auto-draft assignment for that date.
_Avoid_: treating a flexible PRN's empty baseline as permission to schedule them
_Avoid_: choosing flexible status separately for each Schedule Block
_Avoid_: site-scoping PRN scheduling mode before multi-site therapist behavior requires it

**Need Off**:
A therapist availability exception meaning the therapist needs not to be scheduled for their regular shift on that day.
Need Off removes that date from the therapist's baseline work pattern for the selected Schedule Block unless a manager override is recorded.
Need Off blocks auto-draft from assigning the therapist. If a manager schedules the therapist over Need Off, an asterisk marker appears in the schedule grid UI for that therapist/date context.
If a manager overrides Need Off and schedules the therapist anyway, the grid should retain a subtle asterisk/conflict marker for manager context.
The Need Off asterisk may appear in therapist-facing grids too, with plain-language detail available so the symbol is not the only explanation.
_Avoid_: unavailable, can't work, blocked unless quoting implementation details
_Avoid_: treating Need Off as a soft preference
_Avoid_: scheduling over Need Off without a manager override reason visible before Final Publish

**PTO Reason**:
An optional reason attached to a **Need Off** exception when the therapist or intake source identifies the off request as paid time off. PTO is not a separate availability state.
_Avoid_: treating PTO as separate from Need Off

**Availability Submission**:
A therapist's confirmation that they reviewed a specific Schedule Block. A submission may contain Need Off or Need to Work exceptions, or no exceptions.
Submitting no availability exceptions is valid and means the therapist reviewed the Schedule Block and has no changes or requests for it.
Each therapist has one current Availability Submission per Schedule Block; edits during the open window update that current truth while optional history may be retained.
Before the due date or availability lock, staff may edit submitted availability and update the current submission. After lock or Preliminary, later workflow rules apply instead of silently reshaping the schedule.
Staff may save availability progress before submitting, but saved progress is not an Availability Submission and should still count as not submitted for readiness and dashboard purposes.
Saved-but-not-submitted availability should appear as an incomplete attention state and may trigger reminders before the due date.
The primary submit action should stay "Submit availability." Supporting copy can adapt, such as confirming "Submit with no availability exceptions" when the therapist has not marked any days.
Therapists may submit availability for any future Schedule Block as soon as that Schedule Block exists; there is no separate availability opening date.
Therapist availability screens should lead with the next future Schedule Block needing their response, while still allowing the therapist to switch to later visible future Schedule Blocks.
Availability belongs to the target therapist, while entry provenance records who entered or updated it.
Availability changes may be captured whenever, especially for future Schedule Blocks. Once Preliminary has already been sent for a Schedule Block, new availability input does not automatically apply to that Preliminary Schedule; staff schedule feedback for that block happens through Preliminary Cell Marks.
If staff try to edit availability for a Schedule Block already in Preliminary review, the UI should explain that the preliminary schedule is already out and guide them to mark the Preliminary Schedule instead. Availability editing should remain straightforward for future Schedule Blocks.
Future Schedule Block availability remains governed by that future block's own due date and lifecycle, not by whether another current block is in Preliminary or Final.
Staff may copy their own availability from a previous Schedule Block as a convenience, including both Need Off and Need to Work exceptions, but they must review and submit it for the target block. Copied availability should shift by day-of-Schedule-Block position rather than exact calendar date. Manager copy-on-behalf remains separate with attribution.
_Avoid_: assuming submitted availability always contains day-level entries
_Avoid_: treating no-exception submissions as missing availability
_Avoid_: treating saved progress as submitted availability
_Avoid_: storing availability as an unscoped date range that is not tied to the Schedule Block lifecycle
_Avoid_: creating competing active submissions for the same therapist and Schedule Block
_Avoid_: confusing `therapist_id` with `entered_by` or `updated_by`
_Avoid_: silently applying post-Preliminary availability changes to an already-sent Preliminary Schedule
_Avoid_: letting staff think late availability edits will automatically reshape a Preliminary Schedule
_Avoid_: closing future availability just because a different Schedule Block is in Preliminary or Final
_Avoid_: treating copied staff availability as submitted before the therapist reviews it

**Manager-entered Availability**:
Availability exceptions entered by a manager on behalf of a therapist from email, verbal, or paper availability. It counts as supplied availability for scheduling eligibility while automatically preserving manager attribution and optional source context.
It counts as received availability for manager readiness counts, while remaining distinct from a therapist-submitted in-app Availability Submission.
Staff should be able to see when availability was manager-entered on their behalf and who entered it, using simple attribution such as "Entered by Manager Sarah." Simple source context such as "from email" or "from paper form" may be shown when available, but raw intake content should stay out of staff UI.
Staff should receive light notification or dashboard attention when manager-entered availability affects a visible/current availability block they can review. Manager-only internal planning does not need staff notification.
When manager-entered availability is Need to Work, it follows the same hard assignment rule as therapist-entered Need to Work.
While the availability window is open, the therapist may review and update manager-entered availability for their own Schedule Block, with history/attribution retained.
This lets staff correct transcription mistakes while preserving provenance that the original entry was manager-entered. While the window is open, correction may include deleting a manager-entered exception that was wrong, with history retained.
After Availability Locked, therapist changes to manager-entered availability become late manager-reviewed changes rather than direct edits.
Managers may enter late availability for staff after lock as manager-managed availability, with attribution and schedule impact surfaced, but it should not silently reshape existing draft, preliminary, or final schedules.
After Final Publish, manager-entered late availability that requires schedule correction belongs in direct manager schedule edit or operational workflows, not a new Shift Board request.
_Avoid_: treating manager-entered therapist-provided availability as a force-on override
_Avoid_: making manager-entered availability look like the therapist personally entered it in the app
_Avoid_: hiding manager-entered attribution from the therapist whose availability was entered
_Avoid_: exposing raw intake emails, attachments, or notes in staff availability UI
_Avoid_: requiring a typed reason or source note for every transcribed availability entry
_Avoid_: turning manager intake into a staff upload workflow when structured availability UI is available
_Avoid_: silently applying manager-entered late availability to existing schedule assignments
_Avoid_: forcing manager-owned post-Final corrections through Shift Board when manager approval is already inherent

**Manager Force-on PRN**:
A manager decision to schedule a Flexible PRN for a date where no therapist-provided availability exists in the app. It is distinct from Manager-entered Availability and should require a short manager reason before Final Publish.
_Avoid_: treating emailed, verbal, texted, or paper availability transcribed by a manager as a force-on override
_Avoid_: making empty Flexible PRN availability look like the therapist agreed to work
_Avoid_: using force-on when the therapist explicitly told the manager they can or need to work; enter that as Manager-entered Availability instead

**Availability Edit Window**:
The period before availability closes or schedule building starts when a therapist may edit a submitted Availability Submission. Future Schedule Blocks do not need an availability opening date; the manager only sets the due date for when submissions should be complete. After the window closes, changes become manager-managed or move to later workflows.
The due date creates overdue and attention state but does not automatically hard-lock availability by itself. Manager lock or schedule-building is the real lock.
_Avoid_: adding a separate availability-open milestone when the Schedule Block already exists for future submission
_Avoid_: silently changing availability after managers have started schedule planning
_Avoid_: surprising staff with an automatic midnight lock solely because the due date passed

**Availability Locked**:
The state after a manager manually closes availability collection or starts creating a draft schedule for the Schedule Block. Therapists can no longer silently edit submitted availability.
Managers may start schedule building while availability submissions are missing, but the app should warn, identify missing submissions, and confirm that availability will lock.
Staff-facing locked copy should use plain language such as "Managers have started building this schedule. Availability changes for this block now need manager review."
Late therapist changes after lock become manager-reviewed requests or manager-managed availability changes instead of replacing the current submission automatically.
Before Preliminary is sent, late availability input after lock should create a manager review item when supported. After Preliminary is sent, staff should use Preliminary Cell Marks. If the app cannot support review for the current state, it should tell staff to contact the manager rather than silently accepting input.
Approving a late availability change before Final Publish should not automatically mutate draft or preliminary assignments; it should surface schedule impact for deliberate manager action.
Staff should be able to see when a late availability change was approved for manager review but has not yet changed the draft or preliminary schedule, using plain pending-impact language.
_Avoid_: exposing backend draft or cycle terminology to explain the lock
_Avoid_: blocking schedule building solely because availability submissions are missing
_Avoid_: locking availability for schedule building without telling the manager what is missing
_Avoid_: completely losing late therapist input when it should be reviewed by a manager
_Avoid_: silently accepting late availability input that no manager will review
_Avoid_: silently reshuffling assignments when a late availability change is approved
_Avoid_: making staff think late availability approval already changed the schedule when it has not

**Reopen Availability**:
An intentional manager action that reopens a locked Availability Edit Window without deleting existing draft schedule or manager planning data.
Reopening availability after schedule building starts should preserve draft or preliminary work and warn managers that existing assignments may need review.
Reopening availability should notify staff only when staff are expected to act on the reopened window. Manager-only cleanup does not need staff notification.
_Avoid_: reopening availability silently or clearing draft planning as a side effect
_Avoid_: implying reopened availability automatically reshapes existing schedule work
_Avoid_: notifying staff about reopened availability they cannot or do not need to act on

**Manager Availability Plan**:
Manager-entered scheduling intent for a therapist within a Schedule Block. It is a separate layer from therapist-submitted availability exceptions and should not erase who submitted what.
_Avoid_: overwriting therapist submission language with manager planning language
_Avoid_: using creator, source, or intake provenance as a substitute for why the planning entry exists
_Avoid_: using Manager Availability Plan for therapist-provided availability that a manager is simply transcribing

**Manager Availability Queue**:
The manager review order for availability submissions: missing submissions first, submitted with exceptions second, submitted with no exceptions third.
_Avoid_: burying missing submissions below detailed submitted entries

**Availability Readiness Summary**:
A manager-facing summary of whether availability collection is ready for schedule building, including submitted count, missing count, exception count, lock state, and warnings.
_Avoid_: blocking schedule building without explaining what is missing
_Avoid_: hard-blocking schedule building solely because some availability submissions are missing

**Applied Intake Item**:
An email or manual intake item whose parsed availability requests have actually been written into Availability Exceptions or a Manager Availability Plan. Parser confidence alone is not applied state.
_Avoid_: labeling an intake item as applied before the availability write succeeds

**My Shifts**:
The therapist-facing view of the full Schedule Block, with the therapist's scheduled days highlighted and non-working days still visible for orientation.
My Shifts is the primary staff-facing label for personal schedule. My Schedule may remain as a compatibility phrase or route alias, but primary staff navigation should use My Shifts.
My Shifts should show the full six-week Schedule Block context with the therapist's own working days highlighted, so staff can understand where they fit in the broader schedule rather than only seeing an isolated assignment list.
My Shifts should make weekend scanning easy with subtle grouping or labeling because weekend spacing matters in respiratory therapy scheduling.
My Shifts scheduled days should show compact same-shift coworker context and the Designated Lead when the therapist is not the lead, while full cross-shift roster context belongs in Team Schedule.
My Shifts may show coworker names directly when space allows, while mobile or dense layouts may collapse coworkers to a count and show names in day detail.
My Shifts should avoid showing coworker context on ordinary unscheduled days unless the day has an open need or pickup opportunity.
My Shifts coworker context should show names and lead context by default, not teammate contact information.
My Shifts scheduled days should show operational status labels such as On Call, Cancelled, Call In, and Left Early directly on the day, with day detail used for supporting explanation.
When a My Shifts day is On Call or Cancelled, the obligation status is primary while original same-shift coworker and lead context may remain visible as secondary context.
Ordinary staff-facing My Shifts and Team Schedule views show operational status labels by default, not internal reasons or manager notes for those statuses.
My Shifts should show restrained post-publish change markers such as Updated on affected days, while keeping the current schedule/status as the primary truth.
My Shifts should surface plain coverage-needed prompts on relevant preliminary days, such as "Coverage still needed" or "1 more RT needed," while Team Schedule can show the fuller staffing context.
My Shifts may show compact pickup opportunity prompts on unscheduled preliminary days when staffing is below threshold, with Shift Board or the request flow owning the action and lifecycle.
After Final Publish, My Shifts may show a compact Open Shifts or pickup needs strip for discoverability, while Shift Board owns the actual pickup lifecycle.
My Shifts may show when the therapist is the Designated Lead because lead assignment is operational context.
Preliminary and Final schedules should use the same My Shifts entry point, with a large visual difference between review-mode Preliminary and settled Final state rather than separate staff schedule destinations.
Preliminary My Shifts should feel like review mode through obvious banners, pencil/review styling, review deadline context when present, and preliminary-specific actions. Final My Shifts should feel settled through normal schedule styling, Final schedule published labeling, and post-publish Shift Board actions.
My Shifts is not the full-team print surface; staff print the full six-week schedule from Team Schedule.
My Shifts and dashboard may link staff into the relevant Availability workflow when they notice a future issue, but Availability owns the edit and lifecycle rules. If the selected Schedule Block is already in Preliminary review, staff should be guided to Preliminary Cell Marks for that block while normal availability remains available for future blocks.
For today's scheduled shift, My Shifts should show plain same-day issue guidance such as "Same-day issue? Call manager" without creating a staff self-service Call In path. If a manager or unit phone number is configured, the guidance should support one-tap calling; otherwise it should show the instruction only.
My Shifts empty or waiting states should explain the schedule lifecycle plainly, such as no visible Schedule Block, waiting for Preliminary, Preliminary review open, or Final schedule not published yet, and should route staff to the next useful action when one exists.
Mobile My Shifts should preserve the same hierarchy as desktop: the six-week block remains primary, coworker context collapses before schedule context does, and actions remain tied to the selected day.
_Avoid_: reducing My Shifts to only a list of worked days
_Avoid_: using My Schedule as the primary label when Team Schedule also exists
_Avoid_: making staff learn a separate location just to review Preliminary Schedule
_Avoid_: hiding weekend spacing in a plain chronological list
_Avoid_: letting mobile collapse the six-week context into only upcoming shifts

**Team Schedule**:
The canonical live published schedule for all roles, showing who is working across a Schedule Block and current operational statuses such as Scheduled, On Call, Cancelled, Call In, and Left Early.
Therapists may use Team Schedule as read-only shared context. Leads may adjust permitted operational statuses such as Call In, On Call, Cancelled, and Left Early from Team Schedule, while manager-owned assignment and final Shift Board approval authority remains separate.
Once Preliminary Schedule is sent, Team Schedule may show the preliminary version to staff with obvious Preliminary labeling so staff can understand team context and coverage gaps before Final Publish.
Staff may print the full six-week Team Schedule so they can see who is working when. Printing does not grant edit permission.
Dashboard and My Shifts may link to Print team schedule, but the actual full-team print/export view belongs to Team Schedule as the source of truth.
Normal staff Team Schedule print should show schedule truth and operational statuses, not unresolved "Name down" volunteer intents.
Staff Team Schedule should be the place for full roster inspection across the selected Day or Night shift, including coworkers, Designated Lead, visible operational statuses, restrained staffing counts, and print/export actions.
Staff Team Schedule should preserve separate Day and Night views for readability, with switching available for visibility rather than permission.
Staff should not have full schedule data export/download by default; manager export remains the admin-oriented path.
Manager print/export does not need unresolved "Name down" volunteer intents by default; live workflow views remain the source for reduction decisions.
Staff Team Schedule visibility should show names and shift assignments by default, not teammate contact details. Contact information belongs behind directory or profile visibility rules.
Staff may see operational statuses for other staff on Team Schedule, including On Call, Cancelled, Call In, and Left Early.
Staff see only the operational status label for other staff, not reason text.
A therapist may see reason text for their own operational status when a manager or lead entered one.
A therapist may see who made an operational status change on their own affected shift, such as the manager or lead who updated it. Other staff status attribution stays hidden by default.
Staff Team Schedule visibility should not expose HR or scheduling rationale such as FMLA, inactive status, PRN mode, or why someone was not scheduled; those are manager planning details.
Staff may see PRN staff who are scheduled on the same Team Schedule like other scheduled coworkers, but do not need PRN-specific rationale or manager planning details.
Staff-facing PRN labeling should be contextual: show PRN where it helps explain reduction or Lottery expectations, such as selected-day context, rather than stamping every schedule row by default.
Normal staff schedule print does not need PRN labels by default; print focuses on who is working and current operational status labels.
Team Schedule should show Designated Lead assignment because staff need to know the operational lead for a shift.
Staff Team Schedule should show the current Designated Lead, not historical from/to lead reassignment details for everyone.
Team Schedule may show restrained staffing counts such as "3 working / minimum 3" as operational context for staff, especially around coverage and trade decisions, without exposing manager-only rule detail.
Staff-visible staffing counts should count active working staff only; visible Call In, On Call, and Cancelled assignments remain status context and do not count toward working coverage. Cancelled and On Call should reflect that the department is working with fewer active people, but neither creates a problem warning by itself. Left Early remains informational and does not need to change coverage counts by default.
When a reduction volunteer is placed On Call, staff should still see that therapist in shift context with an On Call label; the therapist remains connected to the shift but does not count as active working coverage.
Staff may see plain below-minimum staffing warnings because they can help staff decide to pick up an open shift. The warning should be operational and neutral, not manager-triage detail. Showing the actual minimum is acceptable when space allows, such as "2 working / minimum 3." Staff-facing counts should focus on active/minimum, not target staffing.
Staff may also see below-minimum staffing signals during Preliminary Schedule review so people know where coverage is still needed and can offer to pick up shifts. Draft schedule staffing gaps remain manager planning context until Preliminary is sent.
Staff-facing warnings are based on Minimum Staffing. Below target but at or above minimum may be neutral context, not a warning.
_Avoid_: splitting Team Schedule and Live Schedule into separate primary workflow concepts
_Avoid_: hiding Preliminary team context from staff after Preliminary has been sent
_Avoid_: treating therapist Team Schedule visibility as edit permission
_Avoid_: blocking leads from day-of operational status work they are expected to manage
_Avoid_: treating staff print visibility as permission to export schedule data
_Avoid_: turning the schedule grid into an unrestricted contact directory
_Avoid_: exposing another staff member's operational status reason text
_Avoid_: hiding the therapist's own status reason when it explains a change to their shift obligation
_Avoid_: exposing operational status attribution for unrelated staff shifts by default
_Avoid_: exposing sensitive absence or employment context in staff schedule views
_Avoid_: showing lead reassignment history to all staff when current lead context is enough
_Avoid_: hiding basic staffing context that staff need for responsible coverage and trade decisions
_Avoid_: counting visible Call In, On Call, or Cancelled rows as active staff in staff-facing coverage counts
_Avoid_: treating Cancelled as an automatic coverage problem
_Avoid_: treating On Call as an automatic coverage problem when it is an intentional status
_Avoid_: over-modeling partial-shift staffing from Left Early unless the product deliberately adds that rule
_Avoid_: hiding below-minimum staffing signals from staff when visibility could help fill coverage
_Avoid_: using Team Schedule as the first place ordinary staff must go to understand their own schedule
_Avoid_: making staff-facing staffing warnings alarmist or manager-only in tone
_Avoid_: turning below-target-but-safe staffing into a staff-facing warning
_Avoid_: showing target staffing to staff in a way that makes safe staffing look like a problem
_Avoid_: hiding Preliminary below-minimum signals when staff could help fill coverage
_Avoid_: exposing draft-only manager planning gaps to staff before Preliminary review

**Daily Assignment Uniqueness**:
A therapist may have at most one scheduled assignment on a calendar date within the same Schedule Block, regardless of Day or Night shift.
The assignment uniqueness constraint is per Schedule Block, therapist, and date, not per shift.
Many different therapists may be assigned to the same date/shift; this rule prevents duplicate same-therapist daily assignment, not normal team staffing.
_Avoid_: silently assigning the same therapist to both Day and Night on the same date
_Avoid_: treating double shifts as a normal base scheduling state

**Inactive Therapist**:
A therapist profile that is no longer available for new or future assignments but remains visible anywhere they were historically scheduled.
_Avoid_: removing inactive therapists from old schedules or history
_Avoid_: showing inactive therapists in new assignment pickers by default
_Avoid_: including inactive therapists in auto-draft candidates

**FMLA Therapist**:
An active therapist profile temporarily excluded from new scheduling because they are on FMLA. The therapist remains visible in the team directory and may keep login access, but Auto-draft and new assignment pickers must not include them as assignment candidates while FMLA is active.
_Avoid_: marking FMLA therapists inactive just to keep them out of Auto-draft
_Avoid_: letting manager-entered availability or Need to Work override the FMLA exclusion
_Avoid_: hiding FMLA therapists from the roster when managers still need employee context

**Designated Lead**:
The one assigned lead-capable therapist responsible as lead for a specific Schedule Block date and shift, even when multiple lead-capable therapists are scheduled in that same slot. The Designated Lead must be one of the therapists assigned to that same date/shift. It is represented by the scheduled assignment row, such as `role = 'lead'`, not by a separate `lead_user_id` pointer.
Designated Lead uniqueness is per Schedule Block, date, and shift. Each date/shift can have at most one Designated Lead in every lifecycle state. Final Publish requires exactly one Designated Lead for every date and shift; Draft and Preliminary schedules may have zero while managers build or review the schedule.
The same lead-capable therapist may be Designated Lead on one date/shift and regular staff on another date/shift in the same Schedule Block.
Post-Final manager-owned Designated Lead reassignment should notify affected leads only, not the whole department. Notify both the newly designated lead and the previously designated lead when responsibility is removed.
Draft and Preliminary Designated Lead reassignment is quiet working-schedule editing and does not notify staff.
Auto-draft may create incomplete lead coverage, but missing Designated Lead slots should be surfaced clearly for manager resolution before Final Publish.
Auto-draft should designate an eligible lead-capable assigned therapist as lead where possible using deterministic priority.
If the active Designated Lead is moved to Call In and another lead-capable therapist is already assigned to that same date/shift, the system should automatically designate the next eligible lead-capable assigned therapist as lead.
If no other lead-capable therapist is assigned, the Call In still saves and the slot becomes an urgent unresolved lead-coverage issue.
Automatic Designated Lead promotion uses deterministic priority, such as configured lead priority when available and a stable fallback order when not; managers can adjust afterward.
Automatic Designated Lead promotion after a live Call In should notify the newly designated lead and manager/lead operational attention, not the whole department.
The same automatic promotion selection behavior applies during Preliminary when approving a mark-out removes the current Designated Lead and another assigned lead-capable therapist is available, but Preliminary promotion notification waits for Final Publish.
If a legacy `lead_user_id` field exists, it is migration/compatibility data only; the durable source of truth is the lead role on the assignment row.
_Avoid_: lead-capable therapist, lead user, or manager permission as synonyms for the slot's designated lead
_Avoid_: treating an unassigned lead slot as the same thing as a designated lead
_Avoid_: storing a separate lead pointer that can disagree with the actual assignment list
_Avoid_: allowing two assignment rows to be designated lead for the same date and shift, even temporarily
_Avoid_: designating a lead who is not assigned to the same date/shift slot
_Avoid_: designating a therapist as lead if they are not lead-capable for that schedule context
_Avoid_: keeping `lead_user_id` as an independently writable source of truth

**Lead Capability Change**:
A therapist profile or permission change that affects current lead tools and future designated-lead eligibility. Historical Designated Lead assignments remain as saved.
_Avoid_: removing lead labels from past schedules because the therapist is no longer lead-capable today

**Lead Priority**:
A configurable per-site therapist ordering used to choose among multiple eligible lead-capable therapists for auto-draft lead designation or automatic lead promotion. If no priority is configured, the app uses a stable deterministic fallback.
_Avoid_: random or non-repeatable lead designation when multiple lead-capable therapists are available
_Avoid_: starting with shift-specific priority unless the department later needs different priority ordering by Day versus Night
_Avoid_: treating Lead Priority as permission for lead tools; lead tool access comes from lead capability
_Avoid_: making Lead Priority global across sites if site-scoped Schedule Blocks already exist

**Operational Status Change**:
A live post-publish status update on a scheduled shift, limited to On Call, Cancelled, Call In, or Left Early. Managers and leads may toggle any of these changes from Team Schedule when permitted; staff see the resulting status.
Scheduled is the implied default when an assignment row exists and no active operational status entry overrides it.
A scheduled therapist assignment has at most one current operational status at a time; prior statuses may remain in history.
Operational statuses are reversible: permitted users may clear a current status back to Scheduled or change it to another valid current status while retaining history.
Clearing a status back to Scheduled closes or deactivates the active operational exception row rather than deleting history.
Operational status reasons are optional by default; automatic attribution and history carry the required audit trail.
Operational status changes should run through named server-side actions/RPCs even when the UI feels like a quick toggle.
_Avoid_: treating operational status changes as draft schedule edits
_Avoid_: Sick as a top-level operational status; use Call In instead
_Avoid_: accepting custom operational codes outside On Call, Cancelled, Call In, and Left Early without a deliberate schema migration
_Avoid_: creating an operational status row for every normal Scheduled assignment
_Avoid_: requiring a typed reason for every routine operational status change
_Avoid_: letting clients directly insert or update operational status rows without permission checks, single-current-status enforcement, notifications, lead auto-promotion, and coverage impact handling
_Avoid_: using legacy `shifts.status` or `shifts.assignment_status` fields as the source of truth for live operational state
_Avoid_: keeping legacy shift-row status fields as an independent write/read authority once an active operational entry exists

**Operational Status Notification**:
Role-appropriate notification created by an Operational Status Change. Call In alerts managers and leads because it can create a coverage issue; Cancelled and On Call notify the affected therapist; Left Early does not create broad notifications by default unless follow-up action is required.
When a lead records Call In, managers should be notified immediately in-app at minimum because replacement assignment remains manager-owned. Additional channels follow configured notification delivery.
Left Early is visible in status/history but does not notify the affected therapist by default because the therapist already knows they left early; notify only when a later follow-up action requires it.
_Avoid_: sending broad notifications for every operational status edit
_Avoid_: hiding direct affected-therapist notifications when a schedule status changes their work obligation

**Left Early**:
An operational status meaning a scheduled therapist left before the scheduled shift ended. It is informational for the day and does not affect the staffing ratio for that day.
_Avoid_: treating Left Early as coverage loss
_Avoid_: adding time-based coverage logic to Left Early without a separate feature decision

**On Call**:
An operational status meaning the therapist remains connected to the shift as backup but is not active bedside coverage. It should not automatically create a coverage gap when the manager intentionally moved them on call due to staffing needs.
On Call should be visually and textually distinct from Cancelled in My Shifts and Team Schedule detail because the therapist may still have backup responsibility.
Applying On Call requires manager or lead phone-contact confirmation because it changes the therapist's work obligation while keeping them tied to the shift.
On Call therapists remain visible in schedule context, including when On Call is applied through reduction volunteering.
On Call does not need backup ordering by default. The status alone is enough unless a later department rule adds explicit backup sequencing.
_Avoid_: counting On Call as actively working coverage
_Avoid_: using On Call as a normal initial draft assignment state before publish
_Avoid_: hiding On Call therapists entirely from the shift just because they do not count as active bedside coverage
_Avoid_: inventing On Call backup order without an explicit workflow need

**Cancelled**:
An operational status meaning a manager cancelled the scheduled shift because the staff member was not needed, usually because of overstaffing. Cancelled does not create a coverage gap.
Cancelled should be visually and textually distinct from On Call in My Shifts and Team Schedule detail because the therapist is released from the scheduled shift obligation.
_Avoid_: using Cancelled for call-ins or unresolved staffing gaps
_Avoid_: using Cancelled as a normal initial draft assignment state before publish
_Avoid_: counting Cancelled as active bedside coverage
_Avoid_: hiding Cancelled therapists entirely from the shift history or status view

**Call In**:
An operational status meaning a scheduled therapist cannot work the shift. Call In is the only operational status that automatically creates possible coverage impact and should route managers or leads to urgent resolution when staffing falls below minimum.
Staff do not enter Call In through Teamwise. A therapist who cannot make a shift contacts the manager by phone, and the manager or permitted lead records the official Call In status in the app.
If a replacement or pickup is approved, the original assignment remains marked Call In and the replacement is added as a separate assignment.
Staff-facing Team Schedule should show both the original Call In assignment and the replacement in a restrained way so the schedule reflects current coverage without hiding why staffing changed.
Call In should trigger coverage-impact evaluation, but it should not remain a problem warning after replacement coverage keeps active staffing at or above minimum and lead coverage is resolved.
Leads may record Call In when permitted, but replacement assignment remains manager-owned unless lead schedule-edit authority is deliberately expanded.
If a Call In removes the active Designated Lead but another lead-capable therapist is assigned to the same shift, the system should auto-designate that eligible therapist as lead and show the remaining active staffing count.
If no other lead-capable therapist is assigned, the Call In still saves and the app surfaces urgent unresolved lead coverage for manager/lead action.
_Avoid_: using Call In for overstaffing cancellations
_Avoid_: overwriting the original call-in assignment with the replacement therapist
_Avoid_: counting Call In as active bedside coverage
_Avoid_: adding a staff-facing in-app Call In path
_Avoid_: hiding the original Call In assignment from staff once a replacement is added
_Avoid_: treating resolved Call In history as an unresolved coverage problem

**Lottery Decision**:
A staff reduction decision that can apply **Cancelled** or **On Call** operational statuses to Team Schedule and My Shifts while preserving decision history and reason.
Applying Lottery requires an explicit manager or lead choice between On Call and Cancelled because they mean different work obligations.
After a staff member is lotteried/called off, they move to the bottom of the relevant home-shift Lottery order. Cross-shift fill-in work does not create a separate cancellation pool or move the therapist in the fill-in shift's order.
If no PRN staff are scheduled and a reduction volunteer is selected for On Call or Cancelled status, that reduction counts as their Lottery day and moves them to the bottom of the relevant Lottery order. If a PRN is scheduled and must work while another staff member volunteered for reduction, reducing that volunteer does not count as a Lottery day and does not move them to the bottom.
Staff may put their name down for possible On Call or Cancelled status by volunteering for reduction on their own scheduled shift. Volunteers are considered before PRN staff and before using the Lottery order, but staff do not choose the final status.
PRN staff are not in the Lottery pool. If one or more regular staff have put their name down for reduction, a volunteer may be placed On Call or Cancelled based on staffing needs; when a PRN must work and a regular volunteer is cancelled, that volunteer cancellation does not count as a Lottery day. If no one has put their name down for reduction, PRN staff are considered for cancellation before using the Lottery order. When multiple PRN staff are scheduled, show PRN candidates first and let the manager or lead choose unless a separate PRN ordering rule is deliberately added. PRN cancellation still requires phone-contact confirmation before applying the status.
Managers/leads may apply On Call to a PRN staff member when operationally needed, with phone-contact confirmation, but PRN On Call does not affect Lottery order because PRNs are not in the Lottery pool.
PRN Cancelled status is operational status history only, not Lottery history or Lottery order movement.
Manager/lead reduction resolution should surface PRN context clearly when PRN staff are scheduled or otherwise relevant, so the user understands whether selecting a regular volunteer will count as a Lottery day.
Leads may apply day-of Lottery decisions when they have lead tools, with attribution and history. Managers retain oversight.
Lead-applied Lottery decisions should be visible to managers in activity/history and may notify managers when operational urgency requires it.
Staff affected by a Lottery Decision are contacted by phone; the app records the resulting On Call or Cancelled status but does not need to notify the affected staff member by default.
Applying a Lottery Decision should require the manager or lead to confirm they contacted the affected therapist by phone, whether the result is On Call or Cancelled. The confirmation should record who confirmed phone contact and when.
Phone-confirmation metadata is manager/lead audit context; staff see the resulting status, not the confirmation record by default.
Staff may see Lottery-applied On Call or Cancelled status labels for other people on Team Schedule, but not the reason or phone-confirmation metadata.
Lottery Decisions are reversible by permitted managers or leads through operational status changes, with attribution and history retained.
Reversing a Lottery Decision requires phone-contact confirmation when it changes the affected staff member's work obligation again.
_Avoid_: treating Lottery output as separate from the live schedule
_Avoid_: automatically guessing On Call versus Cancelled when applying Lottery
_Avoid_: using Lottery to apply Call In; Call In is a separate operational status for a therapist who cannot work
_Avoid_: including PRN staff in the Lottery order
_Avoid_: silently auto-picking among multiple PRN staff without an explicit PRN ordering rule

**Reduction Volunteer**:
A staff self-service intent saying they are willing to be placed On Call or Cancelled for one of their own scheduled shifts. Volunteering does not change Team Schedule by itself; manager or lead chooses the final status based on staffing needs and applies On Call or Cancelled after phone-contact confirmation.
Reduction Volunteer is a published/live schedule reduction workflow, not a Draft or Preliminary Schedule review action. Staff-facing copy may use plain language such as "put my name down" instead of making staff choose On Call versus Cancelled.
The staff-facing action label should be "Put my name down" with supporting copy explaining that manager/lead may place them On Call or Cancelled depending on staffing needs.
The active staff-facing state label should be "Name down" in compact schedule UI and "You put your name down" in detail or dashboard contexts. My Shifts should show this active state directly on the relevant scheduled day. Avoid exposing "Reduction volunteer" as staff-facing jargon.
Staff may volunteer for reduction on same-day or future published shifts. The final On Call or Cancelled status still requires manager/lead phone-contact confirmation when the decision is applied.
After Final Publish, staff may put their name down for any future published scheduled shift in the Schedule Block, not only near-term dates.
Staff may start reduction volunteering from My Shifts on their own Final scheduled shift, or from Team Schedule when the selected row is their own active scheduled shift.
The staff-facing action may say Put my name down and should explain that the final result may be On Call or Cancelled depending on staffing needs.
Cross-shift fill-in staff may put their own name down for reduction on the fill-in shift they are actually scheduled for when otherwise eligible. If selected and the reduction counts as a Lottery day, movement still applies to their usual/home-shift Lottery order.
Reduction volunteering is available only for an active Scheduled assignment that does not already have On Call, Cancelled, Call In, or Left Early as its current operational status.
PRN staff do not use reduction volunteering. PRN reductions are handled by the PRN-first operational rule when no regular staff have put their name down, and PRN staff are not in the Lottery pool.
Reduction volunteering remains available even when the shift is already at or below minimum staffing, as long as the therapist shift is otherwise eligible. The UI should explain that management may not reduce anyone when staffing is tight.
Reduction volunteering is blocked when the same therapist shift already has an unresolved Shift Board Need coverage or Trade shift request. Staff should withdraw or resolve the existing request before putting their name down for reduction.
Need coverage and Trade shift requests are also blocked when the same therapist shift already has an unresolved reduction volunteer entry; staff should withdraw the reduction volunteer entry first.
Open Need coverage or Trade shift requests from other therapists on the same date/shift do not block a staff member from putting their own name down; selected-day context may show both.
Picking up an open shift is blocked when it conflicts with a therapist's unresolved reduction volunteer entry for the same shift or creates a schedule conflict. For a different non-conflicting date, the reduction volunteer entry does not block pickup interest.
Staff may volunteer for reduction on multiple different scheduled shifts in the same Schedule Block. Each date/shift is handled independently, while the one-active-intent rule still applies per therapist shift.
If the volunteering staff member is the Designated Lead, applying Cancelled status is allowed only when another lead-capable/lead staff member is working that same shift so lead responsibility can be covered.
When a Designated Lead volunteer is cancelled, the app should designate another working lead-capable staff member for that shift. If multiple eligible replacements exist, manager or lead selects the replacement Designated Lead.
App notification is enough for the newly designated lead when lead responsibility changes through this flow.
The cancelled Designated Lead still requires phone-contact confirmation because their work obligation changes.
Staff may withdraw a reduction volunteer entry from My Shifts or relevant schedule context until manager or lead applies the final status. After On Call or Cancelled is applied, reversal is manager/lead-owned and requires phone-contact confirmation when it changes work obligation again.
When staff withdraw a reduction volunteer entry, the "Name down" marker should disappear from active schedule context immediately while history is retained.
Withdrawing a reduction volunteer entry does not need broad manager/lead notification by default; the active list updates immediately and history remains available.
Putting your own name down does not need a separate in-app confirmation notification; the active "Name down" state in the UI is the confirmation.
Once manager or lead phone contact is completed for a reduction decision, the volunteer entry is locked into that operational decision; staff withdrawal after that point is no longer self-service.
Contact-in-progress state for a reduction decision does not need to be staff-facing.
Unresolved reduction volunteer entries leave the active volunteer list automatically when the shift starts or passes, while remaining visible in history.
Expiration of an unresolved reduction volunteer entry does not need an app notification; it quietly leaves active context and remains in history.
Staff dashboard may surface unresolved reduction volunteer entries as a light active status with withdraw available until the shift starts/passes or manager/lead resolves the entry. It should not read as an urgent task.
After a manager or lead resolves a reduction decision for a date/shift, new reduction volunteer entries for that same date/shift should be blocked with a clear message that the reduction decision has already been handled.
Reversing a resolved reduction decision back to Scheduled does not automatically reopen staff self-service reduction entries for that date/shift.
Managers/leads do not need a dedicated reopen action for names-down self-service by default. After a date/shift reduction is handled, later changes stay in manager/lead operational status workflows.
Staff may see who volunteered for reduction for the relevant shift/day because it helps them understand whether Lottery is likely to reach them. Reduction volunteering does not need a reason or note field.
Coworker visibility may show a small "Name down" marker in schedule context when space allows, plus a selected-day list of people with names down. On cramped mobile, the selected-day list is enough. Staff do not need to see exact submission timestamps.
PRN staff with Team Schedule visibility may see regular staff names-down entries because it explains why a regular volunteer may be reduced while PRN works.
Staff filling in cross-shift may see names-down and PRN context for the date/shift they are working, even though any Lottery movement remains tied to their usual/home-shift order.
Managers or leads choose among reduction volunteers, with submission time visible as context. Volunteer order does not automatically select who is placed On Call or Cancelled, including when a PRN is scheduled and a volunteer may be cancelled so the PRN works.
When a PRN is scheduled or otherwise relevant to the shift, manager/lead resolution should clearly show how PRN context affects the Lottery-counting rule before applying On Call or Cancelled to a regular volunteer.
If PRN context is ambiguous or missing during day-of reduction resolution, the app should allow manager/lead override with explicit confirmation and record the uncertainty instead of blocking the operational decision.
PRN ambiguity or override context is manager/lead history. Staff see the resulting Lottery order and operational status, not ambiguity metadata.
Manager/lead history should distinguish a regular volunteer reduction where PRN worked from a regular volunteer reduction with no PRN because that distinction determines whether the volunteer moves in Lottery order.
Manager/lead resolution should warn when selecting a cross-shift fill-in volunteer because any counted Lottery movement applies to that therapist's usual/home-shift order, not the shift they are filling into.
Managers and leads should see relevant reduction volunteers from Team Schedule day detail because day-of reduction decisions happen there. A dedicated Lottery or reduction workflow can still provide the fuller list and history.
Leads may resolve reduction volunteers for the current day when they have lead operational tools. Future scheduled-day reduction decisions remain manager-owned unless a broader permission is deliberately granted.
Lead current-day reduction resolution follows Lead Operational Status Permission: if the lead has cross-shift operational tools, they may resolve Day or Night reduction decisions for the current day.
Current-day manager/lead operational views should show current-day reduction volunteers only. Far-future names-down entries belong in the fuller reduction/Lottery view or the relevant future date's Team Schedule detail.
Managers do not need aggregate future names-down summary counts by default.
When no PRN staff are scheduled, selecting a reduction volunteer for On Call or Cancelled status counts as that staff member's Lottery day and moves them to the bottom of their relevant home-shift Lottery order. When a PRN is scheduled and must work, selecting a reduction volunteer for On Call or Cancelled status does not count as a Lottery day.
If active reduction volunteers exist, reducing a non-volunteer should require an explicit manager/lead override reason. Volunteers are the normal first path, but operational exceptions are allowed with attribution.
Volunteer-bypass override rationale is manager/lead history by default. Staff see the resulting On Call or Cancelled status, not the reason volunteers were bypassed, unless it is their own affected shift.
_Avoid_: treating a reduction volunteer as already On Call or Cancelled
_Avoid_: using reduction volunteering before Final Publish; staff use Preliminary Cell Marks during Preliminary review
_Avoid_: letting staff volunteer another person for cancellation
_Avoid_: allowing reduction volunteering from an assignment that is already On Call, Cancelled, Call In, or Left Early
_Avoid_: allowing PRN staff to put their name down for reduction
_Avoid_: allowing multiple unresolved self-service intents for the same therapist shift
_Avoid_: allowing Designated Lead reduction volunteer cancellation when no other lead-capable staff member is working that shift
_Avoid_: preventing staff from withdrawing unresolved reduction volunteer intent
_Avoid_: hiding reduction volunteer names when they materially affect staff expectations about working
_Avoid_: exposing reduction volunteer reasons by default
_Avoid_: presenting reduction volunteer order as an automatic entitlement to be placed On Call or Cancelled
_Avoid_: moving a reduction volunteer to the bottom of the Lottery order when PRN-staffing rules mean the cancellation should not count as a Lottery day
_Avoid_: asking staff to choose between On Call and Cancelled when volunteering; staffing needs determine the final status
_Avoid_: reducing a non-volunteer while active volunteers exist without explicit override context
_Avoid_: exposing volunteer-bypass rationale to unrelated staff
_Avoid_: showing staff a contact-in-progress state before the operational decision is resolved
_Avoid_: relying on app notification as the primary communication for Lottery call-off decisions
_Avoid_: applying Lottery call-off status without phone-contact confirmation
_Avoid_: exposing phone-confirmation audit metadata in staff Lottery/status UI by default

**Lottery Visibility**:
Role-based access to Lottery information. Managers and leads can view and apply decisions across shifts, and therapists can view their shift's lottery order and their own position without apply controls.
Lottery order is scoped to the relevant site/unit or Schedule Block context and the therapist's usual/home shift. A therapist should not move in a Lottery order for a location or shift context they are only filling into.
Therapists should have an easy contextual way to see their Lottery position and shift order, such as from Dashboard or My Shifts, using neutral language. Staff may see the actual Lottery order and reduction volunteer list as read-only context so they can understand whether they are likely to work. This context should appear only when relevant to an upcoming scheduled shift or selected day, not as always-on dashboard clutter. This does not make Lottery a full therapist primary workflow or give staff decision authority.
Staff Lottery visibility may show the logged-in therapist a light note about their own last movement, such as "Moved after reduction on July 22." Staff should not see full rationale or movement history for everyone.
Staff infer coworker Lottery movement from the current order; the app does not need to show movement events for other staff.
Manager/lead Lottery history should be filterable by Day/Night and by staff member so operational history is explainable without scanning a giant log.
Managers may manually adjust Lottery order when needed, but the action requires an explicit reason and is saved in manager history. Lead manual reorder requires a separate deliberate permission if ever added.
Staff see the current Lottery order after manual adjustment, not the manager reason. If the logged-in staff member's position changed because of a manual adjustment, a light self-facing note such as "Order updated by manager" is enough.
Manual Lottery order adjustment does not notify affected staff by default because it changes order context, not a current work obligation.
Therapist Lottery context should show the therapist's own position prominently and may show the full Day and Night order for operational visibility. Staff visibility does not include applying Lottery decisions or calling staff off in the app; manager/lead owns the action.
Day and Night Lottery orders should be presented as clearly separate home-shift lists or tabs, never one combined list. Cross-shift fill-in assignments do not require a separate staff cancellation pool.
Therapists see current Lottery order and position, not Lottery history or manager rationale by default.
_Avoid_: hiding lottery order from therapists when transparency is expected
_Avoid_: judgmental labels such as at risk or penalty
_Avoid_: exposing manager apply controls or manager rationale in therapist Lottery context
_Avoid_: turning therapist Lottery context into a manager history/audit view
_Avoid_: treating staff Lottery visibility as permission to apply call-off decisions
_Avoid_: combining Day and Night Lottery order into one ambiguous staff-facing list

**Pickup Resolution**:
The approved result of a pickup workflow that adds or assigns a therapist to the live Team Schedule while preserving the original operational status, such as Call In, on the original assignment.
_Avoid_: treating Shift Board approval as separate from Team Schedule truth
_Avoid_: clearing the original Call In just because a replacement was added

**Open Shifts**:
The unified Shift Board opportunity list where staff can respond to team-visible coverage requests and open trade requests. Open Shifts should make the item type unmistakable while keeping "where can I help?" in one staff destination.
_Avoid_: splitting coverage opportunities and open trade opportunities into separate primary staff destinations
_Avoid_: making staff infer whether an open item is coverage or trade from hidden lifecycle state

**Open Shifts Responder Queue**:
The ordered list of therapists who respond to an Open Shifts post. The first responder is primary, later responders are backups, and the manager selects or approves the final resolution. Staff who responded should see neutral position language such as "You're first in line" or "Backup responder #2."
Staff may withdraw their offer while the Open Shifts item is still pending manager approval. After manager approval finalizes them, backing out is a manager-handled schedule change rather than responder self-withdrawal.
Open Shifts pickup response should block before submission when it would schedule a night shift before the therapist works the next day, or a day shift after the therapist worked the night before.
Staff may express interest in cross-shift pickup when necessary and no rest-rule conflict exists, but manager approval remains required and the UI should treat cross-shift work as an exception rather than the common path.
Cross-shift pickup opportunities should be visibly distinguished with restrained labels such as Day shift, Night shift, or Cross-shift so staff do not accidentally volunteer for the wrong shift.
_Avoid_: hiding responder order from therapists or managers
_Avoid_: winner/loser language for responder position
_Avoid_: locking staff into an unresolved offer they can no longer cover
_Avoid_: letting staff undo an approved schedule change without manager involvement
_Avoid_: relying on manager review to catch night-before/day-after pickup conflicts

**Approved Swap**:
A manager-approved swap whose final assignments are reflected on Team Schedule and My Shifts while Shift Board preserves the request lifecycle and history.
_Avoid_: showing approved swaps only as request history without updating the live schedule

**Shift Board**:
The shared workflow for therapists, leads, and managers to handle swaps, pickups, and direct shift requests after a schedule exists.
Shift Board requests are for post-publish live schedule changes. Preliminary Schedule feedback uses Preliminary Cell Marks instead of Need coverage or Trade shift requests.
_Avoid_: using Requests, Pickups, or Shift Swaps as separate primary navigation concepts
_Avoid_: treating route/API action names as the lifecycle model; Shift Board state transitions should be explicit domain commands
_Avoid_: using Shift Board for Preliminary Schedule feedback before Final Publish

**Shift Board Section**:
A shared section name used across roles: Needs Action, Open Shifts, My Requests, and History. Section contents and available actions vary by role and permission.
Staff should land on My Requests when they have an active request or a direct request waiting on them; otherwise they should land on Open Shifts. Managers can keep Needs Action as the primary review default.
_Avoid_: giving each role a different board structure for the same workflow
_Avoid_: defaulting staff to an empty manager-shaped Needs Action view

**New Shift Board Request**:
The therapist entry point for creating a new trade request or coverage request. The entry point should be neutral, then the first composer screen should make the therapist choose Trade shift or Need coverage before sending anything. Picking up a shift is not created here; therapists pick up shifts by opening an existing Open Shifts item and responding to it.
Submitted request terms are not edited in place. If a therapist chose the wrong shift, teammate, path, or message, they withdraw the pending request and create a corrected one.
Each therapist may have at most one unresolved Shift Board request for the same scheduled shift. Creating a different path for that shift requires withdrawing the existing unresolved request first.
_Avoid_: "Pick up a shift" as a new-request option
_Avoid_: defaulting New request into one request type before the therapist chooses intent
_Avoid_: mutating pending request terms after teammates or managers may have seen them
_Avoid_: allowing parallel unresolved trade and coverage requests for the same therapist shift

**Coverage Request**:
A therapist request for someone to cover one of their scheduled shifts by either posting it to Open Shifts or asking a specific teammate. The staff-facing action is Need coverage. Open Shifts is the default coverage path because more than one qualified teammate may be able to help; direct teammate ask remains available when the requester already has someone in mind. Manager approval still finalizes the schedule change.
Coverage Request is for planned post-publish coverage changes, not same-day urgent call-ins. A therapist who cannot make today's shift should contact the manager by phone; staff should not have an in-app call-in path.
Same-calendar-day Need coverage should be blocked or redirected with plain guidance to call the manager by phone.
Staff-facing coverage request screens should briefly explain that the original therapist remains responsible until manager approval updates the schedule.
_Avoid_: Give Up Shift Request as staff-facing language
_Avoid_: forcing every coverage request through a specific teammate first
_Avoid_: hiding urgent Call In inside the normal Need coverage request composer
_Avoid_: adding a staff-facing Call In report path
_Avoid_: letting same-day urgent coverage needs look like routine Shift Board requests

**Calendar-started Shift Request**:
A shift board request started from a selected scheduled day in My Shifts, prefilled with the selected shift. Selected My Shifts day or cell detail should offer Need coverage and Trade this shift so therapists do not have to leave the calendar and re-select the same shift.
My Shifts should use specific action labels instead of a generic Request change label: Pick up this shift for unscheduled below-threshold opportunities, and Need coverage or Trade this shift for the therapist's own scheduled shift when that lifecycle allows those actions.
Same-calendar-day staff shift changes should not enter normal Shift Board request creation. The UI should guide the therapist to call the manager by phone for any same-day Need coverage or Trade shift situation.
Same-calendar-day is evaluated in the hospital or site local date, not the therapist device timezone.
Past shifts and shifts that have already started are read-only for staff request creation. Corrections to those shifts are manager-owned schedule or audit cleanup, not therapist-created Shift Board requests.
_Avoid_: forcing request creation to start only from Shift Board
_Avoid_: letting same-day urgent shift changes look like routine async requests
_Avoid_: using browser timezone as the authority for same-day urgency
_Avoid_: creating staff Shift Board requests for historical or already-started shifts

**Shift-context Request Action**:
A staff-facing Need coverage or Trade this shift action tied to a concrete scheduled shift, such as a selected My Shifts day or a next-shift dashboard card. Shift-context actions should prefill the request composer so therapists do not have to reselect the same shift.
_Avoid_: generic dashboard request buttons that send therapists to a chooser without shift context

**Schedule Impact Preview**:
A visual before/after preview of how a swap, coverage request, or pickup would affect the involved days, shifts, people, coverage counts, and downstream schedule truth. Therapists see it before sending a request; managers see it before approval.
Therapists should see a plain Manager-review warning when a request may create coverage risk, while managers see the detailed operational consequence needed for approval.
Manager-review warnings should not block therapist submission. Block only structurally invalid requests, such as same-day phone-only shift changes, past or already-started shifts, missing shift selection, or duplicate unresolved requests for the same therapist shift.
Staff-facing previews should include the responsibility handoff: the current assignment remains theirs until manager approval changes Team Schedule.
_Avoid_: hiding coverage impact until after request submission or approval
_Avoid_: forcing staff to interpret manager staffing-rule detail before they submit
_Avoid_: hiding exact operational impact from manager approval
_Avoid_: treating every coverage risk warning as a staff-side hard stop

**Post-publish Change Marker**:
A subtle Team Schedule or My Shifts indicator that a visible assignment or status changed after the original publish. The current schedule truth remains primary, with change details available in selected-day detail.
Therapists do not need a visible post-publish change-history view; affected-change notifications and the current live schedule are enough for staff-facing use.
Direct manager schedule edits after Final Publish should create staff-visible changed-after-publish context for affected staff through subtle markers, recent-change summaries, or selected-day detail.
Post-publish changes should notify staff when their own assignment or work obligation changes. Changes only to coworker context or staffing counts can rely on visible schedule context without direct notification.
Post-Final Designated Lead reassignment should create subtle post-publish change context and notify the newly designated lead and the previously designated lead because shift responsibility changed, even if staffing did not.
_Avoid_: cluttering schedule cells with full history
_Avoid_: making original-publish history compete with the current live schedule
_Avoid_: notifying staff for every coworker-context-only schedule change

**Direct Grid Schedule Edit**:
A manager-facing post-publish edit made directly on the schedule grid, similar to normal schedule building. It is allowed, but the system must still save attribution, history, affected therapist visibility, and any required notification or change marker behind the scenes.
After Final Publish, Direct Grid Schedule Edit notifications go only to affected therapists. Draft and Preliminary grid edits do not notify staff.
Manager detail/history should preserve who made the edit, when, and before/after assignment values without cluttering the main grid.
Post-Final Direct Grid Schedule Edit cannot leave a date/shift without a Designated Lead; removing the current lead requires choosing a replacement in the same edit flow.
Post-Final Direct Grid Schedule Edit should run through named server-side actions/RPCs even though the manager edits directly on the grid.
Draft and Preliminary grid edits also use server-side schedule-edit actions for integrity, but without post-Final notification side effects.
_Avoid_: forcing every manager post-publish assignment correction through Shift Board when the manager needs to fix the schedule directly
_Avoid_: treating direct grid edits as silent table updates without audit trail or staff-visible schedule change context
_Avoid_: sending department-wide notifications for direct grid edits
_Avoid_: giving leads direct assignment-edit authority through the grid; lead tools handle operational statuses, not manager-owned assignment changes
_Avoid_: letting clients directly update post-Final assignment rows without manager-only permission checks, hard-rule validation, before/after history, affected-therapist notifications, and change markers

**Restrained Status Design**:
Operational statuses should be easy to understand without overwhelming users with many competing colors. Use text labels, grouping, icons, and subtle tone differences before adding strong color.
_Avoid_: relying on a different saturated color for every status

**Status Abbreviation**:
A compact manager/table-only label such as OC, CX, CI, or LE. Normal UI should use full labels like On Call, Cancelled, Call In, and Left Early.
The database stores canonical operational statuses such as `on_call`, `cancelled`, `call_in`, and `left_early`; abbreviations are presentation only.
_Avoid_: abbreviations in therapist-facing UI or selected-day detail without a legend
_Avoid_: storing display abbreviations as business-state values

**Mobile Priority**:
Mobile design prioritizes therapist quick use first, lead day-of operations second, and manager triage third. Dense manager schedule building can remain desktop-first.
Therapist mobile navigation should prioritize My Shifts over Team Schedule because staff usually check their own work first on mobile. Team Schedule remains available as shared context, but can live behind More if primary mobile space is tight.
Availability should stay in therapist primary mobile navigation only while an open or upcoming availability action needs staff attention. When there is no actionable availability work, Availability can move behind More so My Shifts and Shift Board stay easier to reach.
_Avoid_: compressing every manager workbench into the primary mobile experience
_Avoid_: making therapists dig for their own schedule on mobile
_Avoid_: keeping inactive availability collection in prime mobile navigation at the expense of day-to-day shift workflows

**Workflow History**:
History shown inside the workflow it belongs to, such as Shift Board History, Lottery History, Team Schedule post-publish details, or My Shifts past blocks.
Staff-facing Shift Board history should emphasize active and recent requests, with older request history available but secondary. Full audit-style request history is manager or admin context.
_Avoid_: History as a vague standalone primary navigation item
_Avoid_: making therapist request history feel like an audit log

**Primary Workflow Navigation**:
The small role-based set of main workflows. Therapists use Dashboard, My Shifts, Team Schedule, Availability, and Shift Board. Leads use Dashboard, Team Schedule, Shift Board, Lottery, and limited Availability visibility if needed. Managers use Dashboard, Coverage, Team Schedule, Availability, Shift Board, and Lottery.
_Avoid_: promoting Roster, Publish, History, Print, Export, or Requests into separate primary workflow concepts
_Avoid_: using My Schedule as a primary therapist navigation label

**Attention Surface**:
The combination of Dashboard summary, inline workflow context, and notification history used to show user-relevant changes without duplicating noise.
Therapist dashboards should include a compact attention strip above or near the schedule-first content for urgent actionable items such as Preliminary review, availability due, direct request waiting, or Final schedule published.
Therapist dashboards may show a compact recent schedule changes summary that links into My Shifts, while affected My Shifts days carry the actual post-publish change markers.
Final Publish should create an app notification and prominent schedule context, but should not force staff to acknowledge the schedule before continuing to use the app.
_Avoid_: relying only on global notifications or repeating the same alert everywhere
_Avoid_: blocking staff behind a Final schedule acknowledgement gate

**Role-specific Dashboard**:
A dashboard whose information hierarchy matches the user's role: therapist personal next action, lead day-of regular-shift operations, or manager both-shift operational triage.
Therapist Dashboard should be schedule-first: the six-week My Shifts view is the primary content, while attention items, next shift, recent changes, open needs, availability, Shift Board, Lottery context, and Team Schedule print access support that schedule view.
Therapist dashboards should include a compact recent schedule changes summary that links into My Shifts or Shift Board instead of becoming a full history surface.
Therapist dashboard and My Shifts surfaces must make Preliminary Schedule and Final Schedule visibly distinct with plain labels such as "Preliminary - review open" and "Final schedule published."
Therapist dashboards should make the next availability block needing action primary, with later future blocks summarized secondarily rather than shown as equal competing cards.
Therapist Dashboard empty states should explain why the schedule is not actionable yet and point to the next useful workflow, such as Availability, Preliminary review, Team Schedule, or waiting for Final Publish.
_Avoid_: one generic dashboard trying to serve all roles equally
_Avoid_: making ordinary therapists assemble their schedule picture from disconnected cards
_Avoid_: making staff rely only on notification history to notice recent schedule changes
_Avoid_: turning the dashboard into a detailed audit or history page
_Avoid_: letting staff confuse a Preliminary Schedule with the official Final Schedule
_Avoid_: overwhelming staff with multiple equal future availability cards when one next action is most important
_Avoid_: letting attention items push the six-week My Shifts context out of the primary staff dashboard experience

**Lead Dashboard**:
The lead-facing dashboard for today or next-shift operations on the lead's regular shift, including Team Schedule status, Call In impact, operational status attention, Lottery decision context, and Shift Board visibility without manager final approval.
_Avoid_: turning lead dashboard into manager schedule planning

**Lead Experience Activation**:
Lead-facing tools appear based on permanent lead permission across both Day and Night shifts, even when the lead is not assigned as lead that day.
_Avoid_: hiding lead tools just because the lead is not lead on the selected day
_Avoid_: limiting lead tools to the lead's regular shift unless a future explicit role narrows that permission

**Lead Tools Indicator**:
A small UI indicator showing that a user has permanent lead tools across Day and Night. It is separate from selected-day assignment language such as Assigned lead today.
_Avoid_: implying permanent lead tools depend on being lead that day

**Coverage**:
The manager staffing workbench for building, reviewing, fixing, and maintaining coverage across a Schedule Block.
_Avoid_: presenting Coverage as the general staff schedule

**Coverage Availability Signal**:
A compact manager-facing signal in Coverage showing relevant availability context for a therapist, such as Need Off, Need to Work, No submission, or No exceptions.
_Avoid_: embedding the full availability calendar in every assignment picker

**Minimum Staffing**:
The urgent staffing floor for a date/shift. Falling below minimum requires immediate manager/lead attention.
Final Publish may proceed below minimum staffing only with manager acknowledgement and reason, and the issue remains urgent/visible after publish.
_Avoid_: treating minimum staffing and target staffing as the same severity
_Avoid_: silently publishing below minimum staffing without an explicit manager acknowledgement

**Target Staffing**:
The planned ideal staffing level for a date/shift. Being below target but at or above minimum is ordinary schedule visibility, not a publish-gate item.
_Avoid_: treating target staffing shortfalls as publish checklist items when minimum staffing is met

**Before Publish Checklist**:
A manager-facing Coverage checklist of issues that must be reviewed before publishing, including unresolved preliminary marks, Need Off overrides without reason, unresolved Need to Work structural conflicts, missing lead coverage, below-minimum staffing, and missing availability submissions needing acknowledgement.
_Avoid_: burying publish blockers across unrelated page sections

**Publish Blocker**:
A Before Publish Checklist issue that prevents publishing until resolved or explicitly allowed by rule, such as unresolved preliminary marks, a Need Off override without reason, Need to Work not honored because of unresolved structural conflict, missing required lead coverage, or below-minimum staffing without acknowledgement and reason.
_Avoid_: allowing high-trust or critical staffing issues to publish silently

**Publish Warning**:
A Before Publish Checklist issue that can be acknowledged and published with manager judgement, such as acknowledged missing availability submissions, non-critical staffing concerns, or workload warnings.
_Avoid_: blocking all warnings as if they were critical errors
_Avoid_: treating missing availability submissions as hard Final Publish blockers

**Schedule Blocks Utility**:
A manager utility inside Coverage for viewing current and past Schedule Blocks, publish status, publish history, take-offline actions, safe delete where allowed, and start-over actions.
_Avoid_: treating Publish as a separate primary workflow

**Schedule Block State**:
The resolved lifecycle state of a Schedule Block, such as draft, preliminary active, published live, offline, or archived. The state should be derived in one place before it is relied on across Coverage, Team Schedule, Availability, Publish History, and therapist dashboards.
Lifecycle state should have one source of truth; compatibility fields such as `published` may exist only as derived or read-only mirrors during migration.
Archived Schedule Blocks are read-only historical records; corrections require a named lifecycle path instead of quiet edits.
Lifecycle transitions with side effects or safety checks must run through named server-side actions/RPCs.
_Avoid_: scattering raw `published`, preliminary snapshot, shift-count, and archive checks across workflow code
_Avoid_: changing lifecycle state through arbitrary status or published-field updates instead of named manager actions
_Avoid_: letting `status` and `published` become independently writable lifecycle authorities
_Avoid_: allowing Final Publish by direct `schedule_cycles.status` updates instead of a named server-side action/RPC

**Preliminary Schedule**:
The staff review window for a manager's draft Schedule Block. It is the web version of a paper schedule marked preliminary: staff can review their days, PRN can claim low-coverage slots during the review period, staff changes remain visibly separate from the manager's original draft, and the manager keeps final say before publish.
Managers may continue editing the schedule grid during Preliminary before Final Publish; those edits remain part of working schedule review and do not create Final-style notifications.
Staff see the current working Preliminary Schedule as managers edit it, but it must remain clearly labeled as not Final.
_Avoid_: treating preliminary as only a notification that a draft exists
_Avoid_: losing the distinction between the manager's original draft and staff review edits
_Avoid_: notifying staff for every routine manager edit during Preliminary review
_Avoid_: publishing a normal final schedule without a preliminary review window unless a manager explicitly bypasses it with confirmation and reason

**Send Preliminary**:
The atomic manager action that opens the Preliminary Schedule by creating or refreshing the preliminary snapshot, moving the Schedule Block to preliminary active, and sending preliminary notifications together.
_Avoid_: allowing snapshot creation, lifecycle state change, or notification send to succeed independently and leave the Schedule Block half-preliminary
_Avoid_: exposing Send Preliminary as a direct status-field update
_Avoid_: implementing Send Preliminary as split client-side writes instead of one named server-side action/RPC

**Preliminary Bypass**:
A manager-confirmed exception that publishes a Schedule Block directly to final without a Preliminary Schedule, with a required reason captured in publish or audit history.
It skips staff preliminary review only; all Final Publish blockers, warnings, validation, and notification behavior still apply.
_Avoid_: treating direct final publish as the normal path
_Avoid_: storing the bypass reason as the Schedule Block's lifecycle state
_Avoid_: allowing bypass with only a confirmation click and no audit reason

**Final Publish Notification**:
The block-wide notification sent when a Schedule Block becomes the official active final schedule, including normal Final Publish and republish from offline. It goes to all therapists in the Schedule Block, not only therapists whose assignments changed during preliminary review.
Staff receive Final Publish Notification even when their schedule did not change from Preliminary because Final Publish is the official release moment.
_Avoid_: treating Final Publish as a delta-only notification
_Avoid_: skipping unchanged therapists when the official final schedule is released

**Preliminary Pencil Layer**:
The staff-entered review layer on top of a Preliminary Schedule, represented as cell marks rather than formal Shift Board requests. The pencil layer does not directly rewrite the manager's original draft; it waits for manager review before becoming part of the final published schedule.
Manager edits to the Preliminary Schedule should preserve staff pencil marks where possible and surface conflicts when the underlying assignment/date context changes.
Staff may create or edit pencil marks only while the Schedule Block is in Preliminary review.
Managers may explicitly close Preliminary review to stop new staff input while they finalize the schedule. Final Publish also closes Preliminary review automatically.
After Preliminary review is closed but before Final Publish, staff may view the current preliminary schedule and their resolved mark state, but cannot create or edit marks.
Closing Preliminary review does not need a separate staff notification; Final Publish is the main staff communication point.
When a manager sets a Preliminary review deadline, staff-facing preliminary surfaces should show it plainly, such as "Review by Friday." If no deadline is set, say only that Preliminary review is open.
Managers are not required to set a Preliminary review deadline when sending Preliminary, but the workflow should make it easy to add one.
_Avoid_: letting staff preliminary edits silently mutate the manager's draft shifts
_Avoid_: showing every staff member's unresolved pencil marks to all staff; staff see their own marks, while managers see all marks
_Avoid_: bending request-style preliminary tables into the source of truth for paper-style cell marks; use a cell-mark model that matches the grid interaction
_Avoid_: silently dropping staff pencil marks because a manager edited the preliminary grid
_Avoid_: accepting new preliminary pencil marks in Draft, Final, Offline, or Archived states
_Avoid_: reopening preliminary marks after Final Publish; use post-Final workflows instead
_Avoid_: silently closing staff preliminary input just because manager review work has started
_Avoid_: leaving managers without a clear way to stop new preliminary input before finalizing
_Avoid_: sending noisy staff notifications just because Preliminary review closed
_Avoid_: inventing a staff preliminary deadline when the manager did not set one
_Avoid_: blocking Send Preliminary solely because no review deadline was entered

**Preliminary Cell Mark**:
A staff pencil mark on one date cell of the Preliminary Schedule. Marking out a scheduled `1` means the staff member is asking not to work that assigned day; writing a `1` into an empty eligible day means the staff member is asking to work that day. The mark is visible to the manager as staff-entered pencil until manager final review.
The mark belongs to a target therapist row, while provenance records who created or updated it.
Managers may create or correct Preliminary Cell Marks on behalf of staff with provenance retained.
While Preliminary review is open, staff may edit manager-created marks that belong to their own row.
Staff may continue creating or editing unresolved Preliminary Cell Marks while managers are resolving other marks, until the manager explicitly closes review or publishes. Newly submitted marks must stay visible to managers and keep Final Publish blocked until resolved.
Staff should see their own Preliminary Cell Marks, not coworker-specific preliminary marks. Aggregate staffing signals can remain visible without exposing who requested a preliminary change.
Staff may see aggregate preliminary interest such as how many people offered to help on an understaffed day, but not the coworker-specific marks behind that count.
Staff may create Preliminary Cell Marks from Team Schedule context only on their own row or eligible own-shift cells when the UI makes ownership clear.
Each therapist/date/shift cell has at most one current Preliminary Cell Mark state; history may exist behind it.
A Flexible PRN add-work mark during Preliminary review is explicit work intent for manager review, even without prior date-level availability.
Staff may use Pick up this shift to create a Preliminary Cell Mark offering to pick up an understaffed preliminary shift. This is preliminary add-work intent, not a post-publish Shift Board pickup.
Preliminary add-work marks should block before submission when they would create the same night-before/day-after conflict as a Final Open Shifts pickup response.
Night-before/day-after pickup blocks should use plain staff-facing errors such as "You cannot pick up this night shift because you are scheduled the next day" or "You cannot pick up this day shift because you worked the night before."
Below-minimum preliminary days should be highlighted as useful places to help, but staff may still add-work mark any eligible day they want to work.
Preliminary add-work marks are manager-review requests, not automatic hard assignments like pre-schedule Need to Work.
Staff-facing preliminary add-work UI should not warn about overstaffing. Staff offer availability; managers decide whether to accept over-coverage.
During Preliminary review, staff feedback belongs in Preliminary Cell Marks only; Need coverage and Trade shift request creation belongs to post-publish Shift Board workflows.
Preliminary scheduled-day actions should use preliminary-specific wording such as Ask to remove me or Move this shift, not post-publish Need coverage or Trade this shift labels.
Preliminary mark-outs are also manager-review requests; the assignment is removed only if the manager approves the mark-out.
Staff may withdraw their own unresolved Preliminary Cell Marks while Preliminary review is open.
This includes preliminary add-work offers: staff may withdraw before manager resolution, but after approval the assignment is schedule truth and changes are manager-handled.
After a manager approves, denies, or dismisses a Preliminary Cell Mark, staff cannot edit or withdraw that resolved mark.
After a same-cell Preliminary Cell Mark is denied or dismissed, staff cannot create a new mark on that same cell unless a manager reopens it.
If staff try to add the same day again after denial or dismissal, the UI should show a clear error message explaining that the manager already resolved that preliminary mark and that they should contact the manager if something changed.
Managers may reopen denied or dismissed Preliminary Cell Marks while Preliminary review remains open, with history retained.
Preliminary Cell Marks cannot be reopened after Final Publish.
Final Publish is blocked until each unresolved Preliminary Cell Mark is approved, denied, dismissed, or otherwise explicitly resolved by a manager so staff feedback does not disappear ambiguously.
_Avoid_: forcing simple paper-style preliminary edits into a heavy swap or request workflow
_Avoid_: routing preliminary pickup offers through normal post-publish Shift Board requests
_Avoid_: making staff evaluate overstaffing before offering to work a preliminary day
_Avoid_: creating post-publish Shift Board requests against a Preliminary Schedule
_Avoid_: publishing final schedules while staff preliminary marks are unresolved
_Avoid_: silently ignoring a repeat preliminary mark after manager denial
_Avoid_: letting staff mark someone else's row; staff preliminary marks are limited to the signed-in staff member's own row, while managers review all rows
_Avoid_: making Team Schedule context imply staff can mark coworker rows
_Avoid_: exposing coworker-specific preliminary requests to staff before manager review
_Avoid_: exposing aggregate preliminary interest in a way that reveals who made the marks
_Avoid_: confusing the target therapist with `created_by` when a manager enters or corrects a mark on behalf of staff
Cross-shift preliminary marks may be allowed when necessary because staff sometimes work across shifts, but they should not be the common/default path.
Cross-shift preliminary marks should require a short staff note so managers understand why the exception is reasonable.
Cross-shift preliminary add-work must prevent unsafe adjacent shift combinations: do not allow a Night shift mark when the therapist is already working the next Day shift, and do not allow a Day shift mark when the therapist is already working the previous Night shift.
_Avoid_: making cross-shift staff marking feel routine when it should be an exception
_Avoid_: accepting cross-shift preliminary marks without context for manager review
_Avoid_: letting cross-shift preliminary marks create night-before/day-after work conflicts
_Avoid_: locking a staff member's preliminary marks immediately after entry; staff can revise their own pencil marks until the manager closes review or publishes
_Avoid_: letting staff undo a manager-approved preliminary assignment without manager involvement
_Avoid_: requiring a note for every preliminary mark; notes are optional context, not the primary interaction
_Avoid_: requiring every mark-out and add-work mark to be paired, even though pairing should be easy when a staff member is proposing a direct replacement day
_Avoid_: blocking a standalone mark-out just because the staff member did not propose a replacement day
_Avoid_: limiting add-work marks only to low-coverage days; staff may mark any day they want or prefer to work, with final approval left to the manager
_Avoid_: blocking staff from marking a day they previously submitted as Need Off; preliminary review is allowed to capture changed availability, while preserving the original Need Off context for manager review
_Avoid_: blocking staff from marking out a scheduled day just because they were originally available; preliminary review is the chance to correct changed availability before final publish

**Preliminary Mark Approval**:
The manager's inline review action for a Preliminary Cell Mark. In the review grid, a staff mark-out should appear as a noticeable hash mark over the original scheduled `1`, and a staff add-work mark should appear as a colored `1`; approving the change removes the old normal `1`/hash mark and turns the new approved `1` into a normal schedule assignment.
After approval, the schedule should update accordingly and the preliminary annotation should disappear from the staff-facing current schedule. Approved marks become ordinary schedule truth; unresolved marks remain visible as review annotations.
Manager approval of cross-shift preliminary add-work should check the same night-before/day-after conflict rule. Managers may override an adjacent shift conflict only with an explicit reason.
Approving an adjacent-shift conflict override should notify the affected therapist when approved, not wait only for Final Publish.
When approving one of several preliminary add-work offers resolves the staffing need and the manager does not want additional staff, other competing offers for that same need should close with a neutral state such as "Not needed after schedule update." If the manager may still approve extra staff, remaining offers should stay pending or be closed intentionally.
Managers should have an explicit bulk action such as Close remaining offers as not needed after enough coverage is approved.
Those neutral competing-offer closures should lightly notify the affected staff members so they know their offer is no longer pending.
Managers may approve more staff than the minimum when appropriate. Minimum Staffing is not a hard cap; over-coverage is a manager warning/context, not an automatic denial.
Preliminary add-work offers should be ordered for manager review by useful fit signals such as lead qualification and staffing need, with submission time as a tiebreaker. Ordering supports manager choice; it does not auto-select the winner.
Staff should not see their rank among preliminary add-work offers; they only need pending or resolved state.
Denied or materially changed Preliminary Cell Marks should lightly notify only the affected staff member before Final Publish. Routine approvals can usually wait for Final Publish to communicate the settled schedule.
If the manager provides a staff-facing comment on a denied Preliminary Cell Mark, the affected staff member should be able to see it.
Manager comments on Preliminary Cell Mark denial are optional by default unless department policy later requires them.
_Avoid_: hiding manager review in a separate approvals queue when the mark can be approved directly from the preliminary grid
_Avoid_: leaving approved staff-entered `1`s visually colored after they become normal schedule truth
_Avoid_: leaving resolved preliminary comments or annotations in the way after the schedule has been updated
_Avoid_: approving night-before/day-after cross-shift conflicts without an explicit manager override reason
_Avoid_: hiding an approved adjacent-shift override until Final Publish
_Avoid_: leaving competing preliminary offers pending after the schedule need is already resolved
_Avoid_: forcing managers to close no-longer-needed preliminary offers one by one
_Avoid_: presenting preliminary offer order as an automatic entitlement to the shift
_Avoid_: showing staff comparative ranking for preliminary offers
_Avoid_: auto-filling coverage when a standalone mark-out is approved; approval removes that assignment and surfaces the resulting coverage count for manager action
_Avoid_: blocking Preliminary mark-out approval solely because it removes the current Designated Lead; auto-promote another assigned lead-capable therapist when available, otherwise surface missing lead coverage for manager resolution before Final Publish
_Avoid_: blocking manager approval of an add-work mark solely because the slot is already at or above target coverage; warn about over-coverage and let the manager decide
_Avoid_: publishing a final Schedule Block while preliminary marks are unresolved; managers must approve, deny, or explicitly dismiss unresolved pencil marks before publish
_Avoid_: keeping denied or dismissed pencil marks as long-term staff-facing schedule clutter; retain manager/audit history only as needed for traceability
_Avoid_: making resolved preliminary history obvious or in the way after manager review; the current grid should prioritize unresolved marks and final schedule truth
_Avoid_: sending noisy notifications for every approved preliminary mark; notify lightly and only the affected staff member when a mark is denied or changed materially, and let final publish communicate the settled schedule
_Avoid_: hiding a staff-facing denial comment from the affected staff member

**Linked Preliminary Change**:
A pair of Preliminary Cell Marks from the same staff member where marking out one scheduled `1` and writing a new colored `1` elsewhere represents one intended move. Managers can approve the linked change as one action, while standalone mark-outs and standalone add-work marks remain valid.
Linked Preliminary Change is not a coworker trade request. Specific teammate trading belongs to post-publish Shift Board after Final Publish.
_Avoid_: forcing every preliminary mark into a linked move
_Avoid_: modeling preliminary linked moves as direct swaps with another staff member
_Avoid_: making managers approve the removal and replacement separately when staff clearly proposed them together
_Avoid_: denying only half of a linked change; deny clears both pencil marks and leaves the original schedule unchanged
_Avoid_: approving a linked change that silently violates hard structural rules such as Daily Assignment Uniqueness or Final lead coverage requirements

**Take Schedule Block Offline**:
A reversible manager action that removes a published Schedule Block from staff live schedule visibility while preserving history and dependencies.
_Avoid_: hard-deleting published schedule history
_Avoid_: requiring staff notification by default; staff communication should happen through republish or a separate manager communication when needed

**Schedule Block Delete**:
A destructive manager action that should be allowed only for safe empty drafts with no meaningful dependent availability, assignment, preliminary, publish, or post-publish history.
_Avoid_: deleting published blocks from normal UI
_Avoid_: deleting any Schedule Block that already has real scheduling data; use archive, offline, or start-over lifecycle paths instead

**Start Schedule Block Over**:
A manager action for resetting draft or preliminary planning state after impact review. It clears schedule planning artifacts such as assignments, preliminary snapshots, and preliminary marks while preserving therapist availability submissions.
After Start Schedule Block Over, Auto-draft may be run again using the preserved availability submissions.
_Avoid_: silently clearing published schedule history
_Avoid_: making staff re-enter availability when the manager only needs to restart schedule building
_Avoid_: allowing Start Over after Final Publish; use published-schedule lifecycle actions instead

**Roster View**:
A table, print, or export-oriented view mode of the Team Schedule.
_Avoid_: treating Roster as a separate primary scheduling workflow

**Need to Work**:
A hard therapist availability exception meaning the therapist must be scheduled to work that day for the applicable shift. Auto-draft must place the therapist on that date instead of treating the entry as a soft preference.
If honoring Need to Work puts the shift over target staffing, the assignment still stands and overstaffing is shown as a manager warning.
Need to Work may add a work day outside the therapist's normal recurring pattern for that Schedule Block.
If Need to Work conflicts with Daily Assignment Uniqueness, the app must show a manager conflict instead of assigning both shifts or ignoring the Need to Work.
Need to Work does not need a persistent grid marker once it becomes a normal scheduled assignment.
_Avoid_: Request to Work, volunteer, prefer to work, can work
_Avoid_: treating Need to Work as only a recommendation boost or optional request
_Avoid_: publishing a schedule that ignores Need to Work unless a higher-priority structural conflict is explicitly resolved
_Avoid_: cluttering the grid with Need to Work markers after the requested assignment has been scheduled

**Availability Shift Scope**:
Therapist-entered availability exceptions default to the therapist's regular shift. Cross-shift availability is manager-managed or advanced, not the default therapist flow.
_Avoid_: making Need Off or Need to Work ambiguous across Day and Night
_Avoid_: asking therapists to choose Day/Night for routine availability when their regular shift already supplies the scope
Manager availability tools may explicitly set Day or Night scope for cross-shift exceptions when needed.

**Direct Swap Request**:
A trade request sent to one specific teammate before manager approval. This is the default Trade shift path because the app can evaluate the two concrete assignments and show whether the proposed trade is coverage-safe.
_Avoid_: private swap, specific-person swap, direct teammate ask

**Direct Request Response**:
The specific teammate's accept or decline response to a Direct Swap Request or direct Coverage Request. Acceptance moves the request to manager approval; it does not change Team Schedule by itself.
_Avoid_: treating teammate acceptance as final schedule approval

**Request Waiting State**:
A therapist-visible lifecycle label that states who the request is waiting on, such as Waiting on teammate, Waiting on manager, Approved, Declined, Denied by manager, or Withdrawn.
_Avoid_: using Accepted alone when manager approval is still required

**Request Withdrawal**:
A therapist action that stops their own unresolved Shift Board request before final manager approval. Withdrawal should notify only engaged participants: the direct teammate who was asked, or responders who expressed interest on an Open Shifts post. It should not notify everyone who could have seen the board.
_Avoid_: silently leaving an asked teammate thinking they still need to respond
_Avoid_: broadcasting open-request withdrawals to the whole team

**On-behalf Shift Board Post**:
A Shift Board post created by a manager, or by a lead if permitted, for a therapist after an operational or verbal request. It must show who created it and who it is for.
_Avoid_: making manager-entered requests look therapist-submitted

**Manager Final Approval**:
The required manager approval step before a Shift Board request can change Team Schedule or My Shifts. Leads may have visibility or operational support permissions, but final swap, coverage request, or pickup approval is manager-only.
If a manager denies a request and provides a reason, the reason should be visible to the requester and directly involved teammate or responders. A denial reason is useful but not required by default unless department policy changes.
Manager approval is the final schedule-changing action and should immediately update Team Schedule and affected My Shifts views without requiring another staff confirmation.
Affected staff should be notified after approval. In-app notification is required; email follows the existing notification preference and channel configuration.
_Avoid_: letting lead actions finalize schedule-changing Shift Board requests
_Avoid_: hiding a manager denial reason from directly involved staff when one exists
_Avoid_: requiring staff to reconfirm after manager final approval
_Avoid_: making email the only record of an approved schedule-changing request

**Lead Operational Status Permission**:
Permission for leads to toggle all live operational statuses on Team Schedule across shifts, including On Call, Cancelled, Call In, and Left Early. It does not include final approval of Shift Board schedule changes.
Lead operational permission is cross-shift; the UI may default to the lead's regular shift for convenience, but permitted lead status work is not limited to that shift.
Lead operational status permission does not include assigning replacement therapists after a Call In; it should surface the coverage gap for manager action.
Leads may apply On Call and Cancelled without manager approval when they have operational status permission; attribution, status history, and affected-therapist notification still apply.
_Avoid_: treating lead status updates as manager final approval
_Avoid_: restricting leads to Call In or Left Early when they normally handle Cancelled and On Call day-of operations
_Avoid_: giving leads designated-lead reassignment authority; changing the Designated Lead is a manager-owned assignment/role edit
_Avoid_: quietly turning lead status tools into live schedule assignment tools

**Open Swap Request**:
A trade request posted for manager review without committing to one teammate up front. This is the fallback Trade shift path for therapists who are flexible or do not already know who might trade.
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
- **Manager Final Approval** is required before Shift Board swaps, coverage requests, or pickups change Team Schedule or My Shifts
- **Lead Operational Status Permission** allows lead status toggles across Day and Night shifts, but Shift Board final approval remains manager-only
- **Lead Operational Status Permission** does not include changing the **Designated Lead** assignment; designated-lead reassignment is manager-owned
- A manager can set a **Manager-assigned partner** while resolving an **Open Swap Request**
- A **Suggested Swap Partner** can be evaluated as a **Coverage-safe swap** or not before manager approval
- A proposed swap that is not **Coverage-safe** should surface a **Manager-review warning** instead of being blocked outright
- A therapist-facing verdict should summarize the outcome first and explain the **Swap consequence** second
- A therapist should complete swap actions inside a **Swap wizard**, not an embedded generic request form
- A manager-facing review should present the **Operational consequence** directly, including the affected shift
- **Shift Visibility** is independent from edit permission; a therapist may view both shifts on Team Schedule without gaining manager edit tools
- **Shift Default** for staff Team Schedule is the therapist's own shift with a Day/Night switch; manager broad views may still offer Both for summary/read-only context
- Team Schedule's manager Both view is summary/read-only for operational status changes; managers and leads must select Day or Night before toggling live statuses
- Dashboard defaults differ from Team Schedule: manager dashboards summarize both shifts, lead dashboards default to the lead's regular shift with optional cross-shift summary, and therapist dashboards stay personal
- A **Regular Shift Change** affects future planning defaults only; historical assignments retain the Day or Night shift saved on the schedule row
- An **Employment Type Change** affects future scheduling rules only; old Schedule Blocks preserve the employment and scheduling context used when they were built or published
- **Auto-draft** is a server-side action/RPC that uses current therapist profile state when creating assignments, then saved rows retain their **Assignment Context Snapshot** so later profile changes do not rewrite the schedule
- A **Lead Capability Change** affects current lead tools and future eligibility only; historical **Designated Lead** assignments remain as saved
- **Lead Priority** starts as a global per-site therapist ordering for auto-draft lead designation and automatic lead promotion; without configured priority, use a stable deterministic fallback
- **Lead Priority** is selection order only, not lead-tool permission
- Therapist availability is exception-based: unmarked days stay at the **Availability Baseline**, while **Need Off** and **Need to Work** are explicit exceptions
- Availability stays two-state for now: **Need Off** and **Need to Work** only, with no softer Can Work state
- **Need Off** and **Need to Work** are mutually exclusive for the same therapist, date, and shift
- The recurring pattern should appear as a compact **Availability Baseline** summary with a separate edit flow, not as part of the main exception calendar
- Recurring pattern edits apply to future Schedule Blocks by default; applying them to the current open Schedule Block baseline requires explicit choice
- Therapist-entered availability exceptions use **Availability Shift Scope**: default to the therapist's regular shift unless a manager-managed or advanced cross-shift flow explicitly says otherwise
- Manager-entered or manager-managed availability may explicitly set Day or Night scope for cross-shift exceptions
- PRN employment has two durable therapist-profile scheduling modes: **Standing PRN** can be scheduled from a recurring baseline, while **Flexible PRN** requires explicit date-level availability, manager-entered therapist-provided availability, or manager force-on intent
- Auto-draft may include **Standing PRN** therapists from their recurring baseline without requiring date-level Need to Work entries, while still honoring Need Off and other exclusions
- PRN scheduling mode is a therapist profile property for now, not site-scoped unless future multi-site therapist behavior requires it
- Auto-draft excludes **Flexible PRN** therapists unless they have explicit date-level availability or **Manager-entered Availability** for that date; **Manager Force-on PRN** is an explicit exception path
- For **Flexible PRN**, **Need to Work** counts as explicit availability and hard auto-draft assignment for that date
- Schedule Block-specific PRN exceptions should be represented by date-level availability entries, **Manager-entered Availability**, or **Manager Force-on PRN** reasons, not by changing the therapist's durable PRN mode
- Schedule Blocks must be 6 weeks, start on Sunday, and never overlap for the same site, but gaps between Schedule Blocks are allowed and multiple non-overlapping blocks may exist in different lifecycle states, including multiple Draft blocks
- The normal operating cadence is consecutive six-week Schedule Blocks, so manager UI should suggest the next Sunday-start block from the latest existing block while still allowing intentional gaps before dependent planning data exists
- The app may behave as single-location for now, but site-scoped schema constraints are acceptable future-proofing
- Schedule Block date ranges become locked once dependent availability, assignment, preliminary, or publish history exists; recovery uses **Start Schedule Block Over** or a new block, not silent date edits
- **Daily Assignment Uniqueness** prevents assigning the same therapist to both Day and Night on the same calendar date in the same Schedule Block
- Schedule assignment uniqueness should be enforced per Schedule Block, therapist, and date, regardless of shift
- A date/shift may have many therapist assignment rows for team staffing, while **Daily Assignment Uniqueness** prevents the same therapist from appearing twice that day
- **Inactive Therapist** profiles remain visible in historical schedules and history, but are excluded from new/future assignment pickers by default
- Auto-draft must exclude **Inactive Therapist** profiles from new/future assignment candidates
- **FMLA Therapist** profiles remain active and visible in the team directory, but Auto-draft and new assignment pickers exclude them while FMLA is active
- Therapist availability entry should show the regular shift once at the top; manager availability views should show shift on each therapist row or card because managers scan mixed staff
- **PTO Reason** may explain a **Need Off** exception, but PTO does not create a separate scheduling state
- **Need Off** and **Need to Work** both override the **Availability Baseline** for the selected Schedule Block
- **Need Off** is a hard scheduling no; manager override requires a visible reason and must not make it look like the therapist agreed
- **Need Off** removes that date from the therapist's baseline work pattern for the selected Schedule Block unless a manager override is recorded
- **Need Off** blocks auto-draft assignment; the asterisk marker appears only when a therapist is scheduled over Need Off, not when Need Off is honored
- A manager override of **Need Off** should keep a subtle asterisk/conflict marker in manager and therapist-facing grid context while staff-facing details show the scheduled shift and manager reason in plain language
- Publish/preflight should require a manager reason for any **Need Off** override before the Schedule Block can be published
- A therapist should be notified when a manager overrides **Need Off** and schedules them anyway; My Shifts should show the conflict and manager reason when present
- **Need to Work** is a hard assignment requirement; auto-draft must schedule the therapist on that date for the applicable shift
- **Need to Work** may add a work day outside the therapist's normal recurring pattern for that Schedule Block
- Honoring **Need to Work** takes precedence over target staffing counts; overstaffing becomes a manager warning, not a reason to skip the assignment
- **Need to Work** does not need a persistent grid marker once scheduled; the normal assignment is enough
- A Schedule Block should not publish while **Need to Work** is unassigned unless a higher-priority structural conflict is explicitly resolved
- If **Need to Work** conflicts with another hard rule, Coverage must show the conflict instead of silently ignoring the requested assignment
- **Need to Work** conflicting with **Daily Assignment Uniqueness** must block auto-draft resolution and require manager action
- An **Availability Submission** can be valid with no exceptions; it records that the therapist reviewed the Schedule Block
- **Availability Submission** records are scoped to one Schedule Block, not a general date range, so lock/reopen/start-over and preliminary workflows know exactly which six-week block they apply to
- A therapist has one current **Availability Submission** per Schedule Block; while availability is open, resubmitting updates the current submission rather than creating competing active submissions
- Therapists may submit availability for future Schedule Blocks as soon as those Schedule Blocks exist; the workflow does not need a separate availability opening date
- Therapist availability should default to the next visible Schedule Block needing that therapist's response, with later future visible blocks available through selection rather than hidden
- When multiple future Schedule Blocks are visible, therapist and manager views should sort them by availability due date first, then Schedule Block start date
- Availability records must distinguish the target therapist from the user who entered or updated the availability
- **Manager-entered Availability** is valid scheduling input when a manager transcribes therapist-provided availability from email, verbal, or paper sources; it must preserve attribution instead of pretending the therapist entered it in-app, but typed source notes are optional
- **Manager-entered Availability** counts as received availability in readiness summaries, while still showing that it was entered by a manager rather than submitted in app by the therapist
- Manager-entered **Need to Work** follows the same hard assignment rule as therapist-entered **Need to Work**
- Therapists may edit manager-entered availability for their own Schedule Block while the **Availability Edit Window** is open; history and attribution should be retained
- After **Availability Locked**, therapist changes to manager-entered availability follow the same late manager-reviewed path as other locked availability changes
- **Manager Force-on PRN** applies only when no therapist-provided availability exists for that Flexible PRN date; if the therapist told the manager they can or need to work, use **Manager-entered Availability** instead
- True **Manager Force-on PRN** requires a manager reason before Final Publish because no therapist-provided availability exists for that date
- Therapists may edit an **Availability Submission** only during the **Availability Edit Window**; after schedule building starts or the window closes, changes are manager-managed or handled through later workflows
- The manager-set availability due date is a deadline for therapist expectations and manager reminders, not an opening gate
- A future Schedule Block should not be therapist-visible for availability submission until the manager has set its availability due date
- Late Need Off or Need to Work changes after **Availability Locked** are manager-managed; therapists should not silently edit locked availability
- Late therapist availability changes after **Availability Locked** should be captured for manager review rather than silently replacing the current submission or being lost
- Approved late availability changes before Final Publish should surface schedule impact for manager action instead of automatically mutating draft or preliminary assignments
- **Availability Locked** begins when a manager closes availability collection or starts a draft schedule; UI should use plain labels such as Availability open, Availability submitted, Availability locked, and Schedule building started
- **Reopen Availability** requires confirmation and impact messaging when draft schedule work has already started
- A **Manager Availability Plan** is separate from therapist-submitted exceptions; conflicts should be visible instead of making it look like the therapist changed their submission
- **Manager Availability Queue** should prioritize missing submissions, then submissions with Need Off or Need to Work exceptions, then no-exception submissions
- **Availability Readiness Summary** should warn when submissions are missing or exceptions need review, but should not hard-block manager schedule building unless a separate rule requires it
- Managers may proceed to Coverage when availability is not ready, but starting schedule building should warn about missing submissions and confirm that availability will lock
- **My Shifts** shows the full Schedule Block with personal scheduled days highlighted; selected-day coworker detail defaults to the therapist's own shift, while both-shift context belongs in Team Schedule
- **My Shifts** keeps Scheduled, On Call, Cancelled, Call In, and Left Early visible instead of hiding changed shifts
- **Team Schedule** is the canonical live published schedule; **Roster View** is only a display mode for table, print, or export needs
- **Operational Status Change** controls belong on Team Schedule for managers and leads when permitted, while staff see those statuses read-only; leads may apply On Call, Cancelled, Call In, and Left Early with attribution/history
- **Operational Status Change** has a closed status set for now: On Call, Cancelled, Call In, and Left Early; custom codes require a deliberate schema/product migration
- **Operational Status Change** must run through named server-side actions/RPCs that enforce permissions, single-current-status rules, history, notifications, lead auto-promotion, and coverage impact handling
- Scheduled is implied by the assignment row when no active **Operational Status Change** exists; operational rows store exceptions from normal scheduled work
- The same **Operational Status Change** control may appear in Coverage, but Team Schedule and Coverage must share one persistence, permission, notification, and lifecycle model
- Each scheduled assignment has one current **Operational Status Change** value at most; status history may exist, but current schedule truth must be single-valued
- Current **Operational Status Change** values are reversible through clear/change actions while preserving status history
- Clearing an **Operational Status Change** back to Scheduled closes/deactivates the active exception row instead of deleting history
- **Operational Status Change** reasons are optional by default; attribution/history is required, typed explanation is not
- **Operational Status Notification** should notify managers and leads for Call In coverage impact, notify the affected therapist for Cancelled or On Call, and avoid broad Left Early notifications by default
- Client-side Coverage permissions are display hints only; server actions and API routes are the authority and must return clear denied-state feedback when access changes
- When an **Operational Status Change** creates a coverage issue, the live status should still be saved; the app should surface the coverage impact and route managers to Coverage or Shift Board rather than auto-filling another therapist
- **Cancelled** means the staff member was not needed and should not create a coverage gap
- **On Call** and **Cancelled** apply to existing assignments through post-publish operations or Lottery outcomes, not as normal initial draft assignment states
- **On Call** and **Cancelled** must remain visually and textually distinct in staff-facing schedule views because they carry different work obligations
- **Left Early** should show on Team Schedule but should not affect the staffing ratio for that day
- **On Call** remains visible on Team Schedule but should be grouped separately from actively working staff, should not count as active bedside coverage, and should not automatically create a coverage gap when intentionally assigned
- **Call In** is the only operational status that automatically creates possible coverage impact and should route managers or leads to urgent resolution when staffing falls below minimum
- When a **Call In** is covered by a replacement or pickup, the original assignment remains marked Call In and the replacement is added separately
- When the active **Designated Lead** calls in, the system should automatically promote another assigned lead-capable therapist on that date/shift when available, and surface the active staffing count such as 3 working at minimum staffing
- If no other assigned lead-capable therapist exists when the active **Designated Lead** calls in, save the Call In and surface urgent unresolved lead coverage instead of rejecting the operational status
- Automatic **Designated Lead** promotion after a lead Call In should use deterministic priority and remain manager-adjustable afterward
- Automatic **Designated Lead** promotion notifications after live Call In should be targeted to the newly designated lead and manager/lead operational attention
- Automatic **Designated Lead** promotion also applies when a Preliminary mark-out approval removes the current lead and another assigned lead-capable therapist is available
- Preliminary automatic **Designated Lead** promotion is visible in the current Preliminary Schedule but does not notify the newly promoted lead until Final Publish
- Lottery is driven by Team Schedule: live schedule changes update the Lottery view, and a **Lottery Decision** applies **Cancelled** or **On Call** back to Team Schedule and My Shifts
- A **Lottery Decision** applies within the therapist's relevant home-shift Lottery order; cross-shift fill-in work does not create a separate cancellation pool
- **Lottery Visibility** lets managers and leads apply decisions across shifts, and lets therapists view their shift order and own position without apply controls
- Therapists may see the full lottery order for their shift using neutral language, with manager-only rationale and apply controls hidden
- Lottery remains a primary workflow for managers and leads, with contextual links from Team Schedule selected-day detail; lead-applied decisions require attribution/history, and therapists see lottery position/order context without needing a primary Lottery nav item
- A **Pickup Resolution** updates Team Schedule as the live truth after approval; Shift Board owns request lifecycle, Team Schedule owns the resulting schedule view
- An **Approved Swap** updates Team Schedule and both therapists' My Shifts views, while Shift Board keeps lifecycle history
- A **Post-publish Change Marker** should show when swaps, pickups, Lottery decisions, operational status changes, direct grid edits, or post-Final Designated Lead reassignment altered the original published schedule
- Original Final Publish assignments should be preserved in history for post-publish edits, but the current live schedule stays primary; detailed post-publish history is manager/audit context, not a staff-facing schedule view
- Managers may use **Direct Grid Schedule Edit** for post-publish assignment corrections directly on the schedule grid; these edits are manager-only and still require attribution, history, affected staff visibility, and appropriate change markers or notifications
- Post-Final **Direct Grid Schedule Edit** must run through named server-side actions/RPCs that enforce manager-only permission, hard schedule rules, before/after history, affected-therapist notifications, and change markers
- Draft and Preliminary grid edits should use server-side schedule-edit actions that enforce hard rules and preserve Preliminary context, but do not send post-Final notifications
- **Direct Grid Schedule Edit** audit details such as changed by, changed at, and before/after assignments should live in manager detail/history, not clutter the main schedule grid
- **Direct Grid Schedule Edit** notifications are only for after-Final-Publish changes and only to affected therapists; Draft and Preliminary edits stay quiet
- Post-Final **Direct Grid Schedule Edit** cannot leave a date/shift without a **Designated Lead**; replacing or removing the lead requires a replacement lead in the same edit flow
- **Restrained Status Design** should make status clear without overwhelming the schedule with many competing colors
- **Status Abbreviation** is only acceptable in dense manager table views with a visible legend or tooltip; normal UI should use full labels
- Operational status abbreviations such as OC, CX, CI, and LE are UI presentation only; persistence should use canonical status values
- **Mobile Priority** should keep mobile focused on therapist schedule/availability/Shift Board use, lead day-of Team Schedule and Lottery work, and manager triage rather than dense schedule building
- **Workflow History** belongs inside each workflow rather than as a standalone primary navigation concept
- **Primary Workflow Navigation** should stay small; supporting views such as Schedule Blocks, Roster View, History, Print, Export, Profile, and Settings stay nested or secondary
- **Attention Surface** should use Dashboard for top action summaries, inline page context for relevant workflow state, and notification bell/history for full notification record
- Dashboards should be **Role-specific Dashboard** surfaces that can share components but not the same information hierarchy
- Therapists should land on a schedule-first dashboard where the 6-week My Shifts view is the primary content, with next shift, availability state, Shift Board actions, recent schedule changes, and Team Schedule access as supporting context
- **Lead Dashboard** focuses on day-of regular-shift operations, not schedule planning
- Leads should land on **Lead Dashboard**, with Team Schedule one click away for live schedule work
- Managers should land on manager dashboard for triage, with Coverage one click away for build/edit work
- **Lead Experience Activation** depends on permanent lead permission, not day-specific lead assignment, and lead tools apply across both Day and Night shifts
- **Lead Tools Indicator** should distinguish permanent lead tools from being assigned lead on a selected day
- Primary navigation should stay conceptually small: My Shifts for personal schedule, Team Schedule for shared live truth, Coverage for manager staffing work, Availability before the schedule is built, **Shift Board** for post-publish swaps, pickups, and direct shift requests, and Lottery for staff reduction decisions
- **Coverage** is manager-first; leads should mainly use Team Schedule, with scoped cross-shift operational visibility where needed
- Leads operate live schedule workflows through Team Schedule, Lottery, and Shift Board visibility; full Coverage build/publish remains manager-first
- **Coverage Availability Signal** should help managers understand candidate fit without overloading assignment views
- **Before Publish Checklist** should group publish blockers and warnings with links to affected day/therapist details
- **Publish Blocker** items prevent publishing until resolved, while **Publish Warning** items can be acknowledged and published with manager judgement
- Missing availability submissions are **Publish Warning** items that require manager acknowledgement but do not hard-block publish
- Staffing below target but at or above minimum is ordinary schedule visibility and does not appear in the Before Publish Checklist
- **Minimum Staffing** and **Target Staffing** are separate thresholds: below minimum is urgent manager/lead attention and publish-gate context, while below target but at/above minimum is ordinary schedule visibility
- Final Publish below **Minimum Staffing** is allowed only with manager acknowledgement and reason, and should remain urgent/visible after publish
- Missing required lead coverage is a hard **Publish Blocker** for Final Publish until resolved; it cannot be downgraded with manager acknowledgement, but Draft and Preliminary schedules may remain incomplete
- Unresolved Preliminary Cell Marks are hard **Publish Blocker** items for Final Publish until each mark is approved, denied, or explicitly dismissed
- Managers may edit the schedule grid during **Preliminary Schedule** review before Final Publish; these edits are quiet working-schedule changes, not post-Final notifications
- Staff see manager edits to the current working **Preliminary Schedule**, with clear Preliminary/not-Final labeling
- Manager edits during **Preliminary Schedule** review should preserve staff **Preliminary Cell Mark** context where possible and surface conflicts instead of silently dropping marks
- Routine manager edits during **Preliminary Schedule** review should not notify staff; staff see the current preliminary schedule when they open it, and **Final Publish Notification** is the main release signal
- Staff can create or edit **Preliminary Cell Mark** entries only during **Preliminary Schedule** review, not in Draft, Final, Offline, or Archived states
- Managers may create or correct **Preliminary Cell Mark** entries on behalf of staff with provenance retained, while staff-facing UI stays focused on the current preliminary schedule
- Staff may edit manager-created **Preliminary Cell Mark** entries on their own row while Preliminary review remains open
- Each therapist/date/shift cell has at most one current **Preliminary Cell Mark** state; prior edits may be retained as history
- A **Flexible PRN** add-work **Preliminary Cell Mark** counts as explicit work intent for manager review even if no prior date-level availability existed
- If approved, a **Flexible PRN** add-work **Preliminary Cell Mark** becomes a normal assignment without requiring **Manager Force-on PRN** reason because the mark itself is therapist-provided work intent
- Preliminary add-work marks are manager-review requests and become assignments only when approved, unlike pre-schedule **Need to Work** hard assignments
- Preliminary mark-outs are manager-review requests and remove assignments only when approved
- Staff may withdraw their own unresolved **Preliminary Cell Mark** entries while Preliminary review is open; history may remain but the current mark is removed
- Manager-resolved **Preliminary Cell Mark** entries are closed to staff edits or withdrawal
- After denial or dismissal, staff cannot create a new **Preliminary Cell Mark** on the same cell unless a manager reopens it
- Managers may reopen denied or dismissed **Preliminary Cell Mark** entries while Preliminary review remains open, with history retained
- Preliminary marks cannot be reopened after Final Publish; post-Final changes use direct grid edits or Shift Board workflows
- **Designated Lead** should be stored on exactly one scheduled assignment row for the slot rather than in a separate `lead_user_id` field that can drift from the assignment list
- Legacy `lead_user_id` fields, if present, should be migrated away from or treated as derived compatibility only
- Draft and Preliminary schedules may have zero **Designated Lead** assignments in an incomplete slot, but no lifecycle state may contain more than one Designated Lead for the same date and shift
- **Designated Lead** uniqueness should be enforced per Schedule Block, date, and shift
- **Designated Lead** is assignment/slot-specific; the same lead-capable therapist may be lead on one date/shift and regular staff on another
- Post-Final manager-owned **Designated Lead** reassignment should notify the newly designated lead and, when applicable, the previously designated lead
- Draft and Preliminary **Designated Lead** reassignment should not notify staff; Final Publish communicates the official lead schedule
- Auto-draft may leave **Designated Lead** gaps in Draft, but those gaps must be visible and Final Publish remains blocked until every date/shift has exactly one Designated Lead
- Auto-draft should assign **Designated Lead** roles where possible from eligible lead-capable therapists using deterministic priority
- A replacement **Designated Lead** must be assigned to that same date/shift slot; if needed, the manager adds the therapist to the slot and designates that assignment as lead
- **Designated Lead** selection is limited to lead-capable therapists for that schedule context
- The normal Schedule Block lifecycle is draft -> preliminary review -> manager resolves staff pencil changes -> final publish; publishing without preliminary review requires explicit manager bypass confirmation and audit reason, and bypass skips only preliminary review, not Final Publish validation or notifications
- **Final Publish Notification** goes to all therapists in the Schedule Block because it is the official schedule release, not only to therapists whose assignments changed
- **Send Preliminary** must be one atomic manager action: preliminary snapshot, Schedule Block state, and preliminary notifications succeed or fail together
- **Send Preliminary** must happen through a named server-side action/RPC, not split client-side writes
- Schedule Block lifecycle changes must happen through named manager actions such as Send Preliminary, Publish Final, Bypass Preliminary, Take Offline, Republish, and Archive, not arbitrary status-field edits
- Lifecycle actions such as Take Offline, Republish, Archive, and Start Over must run through named server-side actions/RPCs with safety checks
- Schedule Block lifecycle has one source of truth; legacy compatibility fields such as `published` must be derived or read-only mirrors, never independent write authorities
- Final Publish must happen through a named server-side action/RPC that performs validation, history, notification creation, preliminary cleanup, and lifecycle transition together
- Archived Schedule Blocks are read-only; edits require a named lifecycle action before the schedule can change
- Published operational warnings are manager/lead visible by default; staff see only warnings that directly affect them personally, such as their own Need Off override or operational status
- Publish belongs inside **Coverage**; **Schedule Blocks Utility** handles published block history, take-offline, safe delete, and start-over actions
- Publishing a **Schedule Block** supersedes any active preliminary snapshot for that same block; staff must not see a block as both preliminary-active and published-live
- Published Schedule Blocks should be taken offline rather than hard-deleted; delete is limited to safe empty drafts with no meaningful dependent data, and start-over requires impact review
- **Start Schedule Block Over** for Draft or Preliminary blocks clears schedule planning artifacts but preserves therapist availability submissions
- After **Start Schedule Block Over**, **Auto-draft** may be run again using the preserved availability submissions
- **Start Schedule Block Over** is not allowed after Final Publish; published schedules use direct grid edits, take offline, republish, archive, or new-block workflows
- Taking a Schedule Block offline is an administrative recovery action and does not require staff notification by default, but manager UI should preserve who took it offline and when
- Offline Schedule Blocks are hidden from active staff My Shifts and Team Schedule, and from normal staff history by default; managers retain access in Schedule Blocks utility
- An offline Schedule Block may be republished only if no replacement block is already published for the same date range, and republish requires impact confirmation plus normal **Final Publish Notification** behavior
- Coverage owns Schedule Block lifecycle utilities; Availability uses a simple Schedule Block selector for submission collection and review without destructive lifecycle actions
- **Shift Board** is the shared workflow name for all roles; specific terms such as Direct Swap Request, Open Swap Request, and Pickup Request belong inside the workflow, not in primary navigation
- **Shift Board Section** names stay consistent across roles, while actions and contents are permission-specific
- Shift Board defaults to **Needs Action** for all roles; if empty, show a clear empty state and counts that point to Open Shifts, My Requests, and History
- **Open Shifts** contains pickup opportunities and open swap requests together, with clear item type labels and optional filters rather than separate primary sections
- **New Shift Board Request** creates trade requests or coverage requests only; pickup responses start from existing Open Shifts posts
- A **Coverage Request** can target a specific teammate or be posted to Open Shifts; manager approval remains required before Team Schedule changes
- Posting a **Coverage Request** to Open Shifts does not remove the original therapist from Team Schedule; the original therapist remains scheduled until manager approval finalizes a replacement or other resolution
- **Open Shifts Responder Queue** should show primary and backup responders, including "you are first in line" or backup position for the current therapist when applicable
- A **Calendar-started Shift Request** should prefill the selected My Shifts assignment and offer Need coverage or Trade this shift from selected-day detail
- A **Schedule Impact Preview** should show the overall schedule effect before a therapist sends a request and before a manager approves swaps, coverage requests, or pickup resolutions
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
