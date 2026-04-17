# Security

## RBAC

Role and permission checks are centralized in:

- `src/lib/auth/roles.ts`
- `src/lib/auth/can.ts`

Use `can(role, permission, context?)` for both UI gating and server-side authorization.

### Role-Permission Matrix

| Permission                 | manager | therapist | staff | lead |
| -------------------------- | ------- | --------- | ----- | ---- |
| `access_manager_ui`        | ✅      | ❌        | ❌    | ❌   |
| `manage_schedule`          | ✅      | ❌        | ❌    | ❌   |
| `manage_coverage`          | ✅      | ❌        | ❌    | ❌   |
| `manage_publish`           | ✅      | ❌        | ❌    | ❌   |
| `manage_directory`         | ✅      | ❌        | ❌    | ❌   |
| `review_shift_posts`       | ✅      | ❌        | ❌    | ❌   |
| `export_all_availability`  | ✅      | ❌        | ❌    | ❌   |
| `update_assignment_status` | ✅      | ❌\*      | ❌\*  | ✅   |

\* `therapist`/`staff` can update assignment status only when `isLeadEligible === true` is provided in permission context.

## Mutation Boundaries

- Scheduling mutation APIs enforce both role checks and trusted-request origin checks before touching data.
- Trusted local development aliases (`localhost`, `127.0.0.1`, `[::1]`) are normalized together so the same protections work across loopback variants.
- Coverage post-publish audit events are now derived on the server from slot state:
  - past-date edits always audit
  - future-slot edits audit when the slot already has an active operational entry
  - client callers cannot force or suppress that audit path with request-body flags

## Signup And Onboarding Trust

- Public signup must never read private roster state from a browser-reachable surface.
- `employee_roster` remains the trusted source for preloading staffing defaults before a user has signed up.
- `public.handle_new_user()` may copy `role`, `shift_type`, employment settings, and lead eligibility from a matched `employee_roster` row.
- `public.handle_new_user()` must not trust `raw_user_meta_data.role` from self-signup traffic. If there is no roster match, the new profile must stay pending with `profiles.role = null`.

## Inbound Availability Intake

- Resend webhook signature validation proves only that the request came from Resend, not that the sender is authorized to mutate staffing data.
- High-confidence intake rows auto-apply only when the Resend sender email matches the matched therapist `profiles.email`.
- When sender identity does not match, intake rows stay in `needs_review` and surface a confidence reason instead of writing `availability_overrides`.

## Session Boundaries

- `POST /auth/signout` requires a trusted mutation origin.
- `GET /auth/signout` is restricted to same-origin or same-site navigation contexts and rejects cross-site requests before touching Supabase auth cookies.

## Dependency Posture

- Local lockfile patched on April 11, 2026 to `next@16.2.3` after clearing the high-severity Server Components DoS advisory reported by `npm audit`.
