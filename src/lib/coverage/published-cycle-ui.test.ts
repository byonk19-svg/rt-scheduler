import { describe, expect, it } from 'vitest'

import { getPublishedCoverageBannerContent } from '@/lib/coverage/published-cycle-ui'

describe('getPublishedCoverageBannerContent', () => {
  it('describes published coverage as live-editable for managers', () => {
    const banner = getPublishedCoverageBannerContent()

    expect(banner.title).toContain('published')
    expect(banner.description).toContain('live changes')
    expect(banner.description).toContain('employees')
  })
})
