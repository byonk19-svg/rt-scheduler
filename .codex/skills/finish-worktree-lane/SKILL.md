---
name: finish-worktree-lane
description: Finish a completed rt-scheduler worktree lane by attaching detached work to a branch, staging by intent, committing with Lore trailers, pushing, opening or merging the PR, and cleaning up the worktree and branch when GitHub is done. Use when work in a Codex or git worktree is complete and the user wants the whole lane wrapped up.
version: 1.0.0
---

# Finish worktree lane (Teamwise / rt-scheduler)

**Codex copy.** Keep in sync with `.cursor/skills/finish-worktree-lane/SKILL.md` when changing this workflow.

Use this when implementation is done inside a repo worktree and the user wants the lane fully wrapped up, not just locally committed.

## When to use

- The current checkout is a git worktree or Codex worktree
- `git status` is clean enough to stage one focused intent
- The user wants branch creation, commit, push, PR, merge, or worktree cleanup
- The current checkout may be in detached `HEAD`

## Repo-specific assumptions

- This repo often runs inside detached Codex worktrees under `C:\Users\byonk\.codex\worktrees\...`
- The main long-lived checkout often lives at `C:\dev\rt-scheduler-off-onedrive`
- Pre-push runs `npm run ci:local:quick`
- Lore trailers in commit messages are expected; see `AGENTS.md`

## Finish mode

Pick one before touching git:

- `branch-only`: create branch, commit, push, and optionally open a PR
- `land-and-cleanup`: get the work merged to `main`, then remove the lane branch and worktree

If the user says "do all of this", "finish it", "wrap it up", or asks what to do with the worktree now that the work is done, default to `land-and-cleanup`.

## Procedure

### 1. Baseline the lane

From the current worktree:

```powershell
git status --short --branch
git branch --show-current
git log --oneline --decorate -1
git fetch origin
```

Confirm:

- whether the checkout is detached
- which files belong to the intended story
- whether GitHub auth is available if PR work is needed

### 2. Attach detached work to a branch

If `git branch --show-current` is empty:

```powershell
git switch -c codex/<lane-name>
```

If the branch already exists locally but the worktree is detached:

```powershell
git switch <branch-name>
```

Use `codex/` by default unless the user asked for another prefix.

### 3. Stage only the lane intent

Do not `git add .` by reflex.

```powershell
git add <intent-scoped paths>
git diff --cached --stat
git diff --cached
```

If tracked generated noise should be deleted as part of the lane, stage the deletions explicitly too.

### 4. Commit cleanly

Write a why-first subject and include Lore trailers.

```powershell
git commit -m "<why this lane exists>" -m "<context + trailers>"
```

After commit:

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
```

The branch should be clean and the commit list should match only what should ship.

### 5. Push the branch

```powershell
git push -u origin <branch-name>
```

Let the repo hook run by default. If the push fails, name the concrete blocker before changing strategy.

### 6. Open the PR

If no PR exists yet:

```powershell
gh pr create --base main --head <branch-name> --title "<title>" --body "<summary + verification>"
```

Then inspect state:

```powershell
gh pr view <number> --json state,isDraft,mergeable,mergeStateStatus,reviewDecision,url
gh pr checks <number>
```

### 7. Land the work when requested

For `land-and-cleanup`, prefer GitHub merge flow over local merge when the PR is already open:

```powershell
gh pr merge <number> --merge --auto
```

Re-check until one of these is true:

- PR is already `MERGED`
- PR is `MERGEABLE` and auto-merge is enabled
- the only remaining blocker is outside repo control

If checks fail, fix the real blocker, push again, and re-check PR state.

### 8. Clean up the branch and worktree after merge

First confirm merge:

```powershell
gh pr view <number> --json state,mergedAt,url
```

Then clean up from a stable checkout, usually `C:\dev\rt-scheduler-off-onedrive`:

```powershell
git -C C:\dev\rt-scheduler-off-onedrive branch -d <branch-name>
git -C C:\dev\rt-scheduler-off-onedrive push --no-verify origin --delete <branch-name>
git -C C:\dev\rt-scheduler-off-onedrive worktree remove <worktree-path>
```

## Important edge cases

- A live Codex session rooted inside the worktree can keep Windows file handles open. If `worktree remove` says `Permission denied` but `git worktree list` no longer shows the path, the Git-side cleanup is done; delete the leftover directory after closing the session.
- Remote branch deletion can trip the repo pre-push hook on unrelated files in the stable checkout. If the branch is already merged and the only failure is an unrelated hook blocker, use `git push --no-verify origin --delete <branch-name>` from the stable checkout.
- If the current worktree stops being a git repo after `worktree remove`, switch all remaining cleanup commands to the stable checkout.

## Output checklist

- branch name created or reused
- commit hash
- push result
- PR URL
- merged or pending state
- whether local branch, remote branch, and worktree were removed
- any leftover manual cleanup, usually only a locked directory after the thread closes
