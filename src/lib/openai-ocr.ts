import { createOcrImageVariants, renderPdfToPngPages } from '@/lib/pdf-render-pages'

const DEFAULT_OCR_MODEL = 'gpt-4.1-mini'

const NO_TEXT_SKIP_MESSAGE = 'No readable scheduling text detected.'

const IMAGE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])
const PDF_CONTENT_TYPES = new Set(['application/pdf'])

export type OcrResult = {
  status: 'completed' | 'failed' | 'skipped'
  text: string | null
  model: string | null
  error: string | null
}

export function isOcrSupportedContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  return IMAGE_CONTENT_TYPES.has(contentType.toLowerCase())
}

export function isPdfContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  return PDF_CONTENT_TYPES.has(contentType.toLowerCase())
}

export function getOpenAiOcrConfig(): {
  apiKey: string | null
  model: string
  enabled: boolean
} {
  const apiKey = process.env.OPENAI_API_KEY ?? null
  const model = process.env.OPENAI_OCR_MODEL?.trim() || DEFAULT_OCR_MODEL
  return {
    apiKey,
    model,
    enabled: Boolean(apiKey),
  }
}

function sanitizeOcrText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function scoreOcrText(value: string): number {
  const text = sanitizeOcrText(value)
  if (!text) return 0

  let score = Math.min(text.length, 120)

  if (/\b(employee\s+name|name:)\b/i.test(text)) score += 120
  if (/\b(need off|cannot work|can work|available|vacation|pto|off)\b/i.test(text)) score += 80
  if (
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
      text
    )
  ) {
    score += 100
  }

  return score
}

export async function extractTextFromImageAttachment(params: {
  contentBase64: string | null
  contentType: string | null
  filename: string
  promptOverride?: string
}): Promise<OcrResult> {
  const config = getOpenAiOcrConfig()
  if (!config.enabled) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'OPENAI_API_KEY not configured.',
    }
  }

  if (!params.contentBase64 || !isOcrSupportedContentType(params.contentType)) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'Attachment type is not supported for OCR.',
    }
  }

  const prompt =
    params.promptOverride ??
    'Read this employee scheduling request form image and transcribe only the useful scheduling text. Return plain text only. Preserve dates exactly when visible. If there is no readable scheduling text, return NO_TEXT.'

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_image',
              image_url: `data:${params.contentType};base64,${params.contentBase64}`,
              detail: 'high',
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    return {
      status: 'failed',
      text: null,
      model: config.model,
      error: `OpenAI OCR failed (${response.status}): ${details}`,
    }
  }

  const payload = (await response.json()) as { output_text?: string | null }
  const outputText = sanitizeOcrText(payload.output_text ?? '')

  if (!outputText || outputText === 'NO_TEXT') {
    return {
      status: 'skipped',
      text: null,
      model: config.model,
      error: NO_TEXT_SKIP_MESSAGE,
    }
  }

  return {
    status: 'completed',
    text: outputText,
    model: config.model,
    error: null,
  }
}

async function extractTextFromPdfViaInputFile(params: {
  contentBase64: string
  contentType: string | null
  filename: string
}): Promise<OcrResult> {
  const config = getOpenAiOcrConfig()
  if (!config.enabled) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'OPENAI_API_KEY not configured.',
    }
  }

  const prompt =
    'Read this PDF employee scheduling request form and transcribe only the useful scheduling text. Return plain text only. Preserve dates and employee names exactly when visible. If there is no readable scheduling text, return NO_TEXT.'

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_file',
              filename: params.filename,
              file_data: `data:${params.contentType};base64,${params.contentBase64}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    return {
      status: 'failed',
      text: null,
      model: config.model,
      error: `OpenAI PDF extraction failed (${response.status}): ${details}`,
    }
  }

  const payload = (await response.json()) as { output_text?: string | null }
  const outputText = sanitizeOcrText(payload.output_text ?? '')

  if (!outputText || outputText === 'NO_TEXT') {
    return {
      status: 'skipped',
      text: null,
      model: config.model,
      error: NO_TEXT_SKIP_MESSAGE,
    }
  }

  return {
    status: 'completed',
    text: outputText,
    model: config.model,
    error: null,
  }
}

async function extractTextFromPdfViaRenderedPages(params: {
  contentBase64: string
  contentType: string | null
  filename: string
}): Promise<OcrResult> {
  const config = getOpenAiOcrConfig()
  if (!config.enabled) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'OPENAI_API_KEY not configured.',
    }
  }

  let buffers: Buffer[]
  try {
    buffers = await renderPdfToPngPages(params.contentBase64)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'failed',
      text: null,
      model: null,
      error: `Could not rasterize PDF for OCR: ${message}`,
    }
  }

  if (buffers.length === 0) {
    return {
      status: 'failed',
      text: null,
      model: null,
      error: 'PDF contained no pages to OCR.',
    }
  }

  const segments: string[] = []
  let lastModel: string | null = null
  const pageErrors: string[] = []
  const zoneOrder = ['employee_name', 'request_top', 'request_mid', 'request_bottom']
  const zonePrompts: Record<string, string> = {
    employee_name:
      'Read only the handwritten employee name from this form region. Return just the name in plain text. If there is no readable name, return NO_TEXT.',
    request_top:
      'Read only the handwritten availability or PTO request text from this form region. Preserve dates exactly. If there is no readable request text, return NO_TEXT.',
    request_mid:
      'Read only the handwritten availability or PTO request text from this form region. Preserve dates exactly. If there is no readable request text, return NO_TEXT.',
    request_bottom:
      'Read only the handwritten availability or PTO request text from this form region. Preserve dates exactly. If there is no readable request text, return NO_TEXT.',
  }

  for (let i = 0; i < buffers.length; i++) {
    const pageBuffer = buffers[i]!
    const variants = await createOcrImageVariants(pageBuffer)
    const variantErrors: string[] = []
    const bestZoneText = new Map<string, { text: string; score: number }>()

    for (const variant of variants) {
      const pageResult = await extractTextFromImageAttachment({
        contentBase64: variant.base64,
        contentType: variant.contentType,
        filename: `${params.filename}#page-${i + 1}:${variant.label}`,
        promptOverride: zonePrompts[variant.zoneLabel] ?? undefined,
      })

      if (pageResult.model) {
        lastModel = pageResult.model
      }

      if (pageResult.status === 'completed' && pageResult.text) {
        const score = scoreOcrText(pageResult.text)
        const current = bestZoneText.get(variant.zoneLabel)
        if (!current || score > current.score) {
          bestZoneText.set(variant.zoneLabel, { text: pageResult.text, score })
        }
        if (score >= 180) {
          continue
        }
      } else if (pageResult.error && pageResult.error !== NO_TEXT_SKIP_MESSAGE) {
        variantErrors.push(`${variant.zoneLabel}/${variant.label}: ${pageResult.error}`)
      }
    }

    const orderedZoneText = zoneOrder
      .map((zoneLabel) => bestZoneText.get(zoneLabel)?.text ?? null)
      .filter((value): value is string => Boolean(value))
      .map((text, index) => (index === 0 ? `Employee Name: ${text}` : text))
    const mergedPageText = orderedZoneText.join('\n\n').trim()

    if (mergedPageText) {
      segments.push(`--- Page ${i + 1} ---\n${mergedPageText}`)
    } else if (variantErrors.length > 0) {
      pageErrors.push(`page ${i + 1}: ${variantErrors.join('; ')}`)
    } else {
      pageErrors.push(`page ${i + 1}: ${NO_TEXT_SKIP_MESSAGE}`)
    }
  }

  const combined = segments.join('\n\n').trim()
  if (!combined) {
    return {
      status: 'failed',
      text: null,
      model: lastModel,
      error:
        pageErrors.length > 0
          ? `All pages failed OCR (${pageErrors.join('; ')})`
          : 'Page-image OCR produced no text.',
    }
  }

  return {
    status: 'completed',
    text: combined,
    model: lastModel,
    error: null,
  }
}

export async function extractTextFromPdfAttachment(params: {
  contentBase64: string | null
  contentType: string | null
  filename: string
}): Promise<OcrResult> {
  if (!params.contentBase64 || !isPdfContentType(params.contentType)) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'Attachment type is not supported for PDF extraction.',
    }
  }

  const primary = await extractTextFromPdfViaInputFile({
    contentBase64: params.contentBase64,
    contentType: params.contentType,
    filename: params.filename,
  })

  if (primary.status === 'skipped' && primary.error === NO_TEXT_SKIP_MESSAGE) {
    const fallback = await extractTextFromPdfViaRenderedPages({
      contentBase64: params.contentBase64,
      contentType: params.contentType,
      filename: params.filename,
    })

    if (fallback.status === 'completed' && fallback.text) {
      return fallback
    }

    if (fallback.status === 'failed') {
      return {
        status: 'failed',
        text: null,
        model: fallback.model ?? primary.model,
        error: `PDF text extraction found nothing; page-image OCR failed: ${fallback.error ?? 'unknown error'}`,
      }
    }
  }

  return primary
}

export async function extractTextFromAttachment(params: {
  contentBase64: string | null
  contentType: string | null
  filename: string
}): Promise<OcrResult> {
  if (isPdfContentType(params.contentType)) {
    return extractTextFromPdfAttachment(params)
  }

  return extractTextFromImageAttachment(params)
}
