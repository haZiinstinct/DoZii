import { describe, it, expect } from 'vitest'
import { buildPrompt } from './prompt-builder'
import { TRUNCATION_MARKER } from './token-budget'

describe('buildPrompt', () => {
  it('kleine Dokumente bleiben ungekuerzt', () => {
    const result = buildPrompt('summary', 'Ein kurzes Dokument.', 'de')
    expect(result.truncated).toBe(false)
    expect(result.user).toContain('Ein kurzes Dokument.')
    expect(result.numCtx).toBe(8192)
  })

  it('riesige Dokumente werden gekuerzt statt num_ctx zu sprengen', () => {
    const hugeText = 'Dies ist ein sehr langer Absatz mit vielen Worten. '.repeat(2000) // ~100k Zeichen
    const result = buildPrompt('summary', hugeText, 'de')
    expect(result.truncated).toBe(true)
    expect(result.user).toContain(TRUNCATION_MARKER.trim().slice(0, 20))
    expect(result.user.length).toBeLessThan(hugeText.length)
  })

  it('jeder Modus liefert System- und User-Prompt mit Parametern', () => {
    const modes = ['grammar', 'formulation', 'arbeitszeugnis', 'summary', 'freeform'] as const
    for (const mode of modes) {
      const result = buildPrompt(mode, 'Testdokument Inhalt.', 'de', 'Was steht drin?')
      expect(result.system.length).toBeGreaterThan(0)
      expect(result.user).toContain('Testdokument Inhalt.')
      expect(result.temperature).toBeGreaterThan(0)
      expect(result.numCtx).toBeGreaterThan(0)
    }
  })

  it('freeform baut die Nutzerfrage ein', () => {
    const result = buildPrompt('freeform', 'Dokument.', 'de', 'Meine spezielle Frage?')
    expect(result.system + result.user).toContain('Meine spezielle Frage?')
  })
})
