import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  extractTextFromImageAttachment,
  getOpenAiOcrConfig,
  isOcrSupportedContentType,
} from '@/lib/openai-ocr'

const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY
const ORIGINAL_MODEL = process.env.OPENAI_OCR_MODEL

describe('openai OCR helpers', () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = ORIGINAL_API_KEY
    process.env.OPENAI_OCR_MODEL = ORIGINAL_MODEL
    vi.restoreAllMocks()
  })

  it('recognizes supported image content types', () => {
    expect(isOcrSupportedContentType('image/png')).toBe(true)
    expect(isOcrSupportedContentType('application/pdf')).toBe(false)
  })

  it('returns skipped when OCR is not configured', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      extractTextFromImageAttachment({
        contentBase64: 'Zm9v',
        contentType: 'image/png',
        filename: 'request.png',
      })
    ).resolves.toEqual({
      status: 'skipped',
      text: null,
      model: null,
      error: 'OPENAI_API_KEY not configured.',
    })
  })

  it('uses configured OCR model and returns text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_OCR_MODEL = 'gpt-test-vision'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Need off Mar 24' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromImageAttachment({
        contentBase64: 'Zm9v',
        contentType: 'image/png',
        filename: 'request.png',
      })
    ).resolves.toEqual({
      status: 'completed',
      text: 'Need off Mar 24',
      model: 'gpt-test-vision',
      error: null,
    })

    expect(getOpenAiOcrConfig()).toEqual({
      apiKey: 'test-key',
      model: 'gpt-test-vision',
      enabled: true,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
