import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type Palette = 'iris' | 'plum' | 'periwinkle'

const THEME_KEY = 'dp-theme'
const PALETTE_KEY = 'dp-palette'

function readAttr(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return document.documentElement.getAttribute(name) || fallback
}

/** Theme + palette switcher backed by data-attributes on <html>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (readAttr('data-theme', 'light') as Theme) || 'light',
  )
  const [palette, setPalette] = useState<Palette>(
    () => (readAttr('data-palette', 'iris') as Palette) || 'iris',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette)
    try {
      localStorage.setItem(PALETTE_KEY, palette)
    } catch {
      /* ignore */
    }
  }, [palette])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle, palette, setPalette }
}
