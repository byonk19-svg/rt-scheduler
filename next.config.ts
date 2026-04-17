import type { NextConfig } from 'next'

function toOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function buildContentSecurityPolicy(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)

  const connectSrc = new Set(["'self'"])
  if (supabaseOrigin) {
    connectSrc.add(supabaseOrigin)
    connectSrc.add(supabaseOrigin.replace(/^http/, 'ws'))
  }

  if (!isProduction) {
    connectSrc.add('http://localhost:*')
    connectSrc.add('ws://localhost:*')
    connectSrc.add('http://127.0.0.1:*')
    connectSrc.add('ws://127.0.0.1:*')
  }

  const scriptSrc = ["'self'", "'unsafe-inline'"]
  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'")
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
  ]

  return directives.join('; ')
}

const contentSecurityPolicy = buildContentSecurityPolicy()

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['@napi-rs/canvas', 'pdf-to-img', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/inbound/availability-email': [
      './node_modules/pdf-to-img/**/*',
      './node_modules/pdfjs-dist/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
