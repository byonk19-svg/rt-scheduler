import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'

describe('Button submit behavior', () => {
  it('renders plain buttons as type button by default', () => {
    const markup = renderToStaticMarkup(React.createElement(Button, null, 'Open filters'))

    expect(markup).toContain('type="button"')
  })

  it('preserves explicit submit buttons', () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, { type: 'submit' }, 'Save changes')
    )

    expect(markup).toContain('type="submit"')
  })

  it('keeps form submit buttons submitting by default', () => {
    const markup = renderToStaticMarkup(React.createElement(FormSubmitButton, null, 'Save'))

    expect(markup).toContain('type="submit"')
  })
})
