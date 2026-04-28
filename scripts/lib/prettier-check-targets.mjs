const PRETTIER_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

export function parseTrackedFiles(output) {
  return String(output ?? '')
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function selectPrettierCheckTargets(trackedFiles) {
  return trackedFiles.filter((file) => {
    const normalized = String(file ?? '').replace(/\\/g, '/')
    const basename = normalized.split('/').at(-1) ?? normalized

    const dotIndex = basename.lastIndexOf('.')
    if (dotIndex < 0) return false

    return PRETTIER_EXTENSIONS.has(basename.slice(dotIndex).toLowerCase())
  })
}

export function chunkPrettierTargets(files, size = 100) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Chunk size must be a positive integer, received: ${size}`)
  }

  const chunks = []
  for (let index = 0; index < files.length; index += size) {
    chunks.push(files.slice(index, index + size))
  }
  return chunks
}
