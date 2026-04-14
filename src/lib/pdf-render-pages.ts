/**
 * Rasterizes every page of a PDF to PNG buffers (server-only).
 * Used when direct PDF text extraction returns no usable text (e.g. scanned forms).
 */
export async function renderPdfToPngPages(contentBase64: string): Promise<Buffer[]> {
  const { pdf } = await import('pdf-to-img')
  const document = await pdf(Buffer.from(contentBase64, 'base64'), { scale: 2 })
  const buffers: Buffer[] = []
  for await (const image of document) {
    buffers.push(image)
  }
  return buffers
}
