import { describe, it, expect } from 'vitest'
import { friendlyError } from './_error-mapping'

// Gerüst-Test: stellt sicher, dass die Test-Pipeline läuft.
// Umfangreiche Suiten folgen mit den Robustheits-Erweiterungen.
describe('friendlyError', () => {
  it('reicht unbekannte Fehlermeldungen durch', () => {
    const result = friendlyError('voellig unbekannter fehler')
    expect(result).toBe('voellig unbekannter fehler')
  })

  it('erkennt fehlendes Modell', () => {
    const result = friendlyError('model "qwen2.5:7b" not found')
    expect(result).toContain('nicht installiert')
  })
})
