import { describe, it, expect } from 'vitest'
import de from './de.json'
import en from './en.json'

// Sammelt alle verschachtelten Key-Pfade (z.B. "settings.theme").
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? keyPaths(v as Record<string, unknown>, path)
      : [path]
  })
}

describe('i18n Key-Paritaet', () => {
  it('de.json und en.json haben denselben Key-Satz', () => {
    const deKeys = keyPaths(de).sort()
    const enKeys = keyPaths(en).sort()
    const missingInEn = deKeys.filter((k) => !enKeys.includes(k))
    const missingInDe = enKeys.filter((k) => !deKeys.includes(k))
    expect({ missingInEn, missingInDe }).toEqual({ missingInEn: [], missingInDe: [] })
  })

  it('keine leeren Werte', () => {
    const empty = keyPaths(de).filter((path) => {
      const val = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], de)
      return typeof val === 'string' && val.trim() === ''
    })
    expect(empty).toEqual([])
  })
})
