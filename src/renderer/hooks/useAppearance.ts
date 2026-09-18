import { useCallback, useEffect, useState } from 'react'
import type { FontScale } from '@shared/types'

/**
 * Schriftgroesse und Kontrast (Barrierefreiheit). Beides haengt als
 * data-Attribut am <html>-Element; die eigentliche Wirkung steckt in
 * globals.css. Vorteil: keine Komponente muss etwas davon wissen.
 *
 * Die Zielgruppe von DoZii sind unter anderem aeltere Menschen mit
 * Behoerdenpost - eine groessere Schrift ist hier kein Luxus.
 */
export function applyAppearance(fontScale: FontScale, highContrast: boolean): void {
  const root = document.documentElement
  if (fontScale === 'normal') {
    root.removeAttribute('data-font-scale')
  } else {
    root.setAttribute('data-font-scale', fontScale)
  }
  if (highContrast) {
    root.setAttribute('data-contrast', 'high')
  } else {
    root.removeAttribute('data-contrast')
  }
}

export function useAppearance() {
  const [fontScale, setFontScaleState] = useState<FontScale>('normal')
  const [highContrast, setHighContrastState] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.settings
      .get()
      .then((settings) => {
        if (cancelled) return
        setFontScaleState(settings.fontScale)
        setHighContrastState(settings.highContrast)
        applyAppearance(settings.fontScale, settings.highContrast)
      })
      .catch(() => {
        /* Defaults bleiben aktiv */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setFontScale = useCallback(
    async (next: FontScale) => {
      setFontScaleState(next)
      applyAppearance(next, highContrast)
      await window.api.settings.update({ fontScale: next })
    },
    [highContrast]
  )

  const setHighContrast = useCallback(
    async (next: boolean) => {
      setHighContrastState(next)
      applyAppearance(fontScale, next)
      await window.api.settings.update({ highContrast: next })
    },
    [fontScale]
  )

  return { fontScale, highContrast, setFontScale, setHighContrast }
}
