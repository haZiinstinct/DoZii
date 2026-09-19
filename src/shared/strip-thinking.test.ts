import { describe, it, expect } from 'vitest'
import { stripThinking } from './strip-thinking'

describe('stripThinking', () => {
  it('entfernt einen abgeschlossenen Denkblock', () => {
    expect(stripThinking('<think>Erst ueberlegen</think>\n```json\n{"a":1}\n```')).toBe(
      '```json\n{"a":1}\n```'
    )
  })

  it('entfernt einen unabgeschlossenen Denkblock bis zum Ende', () => {
    // Sonst bleibt der halbe Gedankengang als vermeintliche Antwort stehen.
    expect(stripThinking('Antwort.\n<think>Das Modell wurde mitten im Satz')).toBe('Antwort.')
  })

  it('kennt auch die anderen Schreibweisen', () => {
    expect(stripThinking('<thinking>x</thinking>ja')).toBe('ja')
    expect(stripThinking('<reasoning>x</reasoning>ja')).toBe('ja')
  })

  it('laesst eine normale Antwort unveraendert', () => {
    const t = '## Ergebnis\n\nDas ist die Antwort.'
    expect(stripThinking(t)).toBe(t)
  })

  it('haelt mehrere Bloecke aus', () => {
    expect(stripThinking('<think>a</think>A<think>b</think>B')).toBe('AB')
  })
})
