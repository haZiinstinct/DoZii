import { describe, it, expect } from 'vitest'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import pt from './pt.json'
import ru from './ru.json'
import ar from './ar.json'
import ja from './ja.json'
import zh from './zh.json'
import { LANGUAGE_CODES } from '@shared/languages'

const RESOURCES: Record<string, Record<string, unknown>> = { de, en, es, fr, pt, ru, ar, ja, zh }

// i18next-Plural-Suffixe. Sprachen haben unterschiedliche Plural-Kategorien
// (ar: 6, ru: 4, de/en/es/fr/pt: 2, ja/zh: 1), deshalb vergleichen wir
// BASE-Keys (Suffix entfernt) statt exakter Keys.
const PLURAL_RE = /_(zero|one|two|few|many|other)$/

// Sammelt alle verschachtelten Key-Pfade (z.B. "settings.theme").
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? keyPaths(v as Record<string, unknown>, path)
      : [path]
  })
}

const baseKey = (k: string): string => k.replace(PLURAL_RE, '')
const valueAt = (obj: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)
const placeholders = (v: unknown): string[] =>
  typeof v === 'string' ? [...v.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort() : []

const deKeys = keyPaths(de)
const deBase = [...new Set(deKeys.map(baseKey))].sort()
const dePluralBases = [...new Set(deKeys.filter((k) => PLURAL_RE.test(k)).map(baseKey))]

describe('i18n Key-Paritaet (alle Sprachen)', () => {
  it('SUPPORTED_LANGUAGES und i18n-Ressourcen sind deckungsgleich', () => {
    expect([...LANGUAGE_CODES].sort()).toEqual(Object.keys(RESOURCES).sort())
  })

  for (const code of Object.keys(RESOURCES)) {
    if (code === 'de') continue
    describe(code, () => {
      const keys = keyPaths(RESOURCES[code])
      const base = [...new Set(keys.map(baseKey))].sort()

      it('hat denselben Base-Key-Satz wie de', () => {
        const missing = deBase.filter((b) => !base.includes(b))
        const extra = base.filter((b) => !deBase.includes(b))
        expect({ missing, extra }).toEqual({ missing: [], extra: [] })
      })

      it('jede Plural-Base hat mindestens die _other-Form', () => {
        const noOther = dePluralBases.filter((b) => !keys.includes(`${b}_other`))
        expect(noOther).toEqual([])
      })

      it('Platzhalter ({{count}} etc.) stimmen mit de ueberein', () => {
        const mismatch = deKeys
          .filter((k) => !PLURAL_RE.test(k) && keys.includes(k))
          .filter(
            (k) =>
              placeholders(valueAt(de, k)).join() !==
              placeholders(valueAt(RESOURCES[code], k)).join()
          )
        expect(mismatch).toEqual([])
      })

      it('keine leeren Werte', () => {
        const empty = keys.filter((k) => {
          const v = valueAt(RESOURCES[code], k)
          return typeof v === 'string' && v.trim() === ''
        })
        expect(empty).toEqual([])
      })
    })
  }
})
