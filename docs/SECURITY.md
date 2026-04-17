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
| `update_assignment_status` | ✅      | ❌        | ❌    | ✅   |

\* Assignment-status updates are role-based: only `manager` and `lead` are authorized by `src/lib/auth/can.ts`.

## Mutation Boundaries

- Scheduling mutation APIs enforce both role checks and trusted-request origin checks before touching data.
- Logout now follows the same trusted-origin rule on both `GET /auth/signout` and `POST /auth/signout`. Keep app signout UI on POST forms; the GET path exists only for same-origin cleanup/redirect flows.
- Trusted local development aliases (`localhost`, `127.0.0.1`, `[::1]`) are normalized together so the same protections work across loopback variants.
- Coverage post-publish audit events are now derived on the server from slot state:
  - past-date edits always audit
  - future-slot edits audit when the slot already has an active operational entry
  - client callers cannot force or suppress that audit path with request-body flags

## Public Access Boundaries

- Public signup must not expose whether a submitted full name matches `employee_roster`. The server-side roster auto-match still happens inside `handle_new_user`, but `/signup` now always redirects to the generic `/login?status=requested` path instead of returning match state to the browser.
- Avoid exposing service-role backed yes/no existence checks through public server actions. If a roster or directory match is needed for internal workflows, keep that logic on the server and return generic public UX copy.

## Dependency Posture

- Local lockfile patched on April 11, 2026 to `next@16.2.3` after clearing the high-severity Server Components DoS advisory reported by `npm audit`.
