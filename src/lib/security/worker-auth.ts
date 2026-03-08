const WORKER_PATH = '/api/publish/process'
const WORKER_KEY_HEADER = 'x-publish-worker-key'
const WORKER_TIMESTAMP_HEADER = 'x-publish-worker-timestamp'
const WORKER_SIGNATURE_HEADER = 'x-publish-worker-signature'
const MAX_TIMESTAMP_SKEW_SECONDS = 300

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function getPathname(url: string): string | null {
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

function parseUnixTimestamp(raw: string | null): number | null {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function buildSignaturePayload(
  request: Pick<Request, 'method' | 'url'>,
  timestamp: number
): string {
  const pathname = getPathname(request.url) ?? ''
  return [request.method.toUpperCase(), pathname, String(timestamp)].join('\n')
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(signature)
}

export async function isValidPublishWorkerRequest(
  request: Pick<Request, 'headers' | 'method' | 'url'>
): Promise<boolean> {
  const expectedWorkerKey = process.env.PUBLISH_WORKER_KEY
  const signingKey = process.env.PUBLISH_WORKER_SIGNING_KEY
  if (!expectedWorkerKey || !signingKey) return false

  const workerKeyHeader = request.headers.get(WORKER_KEY_HEADER)
  if (!workerKeyHeader || !timingSafeEqual(workerKeyHeader, expectedWorkerKey)) {
    return false
  }

  const pathname = getPathname(request.url)
  if (pathname !== WORKER_PATH) {
    return false
  }

  const timestamp = parseUnixTimestamp(request.headers.get(WORKER_TIMESTAMP_HEADER))
  if (!timestamp) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false
  }

  const providedSignature = request.headers.get(WORKER_SIGNATURE_HEADER)
  if (!providedSignature) return false

  const payload = buildSignaturePayload(request, timestamp)
  const expectedSignature = await hmacSha256Hex(signingKey, payload)
  return timingSafeEqual(providedSignature.toLowerCase(), expectedSignature)
}
