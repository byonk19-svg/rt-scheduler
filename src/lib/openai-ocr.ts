import { DOMMatrix, ImageData, Path2D, createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const DEFAULT_OCR_MODEL = 'gpt-4.1-mini'

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

type RenderedPdfImage = {
  contentType: 'image/png'
  base64: string
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

function installPdfCanvasPolyfills() {
  const canvasGlobals = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix
    ImageData?: typeof ImageData
    Path2D?: typeof Path2D
  }

  canvasGlobals.DOMMatrix ??= DOMMatrix
  canvasGlobals.ImageData ??= ImageData
  canvasGlobals.Path2D ??= Path2D
}

export async function renderPdfToImages(params: {
  contentBase64: string
}): Promise<RenderedPdfImage[]> {
  installPdfCanvasPolyfills()

  const data = Uint8Array.from(Buffer.from(params.contentBase64, 'base64'))
  const loadingTask = getDocument({
    data,
    disableWorker: true,
    useSystemFonts: false,
  })
  const pdf = await loadingTask.promise
  const images: RenderedPdfImage[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error(`Canvas context unavailable for PDF page ${pageNumber}.`)
      }

      await page.render({
        canvasContext: context as never,
        viewport,
      }).promise

      images.push({
        contentType: 'image/png',
        base64: canvas.toBuffer('image/png').toString('base64'),
      })

      page.cleanup()
    }
  } finally {
    pdf.cleanup()
    await loadingTask.destroy()
  }

  return images
}

export async function extractTextFromImageAttachment(params: {
  contentBase64: string | null
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

  if (!params.contentBase64 || !isOcrSupportedContentType(params.contentType)) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'Attachment type is not supported for OCR.',
    }
  }

  const prompt =
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
      error: 'No readable scheduling text detected.',
    }
  }

  return {
    status: 'completed',
    text: outputText,
    model: config.model,
    error: null,
  }
}

export async function extractTextFromPdfAttachment(params: {
  contentBase64: string | null
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

  if (!params.contentBase64 || !isPdfContentType(params.contentType)) {
    return {
      status: 'skipped',
      text: null,
      model: null,
      error: 'Attachment type is not supported for PDF extraction.',
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
    try {
      const pageImages = await renderPdfToImages({
        contentBase64: params.contentBase64,
      })
      const pageTexts: string[] = []

      for (const [index, image] of pageImages.entries()) {
        const imageResult = await extractTextFromImageAttachment({
          contentBase64: image.base64,
          contentType: image.contentType,
          filename: `${params.filename}-page-${index + 1}.png`,
        })

        if (imageResult.text) {
          pageTexts.push(`--- PAGE ${index + 1} ---\n${imageResult.text}`)
        }
      }

      const combinedText = sanitizeOcrText(pageTexts.join('\n\n'))
      if (combinedText) {
        return {
          status: 'completed',
          text: combinedText,
          model: config.model,
          error: null,
        }
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown PDF render failure.'
      return {
        status: 'failed',
        text: null,
        model: config.model,
        error: `PDF OCR fallback failed: ${details}`,
      }
    }

    return {
      status: 'failed',
      text: null,
      model: config.model,
      error: 'No readable scheduling text detected.',
    }
  }

  return {
    status: 'completed',
    text: outputText,
    model: config.model,
    error: null,
  }
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
