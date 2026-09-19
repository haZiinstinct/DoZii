import { describe, it, expect } from 'vitest'
import { escapeLikePattern, LIKE_ESCAPE_CHAR } from './like-pattern'

const BACKSLASH = String.fromCharCode(92)

describe('escapeLikePattern', () => {
  it('laesst harmlosen Text unveraendert', () => {
    expect(escapeLikePattern('bescheid jobcenter')).toBe('bescheid jobcenter')
  })

  it('entschaerft Prozent und Unterstrich', () => {
    expect(escapeLikePattern('50%')).toBe(`50${BACKSLASH}%`)
    expect(escapeLikePattern('a_b')).toBe(`a${BACKSLASH}_b`)
  })

  it('entschaerft den Backslash selbst', () => {
    expect(escapeLikePattern(BACKSLASH)).toBe(BACKSLASH + BACKSLASH)
  })

  it('das Escape-Zeichen ist genau ein Zeichen', () => {
    // SQLite wirft "ESCAPE expression must be a single character",
    // wenn hier je etwas anderes stehen sollte.
    expect(LIKE_ESCAPE_CHAR).toHaveLength(1)
    expect(LIKE_ESCAPE_CHAR.charCodeAt(0)).toBe(92)
  })

  it('leerer Text bleibt leer', () => {
    expect(escapeLikePattern('')).toBe('')
  })

  it('Umlaute bleiben unangetastet', () => {
    expect(escapeLikePattern('Säumniszuschlag')).toBe('Säumniszuschlag')
  })
})
