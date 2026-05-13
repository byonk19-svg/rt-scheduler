import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('PublishedSchedulePage source contract', () => {
  it('passes a stable today value into the client calendar', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/schedule/PublishedSchedulePage.tsx'),
      'utf8'
    )

    expect(source).toContain('const todayIso = toIsoDate(new Date())')
    expect(source).toContain('todayIso={todayIso}')
    expect(source).not.toContain('todayIso={toIsoDate(new Date())}')
  })
})
