import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/dashboard/manager/loading.tsx'),
  'utf8'
)

describe('manager dashboard loading state', () => {
  it('uses structured skeleton blocks instead of plain empty panels', () => {
    expect(source).toContain('MetricTileSkeleton')
    expect(source).toContain('SurfaceCardSkeleton')
    expect(source).toContain('shadow-tw-inbox-hero')
    expect(source).toContain('shadow-tw-panel')
    expect(source).toContain('SkeletonLine')
  })
})
