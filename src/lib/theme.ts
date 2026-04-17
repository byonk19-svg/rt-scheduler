export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'tw-theme'

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system'

  try {
    const value = localStorage.getItem(THEME_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    return 'system'
  }

  return 'system'
}

export function setStoredTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    return
  }
}

export function resolveTheme(stored: Theme): 'light' | 'dark' {
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
