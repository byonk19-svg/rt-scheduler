import { describe, expect, it } from 'vitest'

import { buildLocalArtifactCleanupPlan } from '../../scripts/lib/local-artifact-cleanup-core.mjs'

describe('buildLocalArtifactCleanupPlan', () => {
  it('collects generated directories, temp files, and unregistered worktree helpers', () => {
    const buildPlan = buildLocalArtifactCleanupPlan as unknown as (args: {
      rootEntries: Array<{ name: string; kind: 'directory' | 'file' }>
      worktreeHelperPaths: string[]
      registeredWorktreePaths: string[]
    }) => {
      directories: string[]
      files: string[]
      staleWorktrees: string[]
      targets: string[]
    }

    const planInput = {
      rootEntries: [
        { name: '.next', kind: 'directory' as const },
        { name: '.tmp', kind: 'directory' as const },
        { name: 'artifacts', kind: 'directory' as const },
        { name: 'src', kind: 'directory' as const },
        { name: '.tmp-ci-quick.log', kind: 'file' as const },
        { name: '.codex-dev.err.log', kind: 'file' as const },
        { name: 'tsconfig.tsbuildinfo', kind: 'file' as const },
        { name: 'package.json', kind: 'file' as const },
      ],
      worktreeHelperPaths: ['.worktrees/active-lane', '.worktrees/stale-lane'],
      registeredWorktreePaths: ['.worktrees/active-lane'],
    }

    expect(buildPlan(planInput)).toEqual({
      directories: ['.next', '.tmp', 'artifacts'],
      files: ['.codex-dev.err.log', '.tmp-ci-quick.log', 'tsconfig.tsbuildinfo'],
      staleWorktrees: ['.worktrees/stale-lane'],
      targets: [
        '.next',
        '.tmp',
        'artifacts',
        '.codex-dev.err.log',
        '.tmp-ci-quick.log',
        'tsconfig.tsbuildinfo',
        '.worktrees/stale-lane',
      ],
    })
  })
})
