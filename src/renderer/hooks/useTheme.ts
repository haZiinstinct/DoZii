import { useEffect, useState, useCallback } from 'react'
import type { ThemeMode } from '@shared/types'
import { useSettings } from '@/stores/SettingsProvider'

/**
 * Theme management. The CSS tokens are defined for dark-first in globals.css;
 * the light variant is applied via a `data-theme="light"` attribute on <html>.
 * System-mode listens to the OS media query.
 */

function applyTheme(effective: 'dark' | 'light'): void {
  const root = document.documentElement
  if (effective === 'light') {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}

export function useTheme() {
  const { settings, update } = useSettings()
  const mode: ThemeMode = settings?.theme ?? 'dark'
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia('(prefers-color-scheme: light)').matches
  )
  const effective: 'dark' | 'light' = mode === 'system' ? (systemLight ? 'light' : 'dark') : mode

  useEffect(() => {
    applyTheme(effective)
  }, [effective])

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (): void => setSystemLight(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  const setMode = useCallback(
    async (next: ThemeMode) => {
      await update({ theme: next })
    },
    [update]
  )

  return { mode, effective, setMode }
}
