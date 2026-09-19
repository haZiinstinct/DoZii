import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'

/**
 * Nur Deutsch und Englisch liegen fest im Start-Bundle: Deutsch ist die
 * Standardsprache, Englisch die Rueckfallebene. Die uebrigen sieben Sprachen
 * sind zusammen rund 180 KB und wuerden den App-Start fuer alle verlangsamen,
 * obwohl jeder Nutzer nur eine davon braucht - sie werden beim Umschalten
 * nachgeladen.
 */
const LAZY_LANGUAGES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  pt: () => import('./pt.json'),
  ru: () => import('./ru.json'),
  ar: () => import('./ar.json'),
  ja: () => import('./ja.json'),
  zh: () => import('./zh.json')
}

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en }
  },
  lng: 'de',
  // Fehlt ein Key in einer Sprache, faellt er auf Englisch zurueck (statt den
  // rohen Key anzuzeigen). de bleibt zweite Stufe fuer DE-spezifische Begriffe.
  fallbackLng: ['en', 'de'],
  interpolation: {
    escapeValue: false
  }
})

/**
 * Stellt sicher, dass die Texte einer Sprache geladen sind. Muss VOR
 * `changeLanguage` gerufen werden - sonst zeigt die Oberflaeche kurz die
 * englische Rueckfallebene.
 *
 * Schlaegt das Nachladen fehl (kaputtes Bundle), bleibt es bei Englisch:
 * eine englische Oberflaeche ist besser als eine leere.
 */
export async function ensureLanguageLoaded(code: string): Promise<void> {
  if (i18n.hasResourceBundle(code, 'translation')) return
  const load = LAZY_LANGUAGES[code]
  if (!load) return
  try {
    const module = await load()
    i18n.addResourceBundle(code, 'translation', module.default, true, true)
  } catch {
    /* Rueckfall auf Englisch greift automatisch */
  }
}

/** Sprache laden und umschalten - der Weg, den die Oberflaeche nehmen soll. */
export async function switchLanguage(code: string): Promise<void> {
  await ensureLanguageLoaded(code)
  await i18n.changeLanguage(code)
}

export default i18n
