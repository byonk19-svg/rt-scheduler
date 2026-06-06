import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas'

export type OcrImageVariant = {
  label: string
  zoneLabel: 'full_page' | 'employee_name' | 'request_table'
  contentType: 'image/png'
  base64: string
}

const FORM_ZONES: Array<{
  label: 'employee_name' | 'request_table'
  x: number
  y: number
  width: number
  height: number
}> = [
  { label: 'employee_name', x: 0.08, y: 0.08, width: 0.84, height: 0.13 },
  { label: 'request_table', x: 0.22, y: 0.39, width: 0.72, height: 0.5 },
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

function rotateCanvas(source: Canvas, degrees: 90 | 180 | 270): Canvas {
  const quarterTurn = degrees === 90 || degrees === 270
  const canvas = createCanvas(
    quarterTurn ? source.height : source.width,
    quarterTurn ? source.width : source.height
  )
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context unavailable while rotating OCR page image.')
  }

  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((degrees * Math.PI) / 180)
  context.drawImage(source, -source.width / 2, -source.height / 2)
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
    label: 'original',
    zoneLabel: 'full_page',
    contentType: 'image/png',
    base64: toPngBase64(baseCanvas),
  })
  variants.push({
    label: 'grayscale',
    zoneLabel: 'full_page',
    contentType: 'image/png',
    base64: toPngBase64(fullPageGrayscale),
  })
  for (const degrees of [90, 270] as const) {
    const rotated = rotateCanvas(baseCanvas, degrees)
    const rotatedGrayscale = applyContrastVariant(rotated, {
      grayscale: true,
      contrast: 1.45,
      brightness: 1.05,
    })

    variants.push(
      {
        label: `rotated_${degrees}`,
        zoneLabel: 'full_page',
        contentType: 'image/png',
        base64: toPngBase64(rotated),
      },
      {
        label: `rotated_${degrees}_grayscale`,
        zoneLabel: 'full_page',
        contentType: 'image/png',
        base64: toPngBase64(rotatedGrayscale),
      }
    )
  }
  for (const zone of FORM_ZONES) {
    const zoneCanvas = cropZoneCanvas(baseCanvas, zone)
    const grayscale = applyContrastVariant(zoneCanvas, {
      grayscale: true,
      contrast: 1.65,
      brightness: 1.08,
    })
    const rotatedZoneCanvas =
      baseCanvas.width > baseCanvas.height
        ? cropZoneCanvas(rotateCanvas(baseCanvas, 90), zone)
        : null
    const rotatedZoneGrayscale = rotatedZoneCanvas
      ? applyContrastVariant(rotatedZoneCanvas, {
          grayscale: true,
          contrast: 1.65,
          brightness: 1.08,
        })
      : null

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
      }
    )
    if (rotatedZoneCanvas && rotatedZoneGrayscale) {
      variants.push(
        {
          label: 'rotated_90',
          zoneLabel: zone.label,
          contentType: 'image/png',
          base64: toPngBase64(rotatedZoneCanvas),
        },
        {
          label: 'rotated_90_grayscale',
          zoneLabel: zone.label,
          contentType: 'image/png',
          base64: toPngBase64(rotatedZoneGrayscale),
        }
      )
    }
  }

  return variants
}
