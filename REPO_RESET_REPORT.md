# Repo Reset Report

- Repo name: rt-scheduler
- Status: Improved
- Purpose: Respiratory therapy scheduling system with manager workflows, staff schedule views, pickup queues, direct requests, approvals, and Supabase-backed lifecycle logic.
- Main language/framework: TypeScript, Next.js App Router, Supabase, Vitest, Playwright
- Package manager: npm
- Setup command: `npm install`, then configure `.env.local` from `.env.example`
- Current branch: `codex/repo-reset`

## Commands Run

- `git fetch origin` - passed
- `git merge --ff-only origin/main` - passed; local branch was behind current `origin/main`
- `npm install` - passed, 8 vulnerabilities reported
- `npm run test:unit` - parallel unit tests passed; browser-backed subset initially timed out under parallel repo load and passed on focused rerun
- `npm run lint` - passed after sync
- `npm run build` - initial run collided with an active Next build lock; passed on sequential rerun

## Files Changed

- `REPO_RESET_REPORT.md`

## What Was Fixed

- No code fixes were needed. The earlier failures were verification-environment issues: a browser-backed test timeout under parallel load and a concurrent Next build lock.

## Remaining Issues

- Pre-existing untracked `reports/` remains untouched.
- `npm install` reports 8 vulnerabilities. No dependency upgrade was made during this safe reset pass.
- `C:\dev\rt-scheduler-off-onedrive` and `C:\dev\rt-scheduler-off-onedrive-commit` are duplicate/linked checkouts of the same upstream scheduling project; both were inspected, but only this canonical repo should own the pushed `codex/repo-reset` branch to avoid branch-name collisions.

## Recommended Next 3 Actions

1. Decide whether the untracked `reports/` directory should be archived, ignored, or removed.
2. Review audit findings separately from this reset branch.
3. Keep using the off-OneDrive checkout for feature work only when its branch target is intentionally separate from canonical `main`.
