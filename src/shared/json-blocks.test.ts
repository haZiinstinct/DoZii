import { describe, it, expect } from 'vitest'
import { findJson, jsonCandidates } from './json-blocks'

const hasA = (o: Record<string, unknown>): boolean => 'a' in o

describe('jsonCandidates', () => {
  it('findet den eingezaeunten Block', () => {
    expect(jsonCandidates('Text\n```json\n{"a":1}\n```')).toEqual(['{"a":1}'])
  })

  it('findet auch nacktes JSON', () => {
    // Der Grund fuer dieses Modul: qwen3:4b schreibt das JSON ohne Zaun,
    // und der Parser hat eine komplett richtige Antwort weggeworfen.
    expect(jsonCandidates('Hier das Ergebnis:\n{"a":1}\nFertig.')).toContain('{"a":1}')
  })

  it('nimmt den letzten Block zuerst', () => {
    // Oben steht oft das Beispiel aus dem Prompt, unten die echte Antwort.
    const t = '```json\n{"a":"beispiel"}\n```\nund nun:\n```json\n{"a":"echt"}\n```'
    expect(jsonCandidates(t)[0]).toBe('{"a":"echt"}')
  })

  it('kommt mit verschachtelten Klammern zurecht', () => {
    const t = 'x {"a":{"b":{"c":1}},"d":2} y'
    expect(jsonCandidates(t)).toContain('{"a":{"b":{"c":1}},"d":2}')
  })

  it('laesst sich von Klammern in Zeichenketten nicht taeuschen', () => {
    const t = '{"a":"eine } Klammer im Text","b":1}'
    expect(jsonCandidates(t)).toContain(t)
  })

  it('laesst sich von maskierten Anfuehrungszeichen nicht taeuschen', () => {
    const t = '{"a":"er sagte \\"hallo\\"","b":1}'
    expect(jsonCandidates(t)).toContain(t)
  })

  it('liefert bei unvollstaendigem JSON nichts Kaputtes', () => {
    expect(jsonCandidates('{"a":1')).toEqual([])
  })
})

describe('findJson', () => {
  it('ueberspringt das Beispiel und nimmt die Antwort', () => {
    const t = 'Beispiel:\n```json\n{"schema":true}\n```\nAntwort:\n```json\n{"a":1}\n```'
    expect(findJson(t, hasA)).toEqual({ a: 1 })
  })

  it('findet die Antwort auch ohne Zaun hinter einem Gedankengang', () => {
    const t = 'Okay, ueberlegen wir.\n</think>\n\n{"a":1}'
    expect(findJson(t, hasA)).toEqual({ a: 1 })
  })

  it('liefert null, wenn nichts passt', () => {
    expect(findJson('gar kein JSON hier', hasA)).toBeNull()
    expect(findJson('```json\n{"b":2}\n```', hasA)).toBeNull()
  })

  it('stoert sich nicht an kaputtem JSON vor der Antwort', () => {
    expect(findJson('{"a": kaputt}\n{"a":1}', hasA)).toEqual({ a: 1 })
  })
})
