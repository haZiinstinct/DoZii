import { describe, it, expect } from 'vitest'
import { buildPrompt, documentTokenBudget } from './prompt-builder'
import { TRUNCATION_MARKER } from './token-budget'
import { ANALYSIS_MODES } from '@shared/types'

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

  it('jeder angebotene Modus liefert System- und User-Prompt mit Parametern', () => {
    for (const mode of ANALYSIS_MODES) {
      const result = buildPrompt(mode, 'Testdokument Inhalt.', 'de', {
        userQuestion: 'Was steht drin?'
      })
      expect(result.system.length).toBeGreaterThan(0)
      expect(result.user).toContain('Testdokument Inhalt.')
      expect(result.temperature).toBeGreaterThan(0)
      expect(result.numCtx).toBeGreaterThan(0)
    }
  })

  it('freeform baut die Nutzerfrage ein', () => {
    const result = buildPrompt('freeform', 'Dokument.', 'de', {
      userQuestion: 'Meine spezielle Frage?'
    })
    expect(result.system + result.user).toContain('Meine spezielle Frage?')
  })

  it('letter baut Briefart, Notizen und Vor-Analyse ein', () => {
    const result = buildPrompt('letter', 'Bescheid vom 01.03.2026.', 'de', {
      letterKind: 'widerspruch',
      userNotes: 'Mein Aktenzeichen ist XY-42.',
      priorAnalysis: '{"contentGrade":{"grade":3}}',
      todayIso: '2026-03-10'
    })
    const all = result.system + result.user
    expect(all).toContain('XY-42')
    expect(all).toContain('Widerspruch')
    expect(all.toLowerCase()).toContain('rechtsberatung')
  })

  it('ein groesseres Kontextfenster verhindert das Kuerzen', () => {
    // ~40k Zeichen: passt nicht in 8192 Tokens, aber in 32768.
    const longText = 'Absatz mit Inhalt. '.repeat(2100)
    const small = buildPrompt('plain', longText, 'de')
    const large = buildPrompt('plain', longText, 'de', { numCtx: 32_768 })
    expect(small.truncated).toBe(true)
    expect(large.truncated).toBe(false)
    expect(large.numCtx).toBe(32_768)
  })

  it('documentTokenBudget laesst Platz fuer Prompt-Geruest und Antwort', () => {
    // Bei 16k passt das Zeugnis-Geruest (~4300 Tokens), die gemessene
    // Antwort-Reserve (6000) und noch Dokument hinein.
    const budget = documentTokenBudget('arbeitszeugnis', 'de', 16_384)
    expect(budget).toBeGreaterThan(0)
    expect(budget).toBeLessThan(16_384)
    // Das Zeugnis-Geruest ist gross - Budget deutlich kleiner als bei einem
    // schlanken Modus, der ausserdem weniger Antwort-Reserve braucht.
    expect(budget).toBeLessThan(documentTokenBudget('freeform', 'de', 16_384))
  })

  it('bei 8192 bleibt fuer ein Zeugnis kein Dokument uebrig', () => {
    // Genau deshalb hebt resolveNumCtx das Fenster fuer diesen Modus an:
    // Geruest ~4300 plus 6000 Antwort-Reserve sprengen 8192 schon ohne Text.
    expect(documentTokenBudget('arbeitszeugnis', 'de', 8192)).toBe(0)
  })
})
