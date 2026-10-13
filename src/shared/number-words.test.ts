import { describe, it, expect } from 'vitest'
import { NUMBER_WORD_PATTERN, numberWordValue } from './number-words'

describe('number-words', () => {
  it('kennt die Zahlwoerter beider Radare', () => {
    expect(numberWordValue('vierzehn')).toBe(14)
    expect(numberWordValue('Fünf')).toBe(5)
    expect(numberWordValue('einem')).toBe(1)
    expect(numberWordValue('vierundzwanzig')).toBe(24)
    expect(numberWordValue('viele')).toBeUndefined()
  })

  it('trifft das laengste Zahlwort zuerst', () => {
    const m = new RegExp(`(${NUMBER_WORD_PATTERN}) Tage`).exec('binnen vierzehn Tage')
    expect(m?.[1]).toBe('vierzehn')
  })
})
