import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ImportWizard } from '@/components/team/ImportWizard'

describe('ImportWizard', () => {
  it('renders a calm checklist before any roster import can run', () => {
    const html = renderToStaticMarkup(
      createElement(ImportWizard, {
        bulkImportRosterAction: async () => {},
      })
    )

    expect(html).toContain('Roster import checklist')
    expect(html).toContain('Move one step at a time. Nothing imports until the final button.')
    expect(html).toContain('Choose file')
    expect(html).toContain('Match columns')
    expect(html).toContain('Review rows')
    expect(html).toContain('Apply import')
  })
})
