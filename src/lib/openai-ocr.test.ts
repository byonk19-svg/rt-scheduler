import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/pdf-render-pages', () => ({
  createOcrImageVariants: vi.fn(),
  renderPdfToPngPages: vi.fn(),
}))

import {
  extractTextFromAttachment,
  extractTextFromImageAttachment,
  extractTextFromPdfAttachment,
  getOpenAiOcrConfig,
  isPdfContentType,
  isOcrSupportedContentType,
} from '@/lib/openai-ocr'
import { createOcrImageVariants, renderPdfToPngPages } from '@/lib/pdf-render-pages'

const MIN_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY
const ORIGINAL_MODEL = process.env.OPENAI_OCR_MODEL
const ONE_PAGE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDQgPj4Kc3RhcnR4cmVmCjE4NgolJUVPRg=='

describe('openai OCR helpers', () => {
  beforeEach(() => {
    vi.mocked(renderPdfToPngPages).mockReset()
    vi.mocked(createOcrImageVariants).mockReset()
    vi.mocked(renderPdfToPngPages).mockImplementation(() => {
      throw new Error('renderPdfToPngPages was not expected for this test')
    })
    vi.mocked(createOcrImageVariants).mockImplementation(() => {
      throw new Error('createOcrImageVariants was not expected for this test')
    })
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = ORIGINAL_API_KEY
    process.env.OPENAI_OCR_MODEL = ORIGINAL_MODEL
    vi.restoreAllMocks()
  })

  it('recognizes supported image content types', () => {
    expect(isOcrSupportedContentType('image/png')).toBe(true)
    expect(isOcrSupportedContentType('application/pdf')).toBe(false)
    expect(isPdfContentType('application/pdf')).toBe(true)
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
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      input?: Array<{ content?: Array<{ type: string; text?: string }> }>
    }
    expect(requestBody.input?.[0]?.content?.[0]).toMatchObject({
      type: 'input_text',
    })
    expect(requestBody.input?.[0]?.content?.[0]?.text).toContain('all visible text')
  })

  it('parses text from the Responses API output message shape', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
              },
            ],
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromImageAttachment({
        contentBase64: MIN_PNG_BASE64,
        contentType: 'image/jpeg',
        filename: 'request.jpeg',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
      error: null,
    })
  })

  it('falls back to image variants when direct image OCR returns NO_TEXT', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.mocked(createOcrImageVariants).mockResolvedValue([
      {
        zoneLabel: 'full_page',
        label: 'grayscale',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
    ])

    let imageAttempts = 0
    const fetchMock = vi.fn(async () => {
      imageAttempts += 1
      return {
        ok: true,
        json: async () => ({
          output_text:
            imageAttempts === 1 ? 'NO_TEXT' : 'Employee Name: Brianna Brown\nNeed off Mar 24',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromImageAttachment({
        contentBase64: MIN_PNG_BASE64,
        contentType: 'image/jpeg',
        filename: 'request.jpeg',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(createOcrImageVariants).toHaveBeenCalledOnce()
  })

  it('merges employee name and request table zones during image variant fallback', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.mocked(createOcrImageVariants).mockResolvedValue([
      {
        zoneLabel: 'employee_name',
        label: 'original',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
      {
        zoneLabel: 'request_table',
        label: 'grayscale',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
    ])

    let imageAttempts = 0
    const fetchMock = vi.fn(async () => {
      imageAttempts += 1
      return {
        ok: true,
        json: async () => ({
          output_text:
            imageAttempts === 1
              ? 'NO_TEXT'
              : imageAttempts === 2
                ? 'Brianna Brown'
                : '03/24 Need off for appointment',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromImageAttachment({
        contentBase64: MIN_PNG_BASE64,
        contentType: 'image/jpeg',
        filename: 'request.jpeg',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'Employee Name: Brianna Brown\n\n03/24 Need off for appointment',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('extracts text from PDF attachments using input_file', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_OCR_MODEL = 'gpt-test-vision'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Employee Name: Brianna Brown\nNeed off Mar 24' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromPdfAttachment({
        contentBase64: 'Zm9v',
        contentType: 'application/pdf',
        filename: 'request.pdf',
      })
    ).resolves.toEqual({
      status: 'completed',
      text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
      model: 'gpt-test-vision',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-key',
      }),
    })
  })

  it('falls back to image OCR when PDF extraction returns NO_TEXT', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.mocked(renderPdfToPngPages).mockResolvedValue([Buffer.from(MIN_PNG_BASE64, 'base64')])
    vi.mocked(createOcrImageVariants).mockResolvedValue([
      {
        zoneLabel: 'employee_name',
        label: 'original',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
      {
        zoneLabel: 'employee_name',
        label: 'threshold',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
      {
        zoneLabel: 'request_table',
        label: 'grayscale',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
    ])

    let imageAttempts = 0
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        input?: Array<{ content?: Array<{ type: string }> }>
      }
      const content = body.input?.[0]?.content ?? []
      const isPdfRequest = content.some((part) => part.type === 'input_file')

      if (!isPdfRequest) {
        imageAttempts += 1
      }

      return {
        ok: true,
        json: async () => ({
          output_text: isPdfRequest
            ? 'NO_TEXT'
            : imageAttempts >= 3
              ? 'Employee Name: Brianna Brown\nNeed off Mar 24'
              : 'NO_TEXT',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromPdfAttachment({
        contentBase64: ONE_PAGE_PDF_BASE64,
        contentType: 'application/pdf',
        filename: 'scan.pdf',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: expect.stringContaining('Need off Mar 24'),
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(createOcrImageVariants).toHaveBeenCalledOnce()
  })

  it('does not label request-table-only OCR text as an employee name during PDF fallback', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.mocked(renderPdfToPngPages).mockResolvedValue([Buffer.from(MIN_PNG_BASE64, 'base64')])
    vi.mocked(createOcrImageVariants).mockResolvedValue([
      {
        zoneLabel: 'request_table',
        label: 'grayscale',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
    ])

    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        input?: Array<{ content?: Array<{ type: string }> }>
      }
      const content = body.input?.[0]?.content ?? []
      const isPdfRequest = content.some((part) => part.type === 'input_file')

      return {
        ok: true,
        json: async () => ({
          output_text: isPdfRequest ? 'NO_TEXT' : '03/24 Need off for appointment',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractTextFromPdfAttachment({
      contentBase64: ONE_PAGE_PDF_BASE64,
      contentType: 'application/pdf',
      filename: 'scan.pdf',
    })

    expect(result).toMatchObject({
      status: 'completed',
      text: expect.stringContaining('03/24 Need off for appointment'),
    })
    expect(result.text).not.toContain('Employee Name:')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to image OCR when PDF extraction fails without text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.mocked(renderPdfToPngPages).mockResolvedValue([Buffer.from(MIN_PNG_BASE64, 'base64')])
    vi.mocked(createOcrImageVariants).mockResolvedValue([
      {
        zoneLabel: 'full_page',
        label: 'grayscale',
        contentType: 'image/png',
        base64: MIN_PNG_BASE64,
      },
    ])

    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        input?: Array<{ content?: Array<{ type: string }> }>
      }
      const content = body.input?.[0]?.content ?? []
      const isPdfRequest = content.some((part) => part.type === 'input_file')

      return {
        ok: isPdfRequest ? false : true,
        status: isPdfRequest ? 500 : 200,
        text: async () => 'upstream pdf parse failed',
        json: async () => ({
          output_text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromPdfAttachment({
        contentBase64: ONE_PAGE_PDF_BASE64,
        contentType: 'application/pdf',
        filename: 'scan.pdf',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: expect.stringContaining('Need off Mar 24'),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(createOcrImageVariants).toHaveBeenCalledOnce()
  })

  it('routes PDF attachments through the generic extractor', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Need off Mar 24' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromAttachment({
        contentBase64: 'Zm9v',
        contentType: 'application/pdf',
        filename: 'request.pdf',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'Need off Mar 24',
    })
  })

  it('extracts text from PDF attachments using input_file', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_OCR_MODEL = 'gpt-test-vision'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Employee Name: Brianna Brown\nNeed off Mar 24' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromPdfAttachment({
        contentBase64: 'Zm9v',
        contentType: 'application/pdf',
        filename: 'request.pdf',
      })
    ).resolves.toEqual({
      status: 'completed',
      text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
      model: 'gpt-test-vision',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-key',
      }),
    })
  })

  it('routes PDF attachments through the generic extractor', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Need off Mar 24' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      extractTextFromAttachment({
        contentBase64: 'Zm9v',
        contentType: 'application/pdf',
        filename: 'request.pdf',
      })
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'Need off Mar 24',
    })
  })

  describe('PDF page-image OCR fallback', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key'
      process.env.OPENAI_OCR_MODEL = 'gpt-test-vision'
      vi.mocked(renderPdfToPngPages).mockReset()
      vi.mocked(createOcrImageVariants).mockReset()
      vi.mocked(renderPdfToPngPages).mockResolvedValue([
        Buffer.from(MIN_PNG_BASE64, 'base64'),
        Buffer.from(MIN_PNG_BASE64, 'base64'),
      ])
      vi.mocked(createOcrImageVariants).mockImplementation(async () => [
        {
          label: 'original',
          zoneLabel: 'full_page',
          contentType: 'image/png',
          base64: MIN_PNG_BASE64,
        },
      ])
    })

    it('rasterizes PDF pages and OCRs when input_file returns no text', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output_text: 'NO_TEXT' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output_text: 'Need off Mar 25' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output_text: 'Need off Mar 26' }),
        })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        extractTextFromPdfAttachment({
          contentBase64: 'Zm9v',
          contentType: 'application/pdf',
          filename: 'scan.pdf',
        })
      ).resolves.toEqual({
        status: 'completed',
        text: '--- Page 1 ---\nNeed off Mar 25\n\n--- Page 2 ---\nNeed off Mar 26',
        model: 'gpt-test-vision',
        error: null,
      })

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(renderPdfToPngPages).toHaveBeenCalledOnce()
      expect(renderPdfToPngPages).toHaveBeenCalledWith('Zm9v')
      expect(createOcrImageVariants).toHaveBeenCalledTimes(2)
    })

    it('continues when one page OCR fails and another succeeds', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output_text: 'NO_TEXT' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'upstream error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ output_text: 'Need off Mar 27' }),
        })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        extractTextFromPdfAttachment({
          contentBase64: 'Zm9v',
          contentType: 'application/pdf',
          filename: 'scan.pdf',
        })
      ).resolves.toEqual({
        status: 'completed',
        text: '--- Page 2 ---\nNeed off Mar 27',
        model: 'gpt-test-vision',
        error: null,
      })

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(createOcrImageVariants).toHaveBeenCalledTimes(2)
    })
  })
})
