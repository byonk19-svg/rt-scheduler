import { createOcrImageVariants, renderPdfToPngPages } from '@/lib/pdf-render-pages'

const DEFAULT_OCR_MODEL = 'gpt-4.1-mini'

const NO_TEXT_SKIP_MESSAGE = 'No readable scheduling text detected.'

// Score at which a full-page transcription is considered good enough to skip zone crops
const FULL_PAGE_SCORE_THRESHOLD = 80
// Score at which we consider a zone "satisfied" and skip remaining variants for it
const ZONE_SATISFIED_THRESHOLD = 180

const IMAGE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])
const PDF_CONTENT_TYPES = new Set(['application/pdf'])

// Prompts tuned per zone — more permissive than the old generic prompt so handwriting
// isn't rejected just because the model doesn't see scheduling "keywords".
const ZONE_PROMPTS: Record<string, string> = {
  full_page:
    'This is a page from a handwritten employee scheduling request form. ' +
    'Carefully read and transcribe ALL text you can see — names, dates, month names, ' +
    'status words (off, work, available, vacation, PTO, etc.), check marks, and any other ' +
    'written content. Be thorough; do not omit anything readable. ' +
    'Return the raw transcribed text only. ' +
    'If the page is completely blank or the handwriting is entirely illegible, return NO_TEXT.',
  employee_name:
    'This is the top section of a handwritten scheduling form. ' +
    'Read and return any name, employee name, or person identifier written here. ' +
    'Return just the name text as written. ' +
    'If nothing is written or legible, return NO_TEXT.',
  request_top:
    'This section of a handwritten scheduling form contains date and availability information. ' +
    'Read and transcribe any dates, month names, day numbers, or status words ' +
    '(off, work, available, vacation, PTO, etc.) written here. ' +
    'Return the text as-is. If blank or entirely illegible, return NO_TEXT.',
  request_mid:
    'This section of a handwritten scheduling form contains date and availability information. ' +
    'Read and transcribe any dates, month names, day numbers, or status words ' +
    '(off, work, available, vacation, PTO, etc.) written here. ' +
    'Return the text as-is. If blank or entirely illegible, return NO_TEXT.',
  request_bottom:
    'This section of a handwritten scheduling form contains date and availability information. ' +
    'Read and transcribe any dates, month names, day numbers, or status words ' +
    '(off, work, available, vacation, PTO, etc.) written here. ' +
    'Return the text as-is. If blank or entirely illegible, return NO_TEXT.',
}

const DEFAULT_IMAGE_OCR_PROMPT =
  'Carefully read this image and transcribe all visible text — names, dates, and any written content. ' +
  'Handwriting is expected. Return the raw transcribed text only. ' +
  'If the image is completely blank or the text is entirely unreadable, return NO_TEXT.'

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
  zoneLabel?: string
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
    (params.zoneLabel != null ? ZONE_PROMPTS[params.zoneLabel] : undefined) ??
    DEFAULT_IMAGE_OCR_PROMPT

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
    'Read this PDF containing handwritten scheduling request forms and transcribe all visible text — ' +
    'employee names, dates, month names, and availability notes (off, work, vacation, PTO, etc.). ' +
    'Return plain text only. If the PDF appears blank or entirely unreadable, return NO_TEXT.'

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

  for (let i = 0; i < buffers.length; i++) {
    const pageBuffer = buffers[i]!
    const variants = await createOcrImageVariants(pageBuffer)

    // Separate full-page variant from zone crop variants
    const fullPageVariants = variants.filter((v) => v.zoneLabel === 'full_page')
    const zoneVariants = variants.filter((v) => v.zoneLabel !== 'full_page')

    const variantErrors: string[] = []
    const bestZoneText = new Map<string, { text: string; score: number }>()

    // --- Pass 1: full-page attempt ---
    for (const variant of fullPageVariants) {
      const pageResult = await extractTextFromImageAttachment({
        contentBase64: variant.base64,
        contentType: variant.contentType,
        filename: `${params.filename}#page-${i + 1}:full_page`,
        zoneLabel: variant.zoneLabel,
      })

      if (pageResult.model) lastModel = pageResult.model

      if (pageResult.status === 'completed' && pageResult.text) {
        const score = scoreOcrText(pageResult.text)
        const current = bestZoneText.get('full_page')
        if (!current || score > current.score) {
          bestZoneText.set('full_page', { text: pageResult.text, score })
        }
      } else if (pageResult.error && pageResult.error !== NO_TEXT_SKIP_MESSAGE) {
        variantErrors.push(`full_page: ${pageResult.error}`)
      }
    }

    // If the full-page pass produced high-confidence text, use it and skip zone crops
    const fullPageEntry = bestZoneText.get('full_page')
    if (fullPageEntry && fullPageEntry.score >= FULL_PAGE_SCORE_THRESHOLD) {
      segments.push(`--- Page ${i + 1} ---\n${fullPageEntry.text}`)
      continue
    }

    // --- Pass 2: zone crop attempts ---
    const satisfiedZones = new Set<string>()

    for (const variant of zoneVariants) {
      if (satisfiedZones.has(variant.zoneLabel)) continue

      const pageResult = await extractTextFromImageAttachment({
        contentBase64: variant.base64,
        contentType: variant.contentType,
        filename: `${params.filename}#page-${i + 1}:${variant.zoneLabel}/${variant.label}`,
        zoneLabel: variant.zoneLabel,
      })

      if (pageResult.model) lastModel = pageResult.model

      if (pageResult.status === 'completed' && pageResult.text) {
        const score = scoreOcrText(pageResult.text)
        const current = bestZoneText.get(variant.zoneLabel)
        if (!current || score > current.score) {
          bestZoneText.set(variant.zoneLabel, { text: pageResult.text, score })
        }
        if (score >= ZONE_SATISFIED_THRESHOLD) {
          satisfiedZones.add(variant.zoneLabel)
        }
      } else if (pageResult.error && pageResult.error !== NO_TEXT_SKIP_MESSAGE) {
        variantErrors.push(`${variant.zoneLabel}/${variant.label}: ${pageResult.error}`)
      }
    }

    // Build page text from best zone results
    const orderedZoneParts: string[] = []
    for (const zoneLabel of ['employee_name', 'request_top', 'request_mid', 'request_bottom']) {
      const entry = bestZoneText.get(zoneLabel)
      if (!entry?.text) continue
      orderedZoneParts.push(
        zoneLabel === 'employee_name' ? `Employee Name: ${entry.text}` : entry.text
      )
    }

    const mergedZoneText = orderedZoneParts.join('\n\n').trim()

    if (mergedZoneText) {
      segments.push(`--- Page ${i + 1} ---\n${mergedZoneText}`)
    } else if (fullPageEntry?.text) {
      // Full page scored below threshold but still has some text — use it as a fallback
      segments.push(`--- Page ${i + 1} ---\n${fullPageEntry.text}`)
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

  // Fall back to page-rendering OCR whenever the direct PDF approach didn't produce text —
  // covers both the "model returned NO_TEXT" (skipped) and API-error (failed) cases.
  if (!primary.text) {
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
