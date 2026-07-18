import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const actionsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/preliminary/actions.ts'),
  'utf8'
)
const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/preliminary/page.tsx'),
  'utf8'
)

describe('preliminary mark feedback', () => {
  it('maps resolved repeat marks to clear manager-contact guidance', () => {
    expect(actionsSource).toContain('preliminary_mark_already_resolved')
    expect(actionsSource).toContain('manager already resolved this preliminary mark')
    expect(pageSource).toContain('A manager already resolved that preliminary pencil mark')
    expect(pageSource).toContain('Contact the manager if something changed')
  })
})
