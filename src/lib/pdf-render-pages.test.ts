import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'

import { createOcrImageVariants } from '@/lib/pdf-render-pages'

function createPng(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas context unavailable in test.')

  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#111'
  context.fillRect(4, 4, width - 8, height - 8)
  return canvas.toBuffer('image/png')
}

describe('createOcrImageVariants', () => {
  it('adds rotated full-page and zone variants for sideways photographed forms', async () => {
    const variants = await createOcrImageVariants(createPng(120, 80))
    const fullPageLabels = variants
      .filter((variant) => variant.zoneLabel === 'full_page')
      .map((variant) => variant.label)
    const employeeNameLabels = variants
      .filter((variant) => variant.zoneLabel === 'employee_name')
      .map((variant) => variant.label)

    expect(fullPageLabels).toEqual(
      expect.arrayContaining([
        'original',
        'grayscale',
        'rotated_90',
        'rotated_90_grayscale',
        'rotated_270',
        'rotated_270_grayscale',
      ])
    )
    expect(employeeNameLabels).toEqual(
      expect.arrayContaining(['original', 'grayscale', 'rotated_90', 'rotated_90_grayscale'])
    )
  })
})
