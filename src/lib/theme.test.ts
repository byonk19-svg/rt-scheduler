import { describe, expect, it, vi } from 'vitest'

import { getStoredTheme, resolveTheme, setStoredTheme, THEME_KEY } from '@/lib/theme'

describe('theme helpers', () => {
  it('resolves explicit light and dark themes directly', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system theme from prefers-color-scheme', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
    })

    expect(resolveTheme('system')).toBe('dark')

    vi.unstubAllGlobals()
  })

  it('reads and writes the stored theme key', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
    })

    expect(getStoredTheme()).toBe('system')
    setStoredTheme('dark')
    expect(store.get(THEME_KEY)).toBe('dark')
    expect(getStoredTheme()).toBe('dark')

    vi.unstubAllGlobals()
  })
})
