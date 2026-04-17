import { describe, expect, it } from 'vitest'

import {
  chunkPrettierTargets,
  parseTrackedFiles,
  selectPrettierCheckTargets,
} from '../../scripts/lib/prettier-check-targets.mjs'

describe('prettier check target selection', () => {
  it('keeps only prettier-compatible tracked files', () => {
    expect(
      selectPrettierCheckTargets([
        'package.json',
        'src/app/layout.tsx',
        'scripts/local-ci-fallback.mjs',
        'docs/SESSION_HISTORY.md',
        'src/app/favicon.ico',
        '.husky/pre-push',
      ])
    ).toEqual([
      'package.json',
      'src/app/layout.tsx',
      'scripts/local-ci-fallback.mjs',
      'docs/SESSION_HISTORY.md',
    ])
  })

  it('parses git ls-files null-separated output', () => {
    expect(parseTrackedFiles('package.json\0src/app/layout.tsx\0\0')).toEqual([
      'package.json',
      'src/app/layout.tsx',
    ])
  })

  it('chunks prettier targets to avoid oversized commands', () => {
    expect(chunkPrettierTargets(['a.ts', 'b.ts', 'c.ts', 'd.ts'], 2)).toEqual([
      ['a.ts', 'b.ts'],
      ['c.ts', 'd.ts'],
    ])
  })
})
