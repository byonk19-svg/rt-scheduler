#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const DEFAULT_ORIGIN = 'http://127.0.0.1:3000'
const DEFAULT_AUTH_FILE = '.auth/storageState.json'
const DEFAULT_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/reset-password',
  '/dashboard',
  '/coverage',
  '/availability',
  '/schedule',
  '/shift-board',
  '/team',
  '/requests/new',
  '/lottery',
]

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const [rawKey, rawValue] = token.includes('=') ? token.split('=', 2) : [token, argv[i + 1]]
    const key = rawKey.replace(/^--/, '')
    const value = token.includes('=')
      ? rawValue
      : argv[i + 1] && !argv[i + 1].startsWith('--')
        ? argv[++i]
        : 'true'
    args[key] = value
  }
  return args
}

function toBool(value, defaultValue) {
  if (value === undefined) return defaultValue
  const normalized = String(value).toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  return defaultValue
}

function parseRoutes(value) {
  if (!value) return DEFAULT_ROUTES
  return String(value)
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`))
}

function normalizeLoopbackHost(hostname) {
  const normalized = String(hostname)
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (['localhost', '127.0.0.1', '::1'].includes(normalized)) return 'loopback'
  return normalized
}

function cookieMatchesOrigin(cookie, originUrl) {
  const hostname = normalizeLoopbackHost(originUrl.hostname)
  const domain = String(cookie.domain ?? '').replace(/^\./, '')
  if (!domain) return false

  const normalizedDomain = normalizeLoopbackHost(domain)
  const domainMatches = hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
  if (!domainMatches) return false

  if (cookie.expires && cookie.expires > 0) {
    return cookie.expires * 1000 > Date.now()
  }

  return true
}

async function loadCookieHeader({ authFile, origin, enabled }) {
  if (!enabled) return null

  try {
    const storageState = JSON.parse(await readFile(authFile, 'utf8'))
    const originUrl = new URL(origin)
    const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : []
    const matchingCookies = cookies.filter((cookie) => cookieMatchesOrigin(cookie, originUrl))

    if (!matchingCookies.length) return null

    return matchingCookies
      .map((cookie) => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`)
      .join('; ')
  } catch {
    return null
  }
}

async function fetchWithTimeout(url, { cookieHeader, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'teamwise-local-warmup/1.0',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })
    await response.arrayBuffer()
    const elapsedMs = Math.round(performance.now() - startedAt)
    return {
      ok: true,
      status: response.status,
      location: response.headers.get('location'),
      elapsedMs,
    }
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    return {
      ok: false,
      status: 'ERR',
      location: error instanceof Error ? error.message : 'request failed',
      elapsedMs,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function printResult(route, result) {
  const status = String(result.status).padEnd(3, ' ')
  const elapsed = `${result.elapsedMs}ms`.padStart(8, ' ')
  const target = result.location ? ` -> ${result.location}` : ''
  console.log(`${status} ${elapsed} ${route}${target}`)
}

async function main() {
  const args = parseArgs(process.argv)
  const origin = String(args.origin ?? DEFAULT_ORIGIN).replace(/\/$/, '')
  const routes = parseRoutes(args.routes)
  const authFile = String(args['auth-file'] ?? DEFAULT_AUTH_FILE)
  const useAuth = toBool(args.auth, true)
  const timeoutMs = Number.parseInt(String(args.timeout ?? '30000'), 10)

  const cookieHeader = await loadCookieHeader({ authFile, origin, enabled: useAuth })

  console.log(`Warming ${routes.length} route(s) at ${origin}`)
  console.log(cookieHeader ? `Using auth cookies from ${authFile}` : 'No saved auth cookies found')

  for (const route of routes) {
    const url = new URL(route, origin).toString()
    const result = await fetchWithTimeout(url, { cookieHeader, timeoutMs })
    printResult(route, result)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
