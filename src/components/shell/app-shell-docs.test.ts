import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('app shell docs', () => {
  it('documents the staff schedule entry as My Shifts', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8')

    expect(readme).toContain('**My Shifts**')
    expect(readme).toContain('staff nav label')
    expect(readme).toContain('**Team Schedule**')
    expect(readme).not.toContain('**Schedule** (nav label')
  })

  it('documents same-day Shift Board changes as manager-phone workflow', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8')
    const workflows = fs.readFileSync(path.join(process.cwd(), 'docs/WORKFLOWS.md'), 'utf8')

    expect(readme).toContain(
      'same-day shift changes are handled by contacting the manager by phone'
    )
    expect(workflows).toContain('Same-day changes are not self-service requests')
    expect(workflows).toContain('staff contact the manager by phone')
  })
})
