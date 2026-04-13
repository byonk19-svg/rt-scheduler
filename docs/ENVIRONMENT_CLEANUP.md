# Environment Cleanup

Use the cleanup path that matches the type of account you are removing.

## Real Staff

- Use `/team` to mark the person inactive first.
- Archive them only after they are inactive.
- This preserves history while removing them from the active roster and sign-in access.

## Pending Signups

- Use `/requests/user-access` and decline the request.
- That path deletes the pending auth account instead of merely hiding the profile.

## Seeded or Demo Accounts

The repo now includes a dedicated cleanup command for seeded auth users and their cascaded profile/schedule data.

Dry run:

```bash
npm run cleanup:seed-users
```

Delete the matched seeded/demo users:

```bash
npm run cleanup:seed-users -- --execute
```

Default match rules are intentionally narrow:

- domain: `teamwise.test`
- prefixes: `demo-manager`, `demo-lead-`, `demo-therapist`, `employee`
- exact email: `manager@teamwise.test`

Optional overrides:

- `--domain=<domain1,domain2>`
- `--prefix=<prefix1,prefix2>`
- `--email=<email1,email2>`
- env: `CLEANUP_ALLOWED_DOMAINS`, `CLEANUP_EMAIL_PREFIXES`, `CLEANUP_EXACT_EMAILS`

Do not use the seeded-user cleanup command for real staff accounts. It performs hard deletion through Supabase Auth, which cascades into `profiles` and related scheduling data.
