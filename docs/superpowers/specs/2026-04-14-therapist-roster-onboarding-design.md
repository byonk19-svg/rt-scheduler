# Therapist Roster Onboarding Design

Date: 2026-04-14
Status: Proposed
Decision: Approved approach 1, roster-first onboarding

## Goal

Load a new therapist roster into the app so the system knows the current team immediately, preserve the demo manager account, remove all other stale therapist and lead records, and let therapists later claim access with their real email addresses through the existing signup flow.

## Problem

The app currently supports two related identity layers:

- `employee_roster` stores preloaded staff records used for name-based signup matching.
- `profiles` stores active application users created by Supabase Auth.

If we precreate auth users with placeholder emails, later signup with real emails will not align with the current onboarding flow. The existing workflow is designed for roster-first onboarding, where a person signs up with their real email and is matched to a preloaded roster entry by normalized name.

## Scope

This change covers:

- replacing the current therapist and lead roster with the supplied therapist list
- preserving the demo manager account
- removing or archiving all other therapist and lead records
- supporting manager workflows to mark therapists as lead-eligible and as `full_time` or `prn`
- ensuring future real-email signup attaches therapists to roster entries cleanly

This change does not cover:

- invitation emails
- password-reset or account recovery flows
- changing the signup flow to support placeholder auth users
- introducing new dependencies

## Existing Constraints

- `employee_roster` already supports `role`, `shift_type`, `employment_type`, `max_work_days_per_week`, and `is_lead_eligible`.
- signup already checks roster matches by normalized full name and then lets `handle_new_user()` build `profiles` from the matched roster entry.
- `profiles` already supports `employment_type`, `is_lead_eligible`, archival fields, and active/inactive state.
- The current bulk roster UI on `/team` supports role, shift, employment type, max days/week, and lead eligibility, but does not currently support phone numbers.
- The supplied therapist source data includes names and phone numbers, but no real email addresses.

## Recommended Design

### 1. Treat `employee_roster` as the preload source of truth

All therapists from the supplied list should be imported into `employee_roster`, not precreated as auth users.

Each roster row will include:

- `full_name`
- normalized name
- `role = therapist`
- `shift_type = day` by default unless later adjusted
- `employment_type = full_time` by default until managers update it
- `max_work_days_per_week = 3` by default unless managers update it
- `is_lead_eligible = false` by default until managers update it
- phone number support if the roster schema and UI are extended in this task

This keeps roster data aligned with the existing signup path.

### 2. Preserve only the demo manager among existing live accounts

When the new roster is loaded:

- keep the demo manager account untouched
- archive or deactivate every existing therapist and lead profile not represented by the new roster import
- remove or deactivate stale `employee_roster` therapist and lead rows before importing the new list

Manager records outside the demo manager should not be implicitly deleted unless explicitly targeted. The requested behavior is "all others gone except demo manager," but the safe interpretation in code should focus on therapist/lead roster replacement while preserving manager data unless it is the known demo manager preservation case.

### 3. Use the existing signup flow for real-email onboarding

Therapists will later sign up using `/signup` with:

- first name
- last name
- phone number if they choose
- real email
- password

The current normalized-name match against `employee_roster` should remain the onboarding bridge. On signup:

- Supabase creates the auth user with the therapist's real email
- `handle_new_user()` creates the matching `profiles` row
- matched roster metadata flows into the profile
- `employee_roster.matched_profile_id` is set

No placeholder auth account is created ahead of time.

### 4. Use the manager roster workflow to maintain lead and employment status

The manager-facing workflow should remain centered on `/team` and its existing roster tools.

The workflow should support:

- bulk import of therapist names
- phone number capture for each therapist
- editing `employment_type` between `full_time` and `prn`
- editing lead status through `is_lead_eligible`

Recommendation:

- Keep `role = therapist` for these imported therapists unless someone truly needs the separate permission-bearing `lead` role.
- Use `is_lead_eligible` as the operational "lead" marker for scheduler workflows.

This avoids unnecessary permission changes while preserving coverage logic.

## Data Model

### `employee_roster`

Keep using:

- `role`
- `shift_type`
- `employment_type`
- `max_work_days_per_week`
- `is_lead_eligible`
- `is_active`
- match metadata

Recommended addition:

- add a nullable `phone_number` column so roster preloads can carry the source phone data before signup

### `profiles`

Keep using:

- `full_name`
- `email`
- `phone_number`
- `role`
- `shift_type`
- `employment_type`
- `max_work_days_per_week`
- `is_lead_eligible`
- `is_active`
- `archived_at`

On signup, if a matched roster entry includes phone data and the signup form omits phone, the roster phone can be used as a fallback; otherwise the signup phone should win.

## Workflow Details

### Import workflow

1. Manager imports the provided therapist list.
2. Import normalizes names and creates or replaces active therapist roster rows.
3. Import stores phone numbers with each roster row.
4. Import archives stale therapist and lead profiles, excluding the demo manager.
5. Import clears or deactivates stale therapist and lead roster rows not in the new list.

### Status-management workflow

Managers use `/team` to:

- mark `employment_type` as `full_time` or `prn`
- toggle lead eligibility
- optionally adjust shift type and max days/week

This should be available both for individually added roster entries and bulk-imported entries.

### Signup workflow

1. Therapist signs up with real email.
2. Name is normalized and matched to an active roster record.
3. `handle_new_user()` creates the profile from roster metadata.
4. Roster row is linked to the new profile.
5. Therapist signs in normally afterward.

## Error Handling

- Duplicate normalized names in the import source should fail validation with a clear row-level message.
- Phone parsing should be permissive and stored as normalized display text unless the app already enforces a stricter phone format.
- If roster replacement succeeds but profile archival fails, the operation should report partial failure rather than silently continue.
- If a therapist signs up and no roster match exists, current "request access" behavior should remain unchanged.
- If a therapist signs up and multiple possible matches exist, the import must prevent this by enforcing unique normalized names.

## Testing Strategy

### Unit tests

- bulk import parser accepts the therapist source format
- normalized-name deduplication catches collisions
- import mapping defaults `role`, `shift_type`, `employment_type`, `max_work_days_per_week`, and `is_lead_eligible` correctly
- phone parsing and normalization behave predictably

### Integration tests

- roster replacement preserves the demo manager and archives stale therapist/lead profiles
- signup with a matching roster entry creates a profile with roster metadata
- signup with no roster match still lands in the pending request flow
- manager edits to lead eligibility and employment type persist and render correctly

### Manual verification

- import the supplied therapist list through the manager workflow
- confirm `/team` shows only the imported therapist roster plus the demo manager account
- update one therapist to `prn` and one therapist to lead-eligible
- sign up as a therapist with a real email and confirm auto-match succeeds

## Tradeoffs

### Benefits

- aligns with the app's current onboarding architecture
- avoids auth-account migration complexity
- keeps future real-email signup clean
- reuses existing team roster and signup code paths

### Costs

- therapists are not immediately sign-in ready before real signup
- roster import likely needs small schema and UI extensions for phone numbers
- roster replacement needs careful archival logic to avoid touching preserved manager data

## Implementation Notes For Planning

- Prefer extending the existing roster bulk import and roster UI instead of adding a separate therapist import screen.
- Prefer a dedicated server action or script for "replace therapist roster from source list" semantics rather than overloading the current additive bulk import.
- Keep diffs focused on roster import, roster display/editing, signup data propagation, and cleanup/archive behavior.

## Open Decisions Resolved

- Onboarding mode: roster-first, not placeholder-auth-first
- Workforce model: therapist base role with separate lead eligibility and employment type
- Email strategy: real email collected later during signup

## Acceptance Criteria

- A manager can load the supplied therapist list into the app without real email addresses.
- The demo manager remains available after the import.
- Existing non-demo therapist and lead records are removed from active use.
- Each imported therapist can later sign up with a real email and be matched to their preloaded roster entry.
- Managers can indicate whether an imported therapist is `full_time` or `prn`.
- Managers can indicate whether an imported therapist is lead-eligible.
