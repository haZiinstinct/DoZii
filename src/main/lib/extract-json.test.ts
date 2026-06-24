import { describe, it, expect } from 'vitest'
import { extractJsonObject } from './extract-json'

describe('extractJsonObject', () => {
  it('parst reines JSON', () => {
    expect(extractJsonObject('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('parst JSON aus einem ```json-Codefence', () => {
    const raw = 'Hier ist das Ergebnis:\n```json\n{"grade":2}\n```\nDanke.'
    expect(extractJsonObject(raw)).toEqual({ grade: 2 })
  })

  it('ignoriert Beispiel-JSON VOR dem echten Block (kein greedy-Fehlparse)', () => {
    // Frueher: /{...}/ matchte vom ersten { bis letzten } -> Parse-Fehler.
    const raw = 'z.B. {"x": 1} ist ein Beispiel. Echte Antwort: {"result": {"ok": true}}'
    expect(extractJsonObject(raw)).toEqual({ result: { ok: true } })
  })

  it('nimmt den letzten gueltigen Codefence', () => {
    const raw = '```json\n{"first":1}\n```\nund\n```json\n{"second":2}\n```'
    expect(extractJsonObject(raw)).toEqual({ second: 2 })
  })

  it('behandelt geschweifte Klammern in Strings korrekt', () => {
    expect(extractJsonObject('{"text":"a {nested} brace"}')).toEqual({ text: 'a {nested} brace' })
  })

  it('liefert null bei fehlendem/kaputtem JSON', () => {
    expect(extractJsonObject('kein json hier')).toBeNull()
    expect(extractJsonObject('{kaputt:')).toBeNull()
    expect(extractJsonObject('')).toBeNull()
  })

  it('ignoriert reine Arrays (erwartet Objekt)', () => {
    expect(extractJsonObject('[1,2,3]')).toBeNull()
  })
})
