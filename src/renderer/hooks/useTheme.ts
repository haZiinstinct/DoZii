import { useEffect, useState, useCallback } from 'react'
import type { ThemeMode } from '@shared/types'

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

function resolveEffective(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [effective, setEffective] = useState<'dark' | 'light'>('dark')

  // Load persisted setting on mount
  useEffect(() => {
    let cancelled = false
    window.api.settings.get().then((settings) => {
      if (cancelled) return
      setModeState(settings.theme)
      const eff = resolveEffective(settings.theme)
      setEffective(eff)
      applyTheme(eff)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      const eff = mql.matches ? 'light' : 'dark'
      setEffective(eff)
      applyTheme(eff)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next)
    const eff = resolveEffective(next)
    setEffective(eff)
    applyTheme(eff)
    await window.api.settings.update({ theme: next })
  }, [])

  return { mode, effective, setMode }
}
