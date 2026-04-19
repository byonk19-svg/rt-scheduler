# Manager Workflow Unification

## Goal

Reduce manager workflow ambiguity by introducing one canonical `Schedule` home, narrowing the old manager dashboard into a true `Inbox`, and reframing existing schedule-adjacent pages as subordinate workflow surfaces instead of competing primary destinations.

## Non-Goals

- Rebuilding Coverage, Availability, Publish, or Approvals from scratch.
- Removing existing detailed workflow pages in this pass.
- Changing therapist-facing navigation or therapist workflow IA beyond any incidental label alignment required for shared shell code.
- Changing scheduling algorithms, publish side effects, or approval business rules.

## Current Problems

- The manager primary nav says `Schedule`, but the destination is the read-only `/schedule` roster page instead of the real staffing workspace.
- The current dashboard (`/dashboard/manager`) reports schedule state that can contradict Coverage or Publish, which breaks trust.
- Coverage, Roster, Availability, Publish, and Approvals are presented as peer destinations even though managers experience them as one lifecycle.
- Several manager-facing pages act as routing or explanation pages instead of high-confidence working pages.
- Some prominent action entry points feel inert or weakly contextualized.

## Product Direction

Manager navigation becomes:

- `Inbox`
- `Schedule`
- `People`

`Inbox` is the old manager dashboard narrowed to alerts, pending actions, recent activity, and items needing review.

`Schedule` becomes a new canonical manager home that answers:

1. What block am I working on?
2. What should I do next?
3. What is blocking publish readiness?
4. Which sub-workspace should I enter to resolve it?

`People` remains the team and access-management area.

## Route and IA Design

### 1) Primary Navigation

- Primary nav label `Today` is replaced with `Inbox`.
- Primary nav label `Schedule` points to a new manager schedule home route.
- Primary nav label `People` remains anchored to `/team`.

Route shape:

- `/dashboard/manager` remains the inbox route for backward compatibility.
- Introduce a new canonical manager schedule route at `/dashboard/manager/schedule`.
- Keep existing routes (`/coverage`, `/availability`, `/publish`, `/approvals`, `/schedule`, `/analytics`) in place for now, but present them in shell/local nav as child workflow surfaces under `Schedule`.

### 2) New Schedule Home

The top of the page is action-first, not status-first.

Required sections:

- **Primary action hero**
  - Current cycle label and status.
  - One dominant CTA such as `Continue staffing current block`.
  - A concise supporting sentence explaining why that is the correct next action.

- **Readiness and blockers**
  - Staffing progress.
  - Lead coverage status.
  - Pending approvals.
  - Publish readiness.
  - Blockers phrased as specific actions, not raw counts alone.

- **Workflow row**
  - `Coverage`
  - `Approvals`
  - `Publish`
  - `Availability`
  - Each card shows a one-sentence purpose plus live status context.

- **Secondary references**
  - `Roster`
  - `Analytics`
  - These remain available but are visually and semantically subordinate to the main staffing loop.

### 3) Page Reframing

#### Inbox

- The current manager dashboard becomes an inbox surface.
- Remove any "source of truth" schedule summary that can drift from Coverage.
- Keep:
  - alerts
  - recent activity
  - pending approvals
  - schedule-related items needing attention
- Do not present cycle planning authority here.

#### Coverage

- Keep Coverage as the detailed staffing execution workspace.
- Reframe copy and hierarchy so it clearly reads as the execution step reached from `Schedule`.
- Reduce perceived noise by prioritizing actionable blockers and next-step language.

#### Availability

- Keep Availability as its own deep workspace.
- Explicitly frame it as a staffing input within the same lifecycle as Coverage and Publish.

#### Approvals

- Keep Approvals as a focused workflow page.
- Make its role in the schedule lifecycle explicit through labels, breadcrumbs/local nav, and contextual summaries.

#### Publish

- Keep Publish as a dedicated page for publish readiness and delivery history.
- Improve wording so it feels like the final stage of the same workflow, not a detached history tool.

#### Roster

- Reframe Roster as a read-only reference view.
- It must no longer act as the main destination for `Schedule`.

#### Analytics

- Reframe Analytics as supporting insight.
- It should help explain risk and readiness, not compete with the operational workflow.

## Shell and Navigation Rules

### Canonical Manager Mental Model

The shell must consistently express:

- `Inbox` = review and attention
- `Schedule` = current cycle operational work
- `People` = staffing records and access administration

### Local Navigation Under Schedule

Local nav for the `Schedule` section should include:

- Home
- Coverage
- Approvals
- Publish
- Availability
- Roster
- Analytics

Ordering is intentional:

- first row: operational workflow
- second tier: reference/support

If visual grouping is available, group `Coverage / Approvals / Publish / Availability` as workflow tools and `Roster / Analytics` as references.

## Truth-Source Rules

The redesign fails if the new `Schedule` home or `Inbox` compute cycle state differently than Coverage.

Therefore:

- Current cycle selection rules must reuse the same cycle-resolution logic already used by schedule workflows.
- "Draft not started", "draft", "published", and "no active cycle" status must derive from a shared source of truth.
- CTA destinations must derive from the resolved active or selected cycle, not a separate heuristic.
- Any readiness summary shown on `Schedule` home must be computed from the same staffing and approval data used by Coverage and Approvals.

## Interaction Design Rules

- Primary CTAs must either navigate clearly or open an obvious working surface; no silent or inert-looking buttons.
- If a page is primarily informational, its CTA language must say where the action happens.
- Counts must be paired with meaning:
  - bad: `167 needs attention`
  - better: `83 unfilled shifts and 84 missing-lead days need staffing review`
- Surfaces should present a recommended next action when possible instead of only status totals.

## Migration Strategy

### Phase 1: IA and Shell Alignment

- Add the new schedule home route and page.
- Rename `Today` to `Inbox`.
- Point primary `Schedule` nav at the new manager schedule home.
- Rebuild local nav hierarchy for the `Schedule` section.

### Phase 2: Reframe Existing Pages

- Update manager dashboard copy and contents to become Inbox-first.
- Update Coverage, Publish, Approvals, Availability, Roster, and Analytics headings/subtitles/action text to match the new hierarchy.
- Remove or demote conflicting labels that imply those pages are standalone primary homes.

### Phase 3: Interaction Cleanup

- Fix dead or weak CTA behavior in manager-critical paths discovered during the usability review.
- Ensure the main action entry points from Schedule home navigate to valid, obvious next steps.

## Testing and Verification

### Required Verification

- Nav active states for:
  - Inbox
  - Schedule
  - People
- New Schedule home renders and shows:
  - current cycle
  - primary next action
  - workflow cards
- Manager dashboard no longer presents contradictory schedule state.
- Primary CTA from Schedule home routes into the correct detailed workspace.
- Existing detailed routes remain accessible and correctly nested under `Schedule`.
- Roster is no longer the primary `Schedule` destination.

### Test Shape

- Unit/integration tests for shell navigation and active states.
- Manager route tests for the new Schedule home and Inbox reframing.
- Regression tests covering shared cycle-state truth logic where possible.
- Targeted browser/E2E verification for the manager workflow:
  - sign in as manager
  - open Inbox
  - open Schedule
  - follow primary CTA
  - verify subordinate workflow cards navigate correctly

## Risks

- Navigation regressions if older tests or links assume `/schedule` is the manager schedule entry point.
- Truth-source drift if the new Schedule home introduces its own schedule summary logic instead of reusing Coverage data rules.
- Partial migration confusion if labels and destinations change in the shell but not inside individual pages.
- Overloading the new Schedule home with too much detail, turning it into another noisy dashboard.

## Acceptance Criteria

- Managers can identify the correct starting point for schedule work within a few seconds of landing.
- `Schedule` consistently means the manager scheduling workflow, not the read-only roster page.
- Inbox and Schedule no longer contradict each other about current cycle state.
- Coverage, Approvals, Publish, and Availability read as one workflow family.
- Roster and Analytics are still available but clearly secondary.
- Manager-facing CTAs in the redesigned flow are explicit and responsive.
