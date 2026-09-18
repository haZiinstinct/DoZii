import { describe, it, expect } from 'vitest'
import { splitIntoChunks, needsChunking, type TextChunk } from './chunk-text'

/** Konkatenation der eigenen Bereiche - muss immer den Originaltext ergeben. */
function reconstruct(text: string, chunks: TextChunk[]): string {
  return chunks.map((c) => text.slice(c.startChar, c.endChar)).join('')
}

/** Text aus gleich langen Woertern - Whitespace-Grenzen alle 5 Zeichen. */
function wordText(words: number): string {
  return 'wort '.repeat(words)
}

describe('needsChunking', () => {
  it('leerer Text braucht kein Chunking', () => {
    expect(needsChunking('', 10)).toBe(false)
  })

  it('erst oberhalb des Budgets wird gechunkt', () => {
    expect(needsChunking('x'.repeat(35), 10)).toBe(false) // 35 / 3.5 = genau 10 Tokens
    expect(needsChunking('x'.repeat(36), 10)).toBe(true)
    expect(needsChunking('x'.repeat(100), 100, 1)).toBe(false)
    expect(needsChunking('x'.repeat(101), 100, 1)).toBe(true)
  })

  it('charsPerToken verschiebt die Grenze', () => {
    expect(needsChunking('x'.repeat(100), 20, 1)).toBe(true)
    expect(needsChunking('x'.repeat(100), 20, 10)).toBe(false)
  })
})

describe('splitIntoChunks - Sonderfaelle', () => {
  it('leerer Text liefert ein leeres Array', () => {
    expect(splitIntoChunks('', { budgetTokens: 100 })).toEqual([])
  })

  it('Text unter Budget liefert genau einen Chunk mit dem Originaltext', () => {
    const text = 'Sehr geehrte Damen und Herren,\n\nanbei der Bescheid.\n'
    const chunks = splitIntoChunks(text, { budgetTokens: 1000 })
    expect(chunks).toEqual([{ index: 0, total: 1, text, startChar: 0, endChar: text.length }])
  })

  it('Text exakt auf Budget bleibt ein Chunk', () => {
    const text = 'x'.repeat(100)
    const chunks = splitIntoChunks(text, { budgetTokens: 100, charsPerToken: 1 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe(text)
  })
})

describe('splitIntoChunks - Verlustfreiheit', () => {
  it('rekonstruiert den Originaltext exakt (Absaetze)', () => {
    const text = Array.from(
      { length: 60 },
      (_, i) => `Absatz ${i}: Das ist ein Satz mit Inhalt. Und noch einer dazu.`
    ).join('\n\n')
    const chunks = splitIntoChunks(text, { budgetTokens: 200, charsPerToken: 1 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(reconstruct(text, chunks)).toBe(text)
  })

  it('Bereiche sind luecken- und ueberschneidungsfrei, index/total stimmen', () => {
    const text = wordText(500)
    const chunks = splitIntoChunks(text, { budgetTokens: 120, charsPerToken: 1, overlapTokens: 20 })
    expect(chunks[0].startChar).toBe(0)
    expect(chunks[chunks.length - 1].endChar).toBe(text.length)
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i)
      expect(c.total).toBe(chunks.length)
      expect(c.endChar).toBeGreaterThan(c.startChar)
      if (i > 0) expect(c.startChar).toBe(chunks[i - 1].endChar)
    })
  })

  it('sehr langer Text ohne jede Absatzgrenze bleibt verlustfrei', () => {
    const text = 'Dies ist ein Satz ohne Umbruch. '.repeat(400)
    const chunks = splitIntoChunks(text, { budgetTokens: 300, charsPerToken: 1 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(reconstruct(text, chunks)).toBe(text)
  })

  it('Text aus einem einzigen Riesenwort wird hart geschnitten, aber verlustfrei', () => {
    const text = 'x'.repeat(5000)
    const chunks = splitIntoChunks(text, {
      budgetTokens: 100,
      charsPerToken: 1,
      overlapTokens: 0
    })
    expect(chunks.length).toBeGreaterThan(1)
    expect(reconstruct(text, chunks)).toBe(text)
    expect(chunks.map((c) => c.text).join('')).toBe(text)
  })
})

describe('splitIntoChunks - Schnittgrenzen', () => {
  const opts = { budgetTokens: 100, charsPerToken: 1, overlapTokens: 0 }

  it('bevorzugt die Absatzgrenze', () => {
    const text = 'A'.repeat(80) + '\n\n' + 'B'.repeat(200)
    const chunks = splitIntoChunks(text, opts)
    expect(chunks[0].endChar).toBe(82)
    expect(chunks[0].text).toBe('A'.repeat(80) + '\n\n')
  })

  it('nimmt den Zeilenumbruch, wenn es keinen Absatz gibt', () => {
    const text = 'A'.repeat(80) + '\n' + 'B'.repeat(200)
    const chunks = splitIntoChunks(text, opts)
    expect(chunks[0].endChar).toBe(81)
    expect(chunks[0].text.endsWith('\n')).toBe(true)
  })

  it('nimmt das Satzende, wenn es keinen Umbruch gibt', () => {
    for (const mark of ['. ', '! ', '? ']) {
      const text = 'A'.repeat(78) + mark + 'B'.repeat(200)
      const chunks = splitIntoChunks(text, opts)
      expect(chunks[0].endChar).toBe(80)
      expect(chunks[0].text.endsWith(mark)).toBe(true)
    }
  })

  it('schneidet nie mitten im Wort, solange es Whitespace gibt', () => {
    const text = wordText(400)
    const chunks = splitIntoChunks(text, { budgetTokens: 90, charsPerToken: 1, overlapTokens: 0 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks.slice(0, -1)) {
      expect(/\s/.test(text[c.endChar - 1])).toBe(true)
    }
    expect(reconstruct(text, chunks)).toBe(text)
  })
})

describe('splitIntoChunks - maxChunks', () => {
  it('haelt den Deckel ein, indem die Chunks groesser werden', () => {
    const text = 'Absatz mit etwas Inhalt darin.\n\n'.repeat(200)
    const chunks = splitIntoChunks(text, { budgetTokens: 150, charsPerToken: 1, maxChunks: 3 })
    expect(chunks).toHaveLength(3)
    expect(reconstruct(text, chunks)).toBe(text)
  })

  it('verliert auch bei sehr kleinem Budget und kleinem Deckel keinen Text', () => {
    const text = wordText(1000)
    const chunks = splitIntoChunks(text, {
      budgetTokens: 20,
      charsPerToken: 1,
      overlapTokens: 5,
      maxChunks: 4
    })
    expect(chunks.length).toBeLessThanOrEqual(4)
    expect(reconstruct(text, chunks)).toBe(text)
  })

  it('maxChunks 1 liefert genau einen Chunk mit dem gesamten Text', () => {
    const text = wordText(300)
    const chunks = splitIntoChunks(text, { budgetTokens: 50, charsPerToken: 1, maxChunks: 1 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe(text)
    expect(chunks[0].endChar).toBe(text.length)
  })
})

describe('splitIntoChunks - Ueberlappung', () => {
  it('stellt dem Chunk Text vom Ende des vorherigen voran', () => {
    const text = wordText(500)
    const overlapTokens = 25
    const chunks = splitIntoChunks(text, { budgetTokens: 120, charsPerToken: 1, overlapTokens })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks.slice(1)) {
      const own = text.slice(c.startChar, c.endChar)
      expect(c.text.endsWith(own)).toBe(true)
      const prefix = c.text.slice(0, c.text.length - own.length)
      expect(prefix.length).toBeGreaterThan(0)
      expect(prefix.length).toBeLessThanOrEqual(overlapTokens)
      expect(text.slice(0, c.startChar).endsWith(prefix)).toBe(true)
    }
  })

  it('die Ueberlappung beginnt nicht mitten im Wort', () => {
    const text = wordText(500)
    const chunks = splitIntoChunks(text, { budgetTokens: 120, charsPerToken: 1, overlapTokens: 25 })
    for (const c of chunks.slice(1)) {
      const own = text.slice(c.startChar, c.endChar)
      const from = c.startChar - (c.text.length - own.length)
      expect(from === 0 || /\s/.test(text[from - 1])).toBe(true)
    }
  })

  it('overlapTokens 0 liefert genau den eigenen Bereich', () => {
    const text = wordText(400)
    const chunks = splitIntoChunks(text, { budgetTokens: 100, charsPerToken: 1, overlapTokens: 0 })
    for (const c of chunks) {
      expect(c.text).toBe(text.slice(c.startChar, c.endChar))
    }
  })

  it('der erste Chunk hat nie eine Ueberlappung', () => {
    const text = wordText(400)
    const chunks = splitIntoChunks(text, { budgetTokens: 100, charsPerToken: 1, overlapTokens: 30 })
    expect(chunks[0].startChar).toBe(0)
    expect(chunks[0].text).toBe(text.slice(0, chunks[0].endChar))
  })
})
