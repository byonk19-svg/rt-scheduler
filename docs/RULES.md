# Rules

This file captures the scheduling rules currently enforced by code and schema.

## Coverage and Slot Rules

- Coverage target per slot is `4` during auto-generate.
- Hard slot bounds are `3` minimum and `5` maximum (`day` and `night` separately).
- Coverage counts only shifts with status `scheduled` or `on_call`.
- A slot can have at most one designated lead (`shifts.role = 'lead'` unique per cycle/date/shift).

## Eligibility Resolution Order

Eligibility is resolved in this order (`resolveEligibility`):

1. Inactive therapist (`is_active = false`) is blocked.
2. FMLA therapist (`on_fmla = true`) is blocked.
3. Cycle override match (`availability_overrides`) for date + shift (`exact` or `both`):
   - `force_off` blocks.
   - `force_on` allows for that cycle/date and bypasses recurring pattern checks.
4. Recurring work pattern (`work_patterns`):
   - `offs_dow` is hard block.
   - Off-weekend by `weekend_rotation = every_other` is hard block.
   - `works_dow_mode = hard`: day must be in `works_dow` (if list is non-empty).
   - `works_dow_mode = soft`: outside `works_dow` is allowed with scheduling penalty.
5. PRN strict rule:
   - If therapist is PRN and no matching `force_on`, date must be offered by recurring pattern.
   - Otherwise blocked with reason `PRN not offered for this date`.

## Weekly Limits

- Weekly limits are enforced per Sun-Sat week.
- Limit source is `profiles.max_work_days_per_week` (sanitized), with employment defaults as fallback.
- Add/move/set-lead operations block when weekly limit would be exceeded unless manager sets override.

## Auto-Generate Behavior

- Works only on draft cycles.
- Keeps existing assignments and fills remaining gaps by slot.
- Leaves unfilled placeholders when constraints prevent eligible picks.
- Unfilled constraint placeholders are stored on `shifts` with:
  - `unfilled_reason = no_eligible_candidates_due_to_constraints`

## Publish Rules

- Publish validates:
  - Weekly workload balance (unless `override_weekly_rules = true`).
  - Slot coverage and lead constraints (`under_coverage`, `over_coverage`, `missing_lead`, `multiple_leads`, `ineligible_lead`).
- If validation fails, publish is blocked with explicit error codes in query params.

## Assignment Status Rules

- Allowed assignment statuses: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`.
- Only manager/lead or lead-eligible therapist/staff may update assignment status.
- Updates are site-scoped in RPC (`profiles.site_id` must match assignment `shifts.site_id`).
- Status changes are audited in `shift_status_changes`.

## Shift Board Approval Rules

- `shift_posts` transitions to `approved` apply assignment changes via DB trigger.
- Approval checks enforce lead coverage safety for swaps/pickups.
- Pending swap posts are auto-expired by cron after shift date passes.
