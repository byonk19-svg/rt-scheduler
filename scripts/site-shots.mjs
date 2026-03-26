import { chromium, firefox, webkit } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import zlib from 'node:zlib'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const [k, v] = token.includes('=') ? token.split('=', 2) : [token, argv[i + 1]]
    const key = k.replace(/^--/, '')
    const value = token.includes('=')
      ? v
      : argv[i + 1] && !argv[i + 1].startsWith('--')
        ? argv[++i]
        : 'true'
    args[key] = value
  }
  return args
}

function toBool(v, def) {
  if (v === undefined) return def
  const s = String(v).toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(s)) return true
  if (['false', '0', 'no', 'n'].includes(s)) return false
  return def
}

function toInt(v, def) {
  if (v === undefined) return def
  const n = Number.parseInt(String(v), 10)
  return Number.isFinite(n) ? n : def
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10)
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180)
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function normalizeUrl(inputUrl, origin) {
  let u
  try {
    u = new URL(inputUrl)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(u.protocol)) return null
  if (u.origin !== origin) return null

  u.hash = ''

  const params = u.searchParams
  const toDelete = []
  for (const [k] of params) {
    const key = k.toLowerCase()
    if (key.startsWith('utm_')) toDelete.push(k)
    if (['gclid', 'fbclid', 'mc_cid', 'mc_eid'].includes(key)) toDelete.push(k)
  }
  toDelete.forEach((k) => params.delete(k))

  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1)
  }

  const lowerPath = u.pathname.toLowerCase()
  const blockedExt = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.ico',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.gz',
    '.mp4',
    '.mov',
    '.avi',
    '.mp3',
    '.wav',
    '.css',
    '.js',
    '.map',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ]
  if (blockedExt.some((ext) => lowerPath.endsWith(ext))) return null

  return u.toString()
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(promptText, () => {
      rl.close()
      resolve()
    })
  })
}

function pickBrowserType(name) {
  const b = (name ?? 'chromium').toLowerCase()
  if (b === 'chromium') return chromium
  if (b === 'firefox') return firefox
  if (b === 'webkit') return webkit
  throw new Error('Invalid --browser. Use chromium|firefox|webkit')
}

async function fetchTextMaybeGz(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'site-shots/1.0 (playwright)' },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)

  const buf = Buffer.from(await res.arrayBuffer())
  // Many fetch implementations transparently decompress encoded responses.
  // Use gzip magic bytes to decide if payload still needs manual gunzip.
  const hasGzipMagicBytes = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
  if (hasGzipMagicBytes || url.toLowerCase().endsWith('.gz')) {
    try {
      const unzipped = zlib.gunzipSync(buf)
      return unzipped.toString('utf8')
    } catch {
      // If body is already decompressed, fall back to plain UTF-8 text.
      return buf.toString('utf8')
    }
  }
  return buf.toString('utf8')
}

function extractLocUrls(xmlText) {
  const urls = []
  const re = /<loc>\s*(<!\[CDATA\[)?\s*([^<\]]+)\s*(\]\]>)?\s*<\/loc>/gi
  let m
  while ((m = re.exec(xmlText)) !== null) {
    const raw = m[2]?.trim()
    if (raw) urls.push(raw)
  }
  return urls
}

function looksLikeSitemapIndex(xmlText) {
  return /<sitemapindex\b/i.test(xmlText)
}

async function collectSitemapUrls({ sitemapUrl, origin, limit }) {
  const seenSitemaps = new Set()
  const pageUrls = new Set()

  async function visitSitemap(url) {
    if (seenSitemaps.has(url)) return
    seenSitemaps.add(url)

    const xml = await fetchTextMaybeGz(url)
    const locs = extractLocUrls(xml)

    if (looksLikeSitemapIndex(xml)) {
      for (const loc of locs) {
        if (pageUrls.size >= limit) break
        if (!loc) continue
        if (!loc.toLowerCase().includes('http')) continue
        if (!loc.toLowerCase().endsWith('.xml') && !loc.toLowerCase().endsWith('.xml.gz')) continue
        await visitSitemap(loc)
      }
      return
    }

    for (const loc of locs) {
      if (pageUrls.size >= limit) break
      const normalized = normalizeUrl(loc, origin)
      if (normalized) pageUrls.add(normalized)
    }
  }

  await visitSitemap(sitemapUrl)
  return Array.from(pageUrls)
}

async function runPool(items, concurrency, worker) {
  let idx = 0
  const results = []
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = idx++
      if (i >= items.length) break
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const args = parseArgs(process.argv)

  const start = args.start
  if (!start) {
    console.error('Missing --start <url>')
    process.exit(1)
  }

  const startUrl = new URL(start)
  const origin = startUrl.origin

  const outDir = args.out ?? 'shots'
  const mode = (args.mode ?? 'sitemap').toLowerCase() // sitemap|links|both

  const browserName = args.browser ?? 'chromium'
  const headful = toBool(args.headful, false)

  const maxPages = toInt(args.max, 80)
  const maxDepth = toInt(args.depth, 3)
  const concurrency = Math.max(1, toInt(args.concurrency, 4))

  const waitUntil = args['wait-until'] ?? 'networkidle' // networkidle|load|domcontentloaded
  const delayMs = toInt(args.delay, 0)
  const viewport = args.viewport ?? '1365x768'
  const [vw, vh] = viewport.split('x').map((n) => Number.parseInt(n, 10))
  if (!Number.isFinite(vw) || !Number.isFinite(vh)) {
    console.error('Invalid --viewport (expected like 1365x768)')
    process.exit(1)
  }

  const authFile = args['auth-file'] ?? '.auth/storageState.json'
  const saveAuth = toBool(args['save-auth'], false)
  const exitAfterAuth = toBool(args['exit-after-auth'], true)
  const loginUrl = args['login-url'] ?? startUrl.toString()

  const sitemapUrl = args.sitemap ?? `${origin}/sitemap.xml`
  const sitemapLimit = Math.max(1, toInt(args['sitemap-limit'], 5000))

  await ensureDir(outDir)

  const browserType = pickBrowserType(browserName)
  const browser = await browserType.launch({ headless: !headful && !saveAuth })

  // Save auth mode (interactive)
  if (saveAuth) {
    await ensureDir(path.dirname(authFile))

    const context = await browser.newContext({
      viewport: { width: vw, height: vh },
      ignoreHTTPSErrors: true,
    })

    const page = await context.newPage()
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await waitForEnter(
      `\nLogin in the opened browser.\nWhen you're fully logged in (and can see authenticated pages), press Enter here to save auth to ${authFile}...\n`
    )

    await context.storageState({ path: authFile })
    await page.close()
    await context.close()

    console.log(`Saved auth state to: ${authFile}`)

    if (exitAfterAuth) {
      await browser.close()
      return
    }
  }

  const useAuth = await fileExists(authFile)
  if (!useAuth && !saveAuth) {
    console.warn(`Auth file not found at ${authFile}. Continuing without auth.`)
  }

  const baseContextOptions = {
    viewport: { width: vw, height: vh },
    ignoreHTTPSErrors: true,
    ...(useAuth ? { storageState: authFile } : {}),
  }

  const results = []
  const errors = []

  function screenshotName(url, index) {
    const u = new URL(url)
    const baseName =
      u.pathname === '/' ? 'home' : u.pathname.replaceAll('/', '_').replace(/^_+/, '')
    const fileBase = sanitizeFilename(
      `${String(index + 1).padStart(4, '0')}_${baseName || 'page'}_${sha1(url)}`
    )
    return path.join(outDir, `${fileBase}.png`)
  }

  async function screenshotOne(url, index) {
    const context = await browser.newContext(baseContextOptions)
    const page = await context.newPage()

    try {
      const resp = await page.goto(url, { waitUntil, timeout: 60_000 })
      if (delayMs > 0) await page.waitForTimeout(delayMs)

      const filePath = screenshotName(url, index)
      const status = resp ? resp.status() : null

      await page.screenshot({ path: filePath, fullPage: true })

      const title = await page.title().catch(() => null)

      results.push({ url, status, title, screenshot: filePath })
      return { ok: true }
    } catch (e) {
      errors.push({ url, error: String(e?.message ?? e) })
      return { ok: false }
    } finally {
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }

  async function crawlFromSitemap() {
    try {
      const urls = await collectSitemapUrls({ sitemapUrl, origin, limit: sitemapLimit })
      return urls
    } catch (e) {
      console.warn(`Sitemap fetch failed (${sitemapUrl}): ${String(e?.message ?? e)}`)
      return []
    }
  }

  async function crawlFromLinks() {
    const visited = new Set()
    const queue = [{ url: startUrl.toString(), depth: 0 }]
    const collected = []

    // Use a single context for discovery for speed; screenshots still happen separately.
    const context = await browser.newContext(baseContextOptions)
    const page = await context.newPage()

    try {
      while (queue.length > 0 && collected.length < maxPages) {
        const { url, depth } = queue.shift()
        const normalized = normalizeUrl(url, origin)
        if (!normalized) continue
        if (visited.has(normalized)) continue

        visited.add(normalized)
        collected.push(normalized)

        if (depth >= maxDepth) continue

        try {
          await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 60_000 })
          const hrefs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href]'))
              .map((a) => a.getAttribute('href'))
              .filter(Boolean)
          )

          for (const href of hrefs) {
            if (href.startsWith('#')) continue
            const lower = href.toLowerCase()
            if (
              lower.startsWith('javascript:') ||
              lower.startsWith('mailto:') ||
              lower.startsWith('tel:')
            )
              continue

            let abs
            try {
              abs = new URL(href, normalized).toString()
            } catch {
              continue
            }

            const next = normalizeUrl(abs, origin)
            if (!next) continue
            if (visited.has(next)) continue

            queue.push({ url: next, depth: depth + 1 })
          }
        } catch {
          // discovery failures shouldn't stop collection; screenshots will log errors
        }
      }
    } finally {
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }

    return collected
  }

  let targetUrls = []
  if (mode === 'sitemap' || mode === 'both') {
    const sitemapUrls = await crawlFromSitemap()
    if (sitemapUrls.length > 0) targetUrls = sitemapUrls
    else if (mode === 'both') targetUrls = await crawlFromLinks()
    else {
      console.warn('No sitemap URLs found; falling back to link crawl.')
      targetUrls = await crawlFromLinks()
    }
  } else if (mode === 'links') {
    targetUrls = await crawlFromLinks()
  } else {
    console.error('Invalid --mode. Use sitemap|links|both')
    process.exit(1)
  }

  console.log(
    `Discovered ${targetUrls.length} URL(s). Taking screenshots with concurrency=${concurrency}...`
  )

  await runPool(targetUrls, concurrency, async (url, i) => screenshotOne(url, i))

  const summary = {
    start: startUrl.toString(),
    origin,
    mode,
    outDir,
    sitemapUrl: mode !== 'links' ? sitemapUrl : null,
    usedAuthFile: useAuth ? authFile : null,
    discovered: targetUrls.length,
    screenshots: results.length,
    errors: errors.length,
    generatedAt: new Date().toISOString(),
    results,
    errors,
  }

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  console.log(
    `Done. Screenshots: ${Number(summary.screenshots) || 0}. Errors: ${Number(summary.errors) || 0}.`
  )
  console.log(`Output folder: ${outDir}/ (see summary.json)`)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
