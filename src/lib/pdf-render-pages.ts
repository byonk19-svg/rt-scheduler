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
  const document = await pdf(Buffer.from(contentBase64, 'base64'), { scale: 2 })
  const buffers: Buffer[] = []

  for await (const image of document) {
    buffers.push(image)
  }

  return buffers
}
