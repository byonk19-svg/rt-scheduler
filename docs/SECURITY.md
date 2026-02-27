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
