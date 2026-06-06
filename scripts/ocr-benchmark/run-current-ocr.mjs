import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_MANIFEST = 'scripts/ocr-benchmark/manifest.local.json'
const DEFAULT_OUTPUT = 'output/ocr-benchmark/current-openai.json'
const TEMP_BUNDLE = '.tmp/ocr-benchmark/openai-ocr-bundle.mjs'

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    output: DEFAULT_OUTPUT,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--manifest' && next) {
      args.manifest = next
      index += 1
    } else if (arg === '--output' && next) {
      args.output = next
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node --env-file=.env.local scripts/ocr-benchmark/run-current-ocr.mjs \\
    --manifest scripts/ocr-benchmark/manifest.local.json \\
    --output output/ocr-benchmark/current-openai.json`)
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function requireManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest must be a JSON object.')
  }

  if (!Array.isArray(manifest.cases)) {
    throw new Error('Manifest must contain a cases array.')
  }
}

function guessContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

async function bundleCurrentOcrModule(repoRoot) {
  const outfile = path.join(repoRoot, TEMP_BUNDLE)
  await mkdir(path.dirname(outfile), { recursive: true })

  await build({
    entryPoints: [path.join(repoRoot, 'src/lib/openai-ocr.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: false,
    tsconfig: path.join(repoRoot, 'tsconfig.json'),
    external: ['@napi-rs/canvas', 'pdf-to-img', 'pdfjs-dist'],
    logLevel: 'silent',
  })

  return outfile
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const repoRoot = process.cwd()
  const manifestPath = path.resolve(repoRoot, args.manifest)
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`)
  }

  const manifest = await readJson(manifestPath)
  requireManifestShape(manifest)

  const samplesDir = path.resolve(repoRoot, manifest.samplesDir ?? path.dirname(manifestPath))
  const bundlePath = await bundleCurrentOcrModule(repoRoot)
  const ocrModule = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)

  if (typeof ocrModule.extractTextFromAttachment !== 'function') {
    throw new Error('Bundled OCR module did not export extractTextFromAttachment.')
  }

  const cases = []

  for (const testCase of manifest.cases) {
    const startedAt = performance.now()
    const filename = testCase.filename
    const filePath = path.resolve(samplesDir, filename)

    try {
      const fileBuffer = await readFile(filePath)
      const contentType = testCase.contentType || guessContentType(filename)
      const result = await ocrModule.extractTextFromAttachment({
        contentBase64: fileBuffer.toString('base64'),
        contentType,
        filename,
      })

      cases.push({
        id: testCase.id,
        filename,
        provider: 'current-openai',
        durationMs: Math.round(performance.now() - startedAt),
        status: result.status,
        text: result.text,
        model: result.model,
        error: result.error,
      })
    } catch (error) {
      cases.push({
        id: testCase.id,
        filename,
        provider: 'current-openai',
        durationMs: Math.round(performance.now() - startedAt),
        status: 'failed',
        text: null,
        model: null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const outputPath = path.resolve(repoRoot, args.output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        manifest: path.relative(repoRoot, manifestPath),
        provider: 'current-openai',
        cases,
      },
      null,
      2
    )}\n`
  )

  console.log(
    `Wrote ${cases.length} current OCR result(s) to ${path.relative(repoRoot, outputPath)}`
  )
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
