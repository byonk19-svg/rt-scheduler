'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { getStoredTheme, resolveTheme, setStoredTheme, type Theme } from '@/lib/theme'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(resolvedTheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(getStoredTheme())
  )

  useEffect(() => {
    setStoredTheme(theme)
  }, [theme])

  useEffect(() => {
    applyTheme(resolvedTheme)

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null

    if (!mediaQuery) return

    const handleChange = () => {
      const currentTheme = getStoredTheme()
      if (currentTheme !== 'system') return
      const nextTheme = resolveTheme('system')
      setResolvedTheme(nextTheme)
      applyTheme(nextTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme: Theme) => {
        setStoredTheme(nextTheme)
        const nextResolvedTheme = resolveTheme(nextTheme)
        setThemeState(nextTheme)
        setResolvedTheme(nextResolvedTheme)
        applyTheme(nextResolvedTheme)
      },
    }),
    [resolvedTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeProvider

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export function ThemePreferenceControl() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel="Theme preference"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <p className="text-xs text-muted-foreground">Currently showing: {resolvedTheme}</p>
    </div>
  )
}
