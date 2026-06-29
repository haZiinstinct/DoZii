/**
 * Single Source of Truth fuer alle von DoZii unterstuetzten Sprachen.
 * Vorher verstreut: settings.service (Validierungs-Array), SettingsPage
 * (hardcodierte Labels), i18n/index (resources). Jetzt eine Liste, aus der
 * sich Typ, Validierung, UI-Switcher und Prompt-Sprache ableiten.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 *
 * - nativeName: Eigenbezeichnung der Sprache fuer den Umschalter.
 * - englishName: englischer Name fuer die LLM-Sprach-Direktive (Phase 4).
 * - dir: Schreibrichtung; 'rtl' nur fuer Arabisch.
 */

export interface LanguageMeta {
  code: string
  nativeName: string
  englishName: string
  dir: 'ltr' | 'rtl'
}

export const SUPPORTED_LANGUAGES = [
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese (Simplified)', dir: 'ltr' }
] as const satisfies readonly LanguageMeta[]

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

/** Alle gueltigen Sprach-Codes (Reihenfolge wie im Umschalter). */
export const LANGUAGE_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code)

function find(code: string): LanguageMeta | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)
}

/** true, wenn die Sprache rechts-nach-links geschrieben wird (Arabisch). */
export function isRtl(code: string): boolean {
  return find(code)?.dir === 'rtl'
}

/** Englischer Sprachname fuer die LLM-Direktive; Fallback 'English'. */
export function englishNameFor(code: string): string {
  return find(code)?.englishName ?? 'English'
}

/** Eigenbezeichnung fuer die UI; Fallback auf den Code selbst. */
export function nativeNameFor(code: string): string {
  return find(code)?.nativeName ?? code
}
