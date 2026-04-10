const MAX_TIMESTAMP_SKEW_SECONDS = 300

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i]! ^ b[i]!
  }
  return mismatch === 0
}

function decodeBase64(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'base64')
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function encodeBase64(value: ArrayBuffer): string {
  return Buffer.from(value).toString('base64')
}

function parseTimestamp(raw: string | null): number | null {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

async function sign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase64(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return encodeBase64(signature)
}

function extractV1Signatures(raw: string | null): string[] {
  if (!raw) return []

  return raw
    .split(/\s+/)
    .flatMap((chunk) => chunk.split(';'))
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('v1,'))
    .map((chunk) => chunk.slice(3))
    .filter((chunk) => chunk.length > 0)
}

export async function isValidResendWebhookRequest(
  request: Pick<Request, 'headers'>,
  payload: string
): Promise<boolean> {
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!signingSecret) return false

  const secret = signingSecret.startsWith('whsec_') ? signingSecret.slice(6) : signingSecret
  const messageId = request.headers.get('svix-id')
  const timestamp = parseTimestamp(request.headers.get('svix-timestamp'))
  const signatures = extractV1Signatures(request.headers.get('svix-signature'))

  if (!messageId || !timestamp || signatures.length === 0) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false
  }

  const expected = await sign(secret, `${messageId}.${timestamp}.${payload}`)
  const expectedBytes = new TextEncoder().encode(expected)

  return signatures.some((signature) =>
    timingSafeEqual(expectedBytes, new TextEncoder().encode(signature))
  )
}
