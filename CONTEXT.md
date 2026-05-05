# RT Scheduler

Scheduling operations for respiratory therapy teams, including availability, published schedules, coverage review, and post-publish request workflows.

## Language

**Direct Swap Request**:
A swap request sent to one specific teammate before manager approval.
_Avoid_: private swap, specific-person swap, direct teammate ask

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
- A manager can set a **Manager-assigned partner** while resolving an **Open Swap Request**
- A **Suggested Swap Partner** can be evaluated as a **Coverage-safe swap** or not before manager approval
- A proposed swap that is not **Coverage-safe** should surface a **Manager-review warning** instead of being blocked outright
- A therapist-facing verdict should summarize the outcome first and explain the **Swap consequence** second
- A therapist should complete swap actions inside a **Swap wizard**, not an embedded generic request form
- A manager-facing review should present the **Operational consequence** directly, including the affected shift

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
