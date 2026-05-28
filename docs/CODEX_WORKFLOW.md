# Codex Workflow

This file captures the repo-local defaults that make Codex sessions faster and safer. It complements `AGENTS.md`; it does not replace code review or normal verification.

## Command Map

- `npm run verify:quick -- --skip-cleanup`: fast local gate for docs, config, and small script changes when deleting generated artifacts would interrupt a running dev server.
- `npm run verify:quick`: pre-push-equivalent local gate. It may clean generated local artifacts before checking format, lint, and build.
- `npm run verify:full`: full local fallback gate from `scripts/local-ci-fallback.mjs`.
- `npm run verify:e2e`: local E2E-oriented fallback gate.
- `npm run test:unit`: unit and integration-style Vitest coverage.
- `npm run test:e2e -- <spec>`: focused Playwright verification.
- `npm run cleanup:local -- --execute`: explicit generated-artifact cleanup. Review the printed plan before using it around a live dev server.

## Search And Audit Hygiene

Prefer tracked-file and ripgrep workflows:

```powershell
git ls-files
rg -n "pattern" --glob "!node_modules/**" --glob "!.next/**"
```

Avoid broad recursive scans through `.claude/`, `.codex/` non-skills, `.omx/`, `.worktrees/`, `.next/`, `node_modules/`, screenshots, and logs. These paths are local, generated, or high-noise, and they can hide stale worktrees or large generated output.

## Privacy And Local Artifacts

Do not commit private chat transcripts, secrets, credentials, tokens, local screenshots, or browser/session logs. Summarize and redact sensitive material in audit documents.

Known local visual-audit artifacts are ignored in `.gitignore`; they are not deleted automatically. Cleanup scripts should stay deterministic and generated-artifact-only unless a future change adds tests and a clear opt-in path.

## Hooks

No Codex hooks are enabled by this workflow pass. Future hook candidates should be transparent, documented, and easy to disable:

- Warn before dangerous shell commands that delete or reset repository state.
- Add workflow context for common scheduling, pickup, direct-request, and manager-approval prompts.
- Remind Codex to run verification when code changed and no tests were observed.

To disable future Codex hooks, remove or rename `.codex/hooks.json`. Hook scripts should live under `.codex/hooks/` and must not auto-commit, delete files, send code or chats to third-party services, or weaken test/security gates.
