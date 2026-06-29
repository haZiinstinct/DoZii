import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_CODES,
  isRtl,
  englishNameFor,
  nativeNameFor
} from './languages'

describe('languages', () => {
  it('enthaelt die 9 erwarteten Sprachen', () => {
    expect([...LANGUAGE_CODES].sort()).toEqual(
      ['ar', 'de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'].sort()
    )
  })

  it('jede Sprache hat code, nativeName, englishName und gueltige dir', () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(l.code).toBeTruthy()
      expect(l.nativeName).toBeTruthy()
      expect(l.englishName).toBeTruthy()
      expect(['ltr', 'rtl']).toContain(l.dir)
    }
  })

  it('nur Arabisch ist RTL', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('de')).toBe(false)
    expect(isRtl('en')).toBe(false)
    expect(LANGUAGE_CODES.filter((c) => isRtl(c))).toEqual(['ar'])
  })

  it('englishNameFor mappt korrekt und faellt auf English zurueck', () => {
    expect(englishNameFor('es')).toBe('Spanish')
    expect(englishNameFor('ja')).toBe('Japanese')
    expect(englishNameFor('xx')).toBe('English')
  })

  it('nativeNameFor liefert Eigenbezeichnung, Fallback auf Code', () => {
    expect(nativeNameFor('de')).toBe('Deutsch')
    expect(nativeNameFor('ar')).toBe('العربية')
    expect(nativeNameFor('xx')).toBe('xx')
  })
})
