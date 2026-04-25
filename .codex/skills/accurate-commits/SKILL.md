---
name: accurate-commits
description: Accurate Git commits plus optional session handoff. Sync with main, stage by intent, verify the index, avoid junk paths, push safely, and when requested land the branch by merging it into main. Use for commits, PR prep, pre-push, landing work, or chat wrap-up and handoff.
version: 1.2.0
---

# Accurate commits (Teamwise / rt-scheduler)

**Codex copy.** Keep in sync with `.cursor/skills/accurate-commits/SKILL.md` when changing this workflow.

Guide a safe, intentional commit or a small series of commits. Do not rush `git add .`.

## When to use

- User is ready to `commit`, `push`, `open a PR`, or `merge to main`
- Working tree mixes several concerns (UI + config + tests)
- User wants one commit = one intent
- User is switching chats and wants a clean handoff (memory + docs + git)

## How to invoke (Codex)

- Ask the agent to read and follow `.codex/skills/accurate-commits/SKILL.md`
- Or: `Run the accurate-commits skill before I push.`
- Or: `accurate-commits wrap-up - I'm switching context.`

## Repo-specific rules

- Default lint scope in this project is `eslint src` (see `package.json` / `CLAUDE.md`). If `npm run lint` runs repo-wide `eslint` with no paths, pre-push can crawl `.next` / `.next-dev` and stall. Fix that separately; do not assume a hung push means bad code.
- SEO / sitemap / proxy allowlist already landed on `main` in a dedicated commit. Do not re-bundle that work unless you are fixing regressions.
- Paths under route groups use parentheses, for example `src/app/(public)/...`. Quote those paths in the shell so `(public)` is not parsed as a subshell.

## Decide the landing target first

Pick one mode before making git moves:

- `branch-only`: commit and push the feature branch, or prepare a PR
- `land-on-main`: finish the branch work and merge it into `main`

If the user explicitly asks to merge, land, ship, or "make sure it gets to main", use `land-on-main`.
If the user only asked for a commit, push, or PR, stay in `branch-only`.

## Procedure (follow in order)

### 1. Baseline

**bash / zsh**

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
git status -sb
git fetch origin
```

**PowerShell (Windows)**

```powershell
cd "c:\Users\byonk\OneDrive\Desktop\rt-scheduler"
git status -sb
git fetch origin
```

State: current branch, ahead/behind, and whether there are untracked (`??`) trees.

### 2. Exclude junk (do not commit unless explicitly requested)

Treat as out of scope unless the user says to version them:

- `.gemini/`, `.kiro/`, `.opencode/`, `.trae/`, `.trae-cn/`, `.pi/`, `.rovodev/`, and similar generated skill/plugin trees
- Ad-hoc `README.txt`, one-off tooling, unless it is real project infrastructure

If they keep appearing: suggest adding patterns to `.gitignore` once.

### 3. Sync the working branch with `main`

```bash
git merge origin/main
# or: git rebase origin/main   (only if the user prefers rebasing; warn that it rewrites history)
```

Resolve conflicts, then run the checks the user cares about (for example `npm run lint`, `npm run test:unit`, `npm run build`).

### 4. Slice work: one commit = one intent

Group files by story (for example "availability panel density", "team directory filters", "next dist dir helper").

For each commit:

1. Stage only paths for that story:

   ```bash
   git add "src/app/(public)/login/page.tsx" "src/app/(public)/layout.tsx"
   ```

   Use `git add -p` when one file contains two stories.

2. Verify the index:

   ```bash
   git diff --cached --stat
   git diff --cached
   ```

   If anything is wrong: `git restore --staged -- <file>` or `git restore --staged -p`.

3. Commit with a why-first subject line. This repo often uses Lore trailers; see `AGENTS.md`.

   ```bash
   git commit -m "Improve team directory filter stacking on narrow widths" -m "..."
   ```

4. Repeat until `git status` is clean for intentional tracked changes.

### 5. Verify branch scope before any push or merge

```bash
git log --oneline origin/main..HEAD
```

Confirm the commit list matches what should ship.

### 6. Choose the finish path

#### Path A: branch-only

Use this when the user wants a commit, push, or PR but did not ask to land directly on `main`.

```bash
git push -u origin "<branch-name>"
```

If pre-push is slow or ESLint walks build output: recommend fixing `lint` / ignore patterns. `--no-verify` is an emergency escape, not the default.

#### Path B: land-on-main

Use this when the user asked to merge to `main`, land the work, or otherwise complete integration.

1. Make sure branch verification already passed.
2. Switch to `main` and fast-forward it:

   ```bash
   git checkout main
   git pull --ff-only origin main
   ```

3. Merge the working branch into `main`:

   ```bash
   git merge --no-ff "<branch-name>"
   ```

   If the repo or user prefers fast-forward-only and the history allows it, `git merge --ff-only "<branch-name>"` is also fine.

4. Re-run the appropriate verification on `main`. Full pass before merge or deploy is preferred:

   ```bash
   npm run lint
   npm run test:unit
   npx tsc --noEmit
   npm run build
   ```

5. Push `main`:

   ```bash
   git push origin main
   ```

6. Only after the push succeeds, say the work is merged to `main`.

### 6A. If GitHub says the merge failed, correct the blocker instead of stopping

Treat a GitHub merge failure as a diagnosis-and-fix loop, not as the end of the workflow.

1. Identify the actual blocker first:

   ```bash
   gh auth status
   gh pr view <number> --json state,isDraft,mergeable,mergeStateStatus,reviewDecision,url
   gh pr checks <number>
   ```

2. Fix the class of problem GitHub is reporting:

- If the branch is behind `main`, sync it with `origin/main`, resolve conflicts, rerun verification, and push the updated branch.
- If required checks failed, inspect the failing GitHub Actions logs, fix the real code or config problem, rerun verification locally, then push.
- If the PR is still draft, mark it ready. If the GitHub connector path is flaky, prefer `gh pr ready <number>`, then re-fetch once or twice before assuming it failed.
- If mergeability is blocked by conflicts, resolve the conflicts locally on the branch instead of trying to force the merge in GitHub.
- If GitHub reports branch protection, missing approvals, merge queue requirements, or missing permissions, fix what is within repo control and escalate only the remaining policy or access gate.

3. After each fix, re-check the PR state:

   ```bash
   gh pr view <number> --json isDraft,mergeable,mergeStateStatus,reviewDecision,url
   gh pr checks <number>
   ```

4. Continue until the PR is mergeable or until the only remaining blocker is missing authority outside the agent's control.

5. Do not report "GitHub merge failed" without naming the concrete blocker and the attempted remediation.

### 7. Session wrap-up (switching chats / handoff)

Run when the user is closing a session or switching threads so the next chat is not guessing.

Do not treat "update docs" as mandatory every time. Only touch project memory when something actually changed for the next person or the next model.

| Artifact                      | Update when...                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`                   | Product behavior, routes, env vars, production URLs, verification commands, or Handoff Snapshot facts changed. Keep it truth, not a diary. |
| `docs/SESSION_HISTORY.md`     | User wants a dated narrative, migration notes, or archaeology the team asked for. Optional for small fixes.                                |
| `README.md` / `docs/SETUP.md` | Onboarding or install steps changed.                                                                                                       |

Skip `CLAUDE.md` if the session was only exploratory, typo-level, or the Handoff Snapshot is still accurate.

Verification before handoff should match risk:

```bash
npm run lint
npm run test:unit
npx tsc --noEmit
npm run build
```

Use a subset for tiny changes; full pass before merge or deploy.

Optional: if the user uses OMX or session notes, append one line to `.omx/notepad.md` (what shipped, what is still WIP).

Git after doc edits: `CLAUDE.md` / `docs/` edits deserve their own small commit (for example "Refresh CLAUDE handoff after availability intake changes"). Do not hide doc updates inside unrelated code commits unless the user explicitly wants one squashed commit.

## Agent checklist

- [ ] `git status` reviewed; junk paths not staged
- [ ] `origin/main` merged into the working branch (or rebase agreed) before finalizing
- [ ] Each commit: `git diff --cached` reviewed
- [ ] Commit messages describe intent, not only diffs
- [ ] Branch scope matches `git log origin/main..HEAD`
- [ ] If `land-on-main`: branch merged into `main`, verification rerun on `main`, and `git push origin main` succeeded
- [ ] If GitHub merge failed at any point: concrete blocker identified, fix attempted, and PR state re-checked
- [ ] Handoff: `CLAUDE.md` / `docs/` updated only if truth changed; otherwise say "snapshot still accurate"

Open this file, then execute the procedure and narrate which step you are on.

**Cursor mirror:** `.cursor/skills/accurate-commits/SKILL.md` - keep both files aligned when editing this workflow.
