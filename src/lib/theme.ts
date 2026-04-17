export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'tw-theme'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system'

  try {
    const value = localStorage.getItem(THEME_KEY)
    if (isTheme(value)) return value
  } catch {
    return 'system'
  }

  return 'system'
}

export function setStoredTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(THEME_KEY, theme)
    if (typeof document !== 'undefined') {
      document.cookie = `${THEME_KEY}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`
    }
  } catch {
    return
  }
}

export function getServerThemeClass(theme: string | null | undefined): 'dark' | undefined {
  return theme === 'dark' ? 'dark' : undefined
}

export function resolveTheme(stored: Theme): 'light' | 'dark' {
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
