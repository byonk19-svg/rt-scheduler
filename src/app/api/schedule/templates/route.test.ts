import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('schedule templates API source contract', () => {
  it('supports GET/POST and uses manager auth plus serializeCycleShifts', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/templates/route.ts'),
      'utf8'
    )

    expect(source).toContain('export async function GET')
    expect(source).toContain('export async function POST')
    expect(source).toContain('serializeCycleShifts')
    expect(source).toContain("from('cycle_templates')")
    expect(source).toContain('created_by: user.id')
  })

  it('supports deleting a template by id', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/templates/[id]/route.ts'),
      'utf8'
    )

    expect(source).toContain('export async function DELETE')
    expect(source).toContain("from('cycle_templates')")
  })
})
