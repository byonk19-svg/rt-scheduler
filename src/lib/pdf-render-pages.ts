import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas'

export type OcrImageVariant = {
  label: string
  zoneLabel: 'full_page' | 'employee_name' | 'request_top' | 'request_mid' | 'request_bottom'
  contentType: 'image/png'
  base64: string
}

const DEFAULT_VARIANT_THRESHOLD = 176
const FORM_ZONES: Array<{
  label: 'employee_name' | 'request_top' | 'request_mid' | 'request_bottom'
  x: number
  y: number
  width: number
  height: number
}> = [
  { label: 'employee_name', x: 0.08, y: 0.08, width: 0.84, height: 0.13 },
  { label: 'request_top', x: 0.08, y: 0.24, width: 0.84, height: 0.16 },
  { label: 'request_mid', x: 0.08, y: 0.41, width: 0.84, height: 0.16 },
  { label: 'request_bottom', x: 0.08, y: 0.58, width: 0.84, height: 0.16 },
]

/**
 * Rasterizes every page of a PDF to PNG buffers (server-only).
 * Used when direct PDF text extraction returns no usable text (e.g. scanned forms).
 */
export async function renderPdfToPngPages(contentBase64: string): Promise<Buffer[]> {
  const { DOMMatrix, ImageData, Path2D } = await import('@napi-rs/canvas')
  const canvasGlobals = globalThis as Record<string, unknown>

  canvasGlobals.DOMMatrix ??= DOMMatrix
  canvasGlobals.ImageData ??= ImageData
  canvasGlobals.Path2D ??= Path2D

  const { pdf } = await import('pdf-to-img')
  const document = await pdf(Buffer.from(contentBase64, 'base64'), { scale: 3 })
  const buffers: Buffer[] = []

  for await (const image of document) {
    buffers.push(image)
  }

  return buffers
}

function toPngBase64(canvas: Canvas): string {
  return canvas.toBuffer('image/png').toString('base64')
}

function cropZoneCanvas(source: Canvas, zone: (typeof FORM_ZONES)[number]): Canvas {
  const width = Math.max(1, Math.round(source.width * zone.width))
  const height = Math.max(1, Math.round(source.height * zone.height))
  const x = Math.max(0, Math.round(source.width * zone.x))
  const y = Math.max(0, Math.round(source.height * zone.y))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(`Canvas context unavailable while cropping OCR zone ${zone.label}.`)
  }

  context.drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas
}

function applyContrastVariant(
  source: Canvas,
  options: {
    grayscale?: boolean
    contrast?: number
    brightness?: number
    threshold?: number
    invert?: boolean
  }
): Canvas {
  const canvas = createCanvas(source.width, source.height)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context unavailable while applying OCR image preprocessing.')
  }

  context.drawImage(source, 0, 0)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = image
  const contrast = options.contrast ?? 1
  const brightness = options.brightness ?? 1

  for (let index = 0; index < data.length; index += 4) {
    let r = data[index] ?? 0
    let g = data[index + 1] ?? 0
    let b = data[index + 2] ?? 0

    if (options.grayscale || options.threshold != null) {
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      r = luminance
      g = luminance
      b = luminance
    }

    r = ((r - 128) * contrast + 128) * brightness
    g = ((g - 128) * contrast + 128) * brightness
    b = ((b - 128) * contrast + 128) * brightness

    if (options.threshold != null) {
      const mono = r >= options.threshold ? 255 : 0
      r = mono
      g = mono
      b = mono
    }

    if (options.invert) {
      r = 255 - r
      g = 255 - g
      b = 255 - b
    }

    data[index] = Math.max(0, Math.min(255, Math.round(r)))
    data[index + 1] = Math.max(0, Math.min(255, Math.round(g)))
    data[index + 2] = Math.max(0, Math.min(255, Math.round(b)))
  }

  context.putImageData(image, 0, 0)
  return canvas
}

export async function createOcrImageVariants(pageBuffer: Buffer): Promise<OcrImageVariant[]> {
  const image = await loadImage(pageBuffer)
  const baseCanvas = createCanvas(image.width, image.height)
  const baseContext = baseCanvas.getContext('2d')

  if (!baseContext) {
    throw new Error('Canvas context unavailable while loading OCR page image.')
  }

  baseContext.drawImage(image, 0, 0)

  const variants: OcrImageVariant[] = []
  const fullPageGrayscale = applyContrastVariant(baseCanvas, {
    grayscale: true,
    contrast: 1.45,
    brightness: 1.05,
  })

  variants.push({
    label: 'grayscale',
    zoneLabel: 'full_page',
    contentType: 'image/png',
    base64: toPngBase64(fullPageGrayscale),
  })

  for (const zone of FORM_ZONES) {
    const zoneCanvas = cropZoneCanvas(baseCanvas, zone)
    const grayscale = applyContrastVariant(zoneCanvas, {
      grayscale: true,
      contrast: 1.65,
      brightness: 1.08,
    })
    const thresholded = applyContrastVariant(zoneCanvas, {
      grayscale: true,
      contrast: 1.9,
      brightness: 1.1,
      threshold: DEFAULT_VARIANT_THRESHOLD,
    })

    variants.push(
      {
        label: 'original',
        zoneLabel: zone.label,
        contentType: 'image/png',
        base64: toPngBase64(zoneCanvas),
      },
      {
        label: 'grayscale',
        zoneLabel: zone.label,
        contentType: 'image/png',
        base64: toPngBase64(grayscale),
      },
      {
        label: 'threshold',
        zoneLabel: zone.label,
        contentType: 'image/png',
        base64: toPngBase64(thresholded),
      }
    )
  }

  return variants
}
