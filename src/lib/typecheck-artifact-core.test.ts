import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveTypecheckArtifactTargets } from '../../scripts/lib/typecheck-artifact-core.mjs'

describe('resolveTypecheckArtifactTargets', () => {
  it('includes the repo tsBuildInfo file and the legacy root fallback', () => {
    const repoRootPath = 'C:/repo/rt-scheduler'
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')

    expect(
      resolveTypecheckArtifactTargets({
        repoRootPath,
        tsconfigPath,
      }).map((candidate) => candidate.replace(/\\/g, '/'))
    ).toEqual([
      'C:/repo/rt-scheduler/.next/cache/typescript/tsconfig.tsbuildinfo',
      'C:/repo/rt-scheduler/tsconfig.tsbuildinfo',
    ])
  })

  it('drops unsafe tsBuildInfo paths that resolve outside the repo root', () => {
    const repoRootPath = 'C:/repo/rt-scheduler'
    const tsconfigPath = path.join(process.cwd(), 'src/lib/fixtures/unsafe-typecheck-tsconfig.json')

    expect(
      resolveTypecheckArtifactTargets({
        repoRootPath,
        tsconfigPath,
      }).map((candidate) => candidate.replace(/\\/g, '/'))
    ).toEqual(['C:/repo/rt-scheduler/tsconfig.tsbuildinfo'])
  })
})
