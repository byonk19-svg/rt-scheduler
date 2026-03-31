import { readFileSync } from 'node:fs'
import path from 'node:path'

const envCache = new Map<string, string>()

export function getEnvFromFile(key: string): string | undefined {
  if (envCache.has(key)) return envCache.get(key)
  const envPath = path.resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) continue
      const parsedKey = trimmed.slice(0, eqIndex).trim()
      let parsedValue = trimmed.slice(eqIndex + 1).trim()
      if (
        (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
        (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
      ) {
        parsedValue = parsedValue.slice(1, -1)
      }
      envCache.set(parsedKey, parsedValue)
    }
  } catch {
    return undefined
  }
  return envCache.get(key)
}

export function getEnv(key: string): string | undefined {
  return process.env[key] ?? getEnvFromFile(key)
}

export function randomString(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function formatDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
