# Codex Workflow Audit

Date: 2026-05-28

## Scope

This audit inspected repo-local workflow inputs only: `AGENTS.md`, `README.md`, `package.json`, `.github/workflows/ci.yml`, `.husky/`, selected scripts under `scripts/`, `.gitignore`, `.prettierignore`, `.codex/`, `.claude/`, `.omx/notepad.md`, recent git history, and repo-authored docs.

No `chats/`, `codex-transcripts/`, or `docs/conversations/` directories were present. Sensitive chat-like or local-history material was summarized only; no private transcript excerpts, secrets, tokens, credentials, or long conversation content are copied here.

## Recurring Friction Points

| Opportunity                                                                                                              | Category                          | Evidence summary                                                                                                                                                                       | Expected time saved             | Risk   | Complexity | Likely files                                 | Verification                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------ | ---------- | -------------------------------------------- | --------------------------------------------- |
| Add a concise Codex quick reference for commands, Windows lock pitfalls, search hygiene, privacy, and artifact handling. | AGENTS.md guidance, documentation | The root `AGENTS.md` is comprehensive but long; common facts are buried across `README.md`, `CLAUDE.md`, scripts, and local notes.                                                     | 5-15 minutes per session        | Low    | Low        | `AGENTS.md`, `docs/CODEX_WORKFLOW.md`        | Readability review, formatter check           |
| Add simple verification aliases that wrap existing local CI commands.                                                    | Repo script                       | Existing scripts already define `ci:local`, `ci:local:quick`, and `ci:local:e2e`; agents still have to rediscover which one maps to the current task.                                  | 2-5 minutes per change          | Low    | Low        | `package.json`                               | Run the alias with a non-destructive option   |
| Ignore known local screenshot/log artifacts produced during visual critique and browser sessions.                        | Documentation, repo config        | Current status showed local untracked files such as critique screenshots and login screenshots. These are not production assets and create commit noise.                               | 1-3 minutes per commit          | Low    | Low        | `.gitignore`                                 | `git status -sb` shows only intentional files |
| Document tracked-file search habits and generated-directory exclusions.                                                  | AGENTS.md guidance, documentation | Recursive scans can wander into `.claude/`, `.worktrees/`, `.next/`, `node_modules/`, and generated artifacts. `rg` and `git ls-files` are more deterministic.                         | 5-20 minutes during audits      | Low    | Low        | `AGENTS.md`, `docs/CODEX_WORKFLOW.md`        | Manual review                                 |
| Defer Codex hooks until the hook schema and runtime behavior are validated in this repo.                                 | Codex hook                        | Good candidates exist, but undocumented or wrong hooks would be worse than guidance. Existing Claude hooks already cover environment-file blocking and formatting for Claude sessions. | Future: 1-5 minutes per session | Medium | Medium     | Future `.codex/hooks.json`, `.codex/hooks/*` | Hook dry-run plus disable-path test           |
| Add a local workflow doc that states which checks to run for docs-only, UI, data-lifecycle, and release-like changes.    | Documentation                     | Verification expectations are spread across README, AGENTS, CI config, Husky, and scripts.                                                                                             | 3-10 minutes per session        | Low    | Low        | `docs/CODEX_WORKFLOW.md`                     | Formatter check                               |
| Keep cleanup automation deterministic and opt-in.                                                                        | Repo script                       | `cleanup:local` already deletes only known generated targets. Expanding deletion to screenshots/logs would be riskier than ignoring local files.                                       | Avoids mistakes                 | Low    | Low        | No cleanup change recommended                | Existing cleanup tests/scripts                |

## Ranked Top 5

1. Concise `AGENTS.md` quick reference plus `docs/CODEX_WORKFLOW.md`.
2. Verification aliases for existing CI scripts.
3. Narrow `.gitignore` entries for observed local visual-audit artifacts.
4. Tracked-file search and generated-directory guidance.
5. Documented future hook candidates, without enabling hooks yet.

## Implementation Decision

Low-risk, high-value changes are appropriate now:

- Add a short `AGENTS.md` quick reference.
- Add `verify:quick`, `verify:full`, and `verify:e2e` script aliases that wrap existing commands.
- Ignore the observed local visual-audit artifacts without changing cleanup/deletion behavior.
- Add `docs/CODEX_WORKFLOW.md` to make the command map and privacy rules easy to find.

Codex hooks are not implemented in this pass. The hook candidates are useful, but they need a verified local hook schema and a disable-path test before they should affect future sessions.
