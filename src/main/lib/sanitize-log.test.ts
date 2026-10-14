import { describe, it, expect } from 'vitest'
import { sanitizeLogMessage, sanitizeLogMeta, sanitizeLogSource } from './sanitize-log'

describe('sanitizeLogMeta', () => {
  it('behaelt kurze technische Felder', () => {
    expect(sanitizeLogMeta({ format: 'pdf', lineno: 12, ok: false })).toEqual({
      format: 'pdf',
      lineno: 12,
      ok: false
    })
  })

  it('schneidet lange Texte ab', () => {
    const meta = sanitizeLogMeta({ error: 'x'.repeat(5000) })
    expect((meta?.error as string).length).toBeLessThan(400)
  })

  it('erlaubt laengere Stacks, aber begrenzt', () => {
    const meta = sanitizeLogMeta({ reason: { message: 'm', stack: 's'.repeat(10_000) } })
    const reason = meta?.reason as { stack: string }
    expect(reason.stack.length).toBeGreaterThan(1000)
    expect(reason.stack.length).toBeLessThan(2100)
  })

  it('verwirft Arrays, zu tiefe Objekte und Nicht-Objekte', () => {
    expect(sanitizeLogMeta({ list: [1, 2], deep: { a: { b: 1 } } })).toEqual({ deep: {} })
    expect(sanitizeLogMeta('text')).toBeUndefined()
    expect(sanitizeLogMeta([1])).toBeUndefined()
  })

  it('begrenzt die Anzahl der Felder', () => {
    const many = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(sanitizeLogMeta(many) ?? {})).toHaveLength(12)
  })
})

describe('sanitizeLogMessage / sanitizeLogSource', () => {
  it('kuerzt Nachrichten und ersetzt seltsame Quellen', () => {
    expect(sanitizeLogMessage('a'.repeat(1000)).length).toBeLessThan(400)
    expect(sanitizeLogSource('AnalysisPage')).toBe('AnalysisPage')
    expect(sanitizeLogSource('evil\nsource')).toBe('renderer')
  })
})
