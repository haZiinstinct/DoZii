import { describe, it, expect } from 'vitest'
import { withLanguageDirective } from './language-directive'
import { buildGrammarPrompt } from './grammar-check.prompt'
import { buildSummaryPrompt } from './summary.prompt'

describe('withLanguageDirective', () => {
  it('laesst de und en unveraendert (eigene handgepflegte Prompts)', () => {
    expect(withLanguageDirective('BASE', 'de')).toBe('BASE')
    expect(withLanguageDirective('BASE', 'en')).toBe('BASE')
  })

  it('haengt fuer andere Sprachen die Direktive mit dem englischen Sprachnamen an', () => {
    const out = withLanguageDirective('BASE', 'es')
    expect(out.startsWith('BASE')).toBe(true)
    expect(out).toContain('OUTPUT LANGUAGE')
    expect(out).toContain('Spanish')
  })

  it('nennt den korrekten Sprachnamen je Code', () => {
    expect(withLanguageDirective('B', 'ja')).toContain('Japanese')
    expect(withLanguageDirective('B', 'ar')).toContain('Arabic')
    expect(withLanguageDirective('B', 'zh')).toContain('Chinese')
  })
})

describe('Prompt-Bau mit Sprache', () => {
  it('de: deutsches Skelett, keine Direktive', () => {
    const { system } = buildGrammarPrompt('Test', 'de')
    expect(system).toContain('## Gesamtbewertung')
    expect(system).not.toContain('OUTPUT LANGUAGE')
  })

  it('es: englisches Parser-Skelett bleibt + Spanisch-Direktive', () => {
    const { system } = buildGrammarPrompt('Test', 'es')
    // Englisches Skelett, das parse-analysis erkennt:
    expect(system).toContain('## Overall Assessment')
    expect(system).toContain('## Error List')
    // Inhalt soll auf Spanisch ausgegeben werden:
    expect(system).toContain('Spanish')
  })

  it('summary ja: englisches Skelett + Japanisch-Direktive', () => {
    const { system } = buildSummaryPrompt('Test', 'ja')
    expect(system).toContain('## Document Type')
    expect(system).toContain('Japanese')
  })
})
