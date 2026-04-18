---
name: accurate-commits
description: Accurate Git commits plus optional session handoff—sync with main, stage by intent, verify the index, avoid junk paths, push, and when to update CLAUDE.md or docs before switching chats. Use for commits, PR prep, pre-push, or chat wrap-up / context handoff.
version: 1.1.0
---

# Accurate commits (Teamwise / rt-scheduler)

**Codex copy.** Keep in sync with `.cursor/skills/accurate-commits/SKILL.md` when changing this workflow.

You are guiding a **safe, intentional commit** (or a small series of commits). Do not rush `git add .`.

## When to use

- User is ready to **commit**, **push**, or **open a PR**
- Working tree mixes **several concerns** (UI + config + tests)
- User wants **one commit = one intent**
- User is **switching chats** and wants a clean handoff (memory + docs + git)

## How to invoke (Codex)

- Ask the agent to **read and follow** this file: `.codex/skills/accurate-commits/SKILL.md`
- Or: _“Run the **accurate-commits** skill before I push.”_
- Or: _“**accurate-commits** wrap-up—I’m switching context.”_

## Repo-specific rules

- **Default lint scope** in this project is `eslint src` (see `package.json` / `CLAUDE.md`). If `npm run lint` runs repo-wide `eslint` with no paths, pre-push can crawl **`.next`** / **`.next-dev`** and stall—fix that separately; do not assume a hung push means bad code.
- **SEO / sitemap / proxy allowlist** already landed on `main` in a dedicated commit—do not re-bundle that work unless you are fixing regressions.
- Paths under route groups use parentheses, e.g. `src/app/(public)/...`. **Quote** those paths in the shell so `(public)` is not parsed as a subshell.

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

State: current branch, ahead/behind, and whether there are **untracked** (`??`) trees.

### 2. Exclude junk (do not commit unless explicitly requested)

Treat as **out of scope** unless the user says to version them:

- `.gemini/`, `.kiro/`, `.opencode/`, `.trae/`, `.trae-cn/`, `.pi/`, `.rovodev/`, and similar generated skill/plugin trees
- Ad-hoc `README.txt`, one-off tooling, unless it is real project infrastructure

If they keep appearing: suggest adding patterns to **`.gitignore`** once.

### 3. Sync integration branch with `main` (when preparing a PR or long-lived branch)

```bash
git merge origin/main
# or: git rebase origin/main   (only if the user prefers rebasing; warn that it rewrites history)
```

Resolve conflicts, then run the checks the user cares about (e.g. `npm run lint`, `npm run test:unit`, `npm run build`).

### 4. Slice work: one commit = one intent

Group files by **story** (e.g. “availability panel density”, “team directory filters”, “next dist dir helper”).

For **each** commit:

1. Stage **only** paths for that story:

   ```bash
   git add "src/app/(public)/login/page.tsx" "src/app/(public)/layout.tsx"
   ```

   Use `git add -p` when one file contains **two** stories.

2. **Verify the index** (mandatory):

   ```bash
   git diff --cached --stat
   git diff --cached
   ```

   If anything wrong: `git restore --staged -- <file>` or `git restore --staged -p`.

3. Commit with a **why-first** subject line (this repo often uses **Lore trailers**—see `AGENTS.md`):

   ```bash
   git commit -m "Improve team directory filter stacking on narrow widths" -m "..."
   ```

4. Repeat until `git status` is clean for **intentional** tracked changes.

### 5. Before push

```bash
git log --oneline origin/main..HEAD
```

Confirm the commit list matches what should ship.

```bash
git push -u origin "<branch-name>"
```

If pre-push is slow or ESLint walks build output: recommend fixing `lint` / ignore patterns; **`--no-verify`** is an emergency escape, not the default.

### 6. Session wrap-up (switching chats / handoff)

Run when the user is **closing a session** or **switching threads** so the next chat is not guessing.

**Do not** treat “update docs” as mandatory every time. Only touch project memory when something **actually changed** for the next person or the next model.

| Artifact                          | Update when…                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`CLAUDE.md`**                   | Product behavior, routes, env vars, production URLs, verification commands, or **Handoff Snapshot** facts changed. Keep it **truth**, not a diary. |
| **`docs/SESSION_HISTORY.md`**     | User wants a dated narrative, migration notes, or archaeology the team asked for. Optional for small fixes.                                        |
| **`README.md` / `docs/SETUP.md`** | Onboarding or install steps changed.                                                                                                               |

**Skip `CLAUDE.md`** if the session was only exploratory, typo-level, or the Handoff Snapshot is still accurate.

**Verification before handoff** (match risk—this repo’s usual baseline):

```bash
npm run lint
npm run test:unit
npx tsc --noEmit
npm run build
```

Use a **subset** for tiny changes; full pass before merge or deploy.

**Optional:** If the user uses OMX / session notes, append one line to `.omx/notepad.md` (what shipped, what’s still WIP).

**Git after doc edits:** `CLAUDE.md` / `docs/` edits deserve their **own small commit** (e.g. “Refresh CLAUDE handoff after availability intake changes”)—do not hide doc updates inside unrelated code commits unless the user explicitly wants one squashed commit.

## Agent checklist

- [ ] `git status` reviewed; junk paths not staged
- [ ] `origin/main` merged (or rebase agreed) when integrating
- [ ] Each commit: `git diff --cached` reviewed
- [ ] Commit messages describe **intent**, not only diffs
- [ ] Push / PR scope matches `git log origin/main..HEAD`
- [ ] **Handoff:** `CLAUDE.md` / `docs/` updated only if truth changed; otherwise say “snapshot still accurate”

The agent should **open this file**, then execute the procedure and narrate which step it is on.

**Cursor mirror:** `.cursor/skills/accurate-commits/SKILL.md` — keep both files aligned when editing this workflow.
