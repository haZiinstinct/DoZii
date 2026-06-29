import { isRtl } from '@shared/languages'

/**
 * Setzt Schreibrichtung (dir) und lang-Attribut auf das <html>-Element passend
 * zur Sprache. Arabisch -> rtl, alles andere -> ltr. Tailwind v4 + logische
 * Klassen (ms-/me-/ps-/pe-/start-/end-) spiegeln dann automatisch.
 *
 * Bewusst eine imperative Funktion (kein Hook): wird sowohl beim App-Start
 * (App.tsx) als auch beim manuellen Wechsel (LanguageSwitcher/SettingsPage)
 * aufgerufen. Vorbild: applyTheme in useTheme.ts.
 */
export function applyLanguageDirection(code: string): void {
  const root = document.documentElement
  root.dir = isRtl(code) ? 'rtl' : 'ltr'
  root.lang = code
}
