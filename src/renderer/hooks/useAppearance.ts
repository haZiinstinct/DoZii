import { useCallback, useEffect } from 'react'
import { useSettings } from '@/stores/SettingsProvider'
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
  const { settings, update } = useSettings()
  const fontScale: FontScale = settings?.fontScale ?? 'normal'
  const highContrast = settings?.highContrast ?? false

  useEffect(() => {
    applyAppearance(fontScale, highContrast)
  }, [fontScale, highContrast])

  const setFontScale = useCallback(
    async (next: FontScale) => {
      await update({ fontScale: next })
    },
    [update]
  )

  const setHighContrast = useCallback(
    async (next: boolean) => {
      await update({ highContrast: next })
    },
    [update]
  )

  return { fontScale, highContrast, setFontScale, setHighContrast }
}
