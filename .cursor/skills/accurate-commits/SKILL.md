---
name: accurate-commits
description: Accurate Git commits plus optional session handoff - sync with main, stage by intent, verify the index, avoid junk paths, commit, push by default, and update CLAUDE.md or docs when truth changed before switching chats. Use for commits, PR prep, pre-push, or chat wrap-up / context handoff.
version: 1.1.1
---

# Accurate commits (Teamwise / rt-scheduler)

**Cursor copy.** Codex CLI mirror: `.codex/skills/accurate-commits/SKILL.md` - update both when changing this workflow.

You are guiding a **safe, intentional commit** (or a small series of commits). Do not rush `git add .`.

Default completion behavior: if the user asks to use this skill for a normal ship or wrap-up flow, the skill should aim to **commit and push** after verification. Only stop at a local commit when the user explicitly says **commit only**, **do not push**, or there is a real push blocker.

## When to use

- User is ready to **commit**, **push**, or **open a PR**
- Working tree mixes **several concerns** (UI + config + tests)
- User wants **one commit = one intent**

## Repo-specific rules

- **Default lint scope** in this project is `eslint src` (see `package.json` / `CLAUDE.md`). If `npm run lint` runs repo-wide `eslint` with no paths, pre-push can crawl **`.next`** / **`.next-dev`** and stall - fix that separately; do not assume a hung push means bad code.
- **SEO / sitemap / proxy allowlist** already landed on `main` in a dedicated commit - do not re-bundle that work unless you are fixing regressions.
- Paths under route groups use parentheses, e.g. `src/app/(public)/...`. On **PowerShell**, always **quote** those paths when passing them to `git add`, `git restore`, etc.

## Procedure (follow in order)

### 1. Baseline

```powershell
cd "c:\Users\byonk\OneDrive\Desktop\rt-scheduler"
git status -sb
git fetch origin
```

State: current branch, ahead/behind, and whether there are **untracked** (`??`) trees.

### 2. Exclude junk (do not commit unless explicitly requested)

Treat as **out of scope** unless the user says to version them:

- `.gemini/`, `.kiro/`, `.opencode/`, `.trae/`, `.trae-cn/`, `.pi/`, `.rovodev/`, and similar generated skill/plugin trees
- Ad-hoc `README.txt`, one-off tooling, unless it is real project infrastructure

If they keep appearing: suggest adding patterns to **`.gitignore`** once.

### 3. Sync integration branch with `main` (when preparing a PR or long-lived branch)

```powershell
git merge origin/main
# or: git rebase origin/main   (only if the user prefers rebasing; warn that it rewrites history)
```

Resolve conflicts, then run the checks the user cares about (e.g. `npm run lint`, `npm run test:unit`, `npm run build` - match their patience and risk).

### 4. Slice work: one commit = one intent

Group files by **story** (e.g. "availability panel density", "team directory filters", "next dist dir helper").

For **each** commit:

1. Stage **only** paths for that story:

   ```powershell
   git add "path/to/file.tsx" "path/to/other.ts"
   ```

   Use `git add -p` when one file contains **two** stories.

2. **Verify the index** (mandatory):

   ```powershell
   git diff --cached --stat
   git diff --cached
   ```

   If anything wrong: `git restore --staged <file>` or `git restore --staged -p`.

3. Commit with a **why-first** subject line (this repo often uses **Lore trailers** - see `AGENTS.md`):

   ```powershell
   git commit -m "Improve team directory filter stacking on narrow widths" -m "..."
   ```

4. Repeat until `git status` is clean for **intentional** tracked changes.

### 5. Push is part of done

After the intended commit set is complete and verification passed, **push by default** unless the user explicitly asked to stop at a local commit.

```powershell
git log --oneline origin/main..HEAD
```

Confirm the commit list matches what should ship.

```powershell
git push -u origin <branch-name>
```

If pre-push is slow or ESLint walks build output: recommend fixing `lint` / ignore patterns; **`--no-verify`** is an emergency escape, not the default.
If push fails because of auth, remote protection, or network issues: report the blocker clearly and stop there rather than pretending the workflow is complete.

### 6. Session wrap-up (switching chats / handoff)

Run this block **when the user is closing a session** or **switching threads** so the next chat is not guessing.

**Do not** treat "update docs" as mandatory every time. Only touch project memory when something **actually changed** for the next person or the next model.

| Artifact                          | Update when...                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`CLAUDE.md`**                   | Product behavior, routes, env vars, production URLs, verification commands, or **Handoff Snapshot** facts changed. Keep it **truth**, not a diary. |
| **`docs/SESSION_HISTORY.md`**     | User wants a dated narrative, migration notes, or archaeology the team asked for. Optional for small fixes.                                        |
| **`README.md` / `docs/SETUP.md`** | Onboarding or install steps changed.                                                                                                               |

**Skip `CLAUDE.md`** if the session was only exploratory, typo-level, or the Handoff Snapshot is still accurate.

**Verification before handoff** (pick what matches risk - this repo's usual baseline):

```powershell
npm run lint
npm run test:unit
npx tsc --noEmit
npm run build
```

Use a **subset** for tiny changes; full pass before merge or deploy.

**Optional:** If the user uses OMX / session notes, append one line to `.omx/notepad.md` (what shipped, what's still WIP).

**Git after doc edits:** `CLAUDE.md` / `docs/` edits deserve their **own small commit** (e.g. "Refresh CLAUDE handoff after availability intake changes") - do not hide doc updates inside unrelated code commits unless the user explicitly wants one squashed commit.

## Agent checklist (copy for the assistant)

- [ ] `git status` reviewed; junk paths not staged
- [ ] `origin/main` merged (or rebase agreed) when integrating
- [ ] Each commit: `git diff --cached` reviewed
- [ ] Commit messages describe **intent**, not only diffs
- [ ] Local verification completed before push (match risk)
- [ ] Push / PR scope matches `git log origin/main..HEAD`
- [ ] **Handoff:** `CLAUDE.md` / `docs/` updated only if truth changed; otherwise say "snapshot still accurate"

## Invocation hints for the user

In Cursor, reference this skill when starting a commit session, for example:

- "Run **accurate-commits** before I push."
- "Use **@accurate-commits** and help me split this into two commits."
- "**accurate-commits** wrap-up - I'm switching chats; update memory if needed."

The agent should **open this file**, then execute the procedure and narrate which step it is on.
