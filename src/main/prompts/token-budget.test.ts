import { describe, it, expect } from 'vitest'
import { estimateTokens, fitTextToTokenBudget, TRUNCATION_MARKER } from './token-budget'

describe('estimateTokens', () => {
  it('schaetzt ~1 Token pro 3.5 Zeichen', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a'.repeat(35))).toBe(10)
    expect(estimateTokens('a')).toBe(1)
  })
})

describe('fitTextToTokenBudget', () => {
  it('laesst Text unter Budget unveraendert', () => {
    const text = 'Kurzer Text.'
    const result = fitTextToTokenBudget(text, 1000)
    expect(result.truncated).toBe(false)
    expect(result.text).toBe(text)
  })

  it('kuerzt Text ueber Budget und haengt Marker an', () => {
    const text = 'Wort '.repeat(10_000) // ~50k Zeichen
    const result = fitTextToTokenBudget(text, 1000)
    expect(result.truncated).toBe(true)
    expect(result.text.endsWith(TRUNCATION_MARKER)).toBe(true)
    expect(result.text.length).toBeLessThan(text.length)
    // Budget grob eingehalten (3.5 Zeichen/Token)
    expect(result.text.length).toBeLessThanOrEqual(1000 * 3.5 + 10)
  })

  it('schneidet bevorzugt an einer Absatzgrenze', () => {
    const paragraph = 'Satz eins. Satz zwei. Satz drei.'
    const text = Array.from({ length: 500 }, () => paragraph).join('\n\n')
    const result = fitTextToTokenBudget(text, 500)
    expect(result.truncated).toBe(true)
    const cut = result.text.slice(0, -TRUNCATION_MARKER.length)
    // Endet an einer Satz- oder Absatzgrenze, nicht mitten im Wort
    expect(/[.\n]\s*$/.test(cut)).toBe(true)
  })
})
