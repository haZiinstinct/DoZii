import { describe, it, expect } from 'vitest'
import {
  parseGrammar,
  parseArbeitszeugnis,
  stripTrailingJsonBlock,
  isInDocument
} from './parse-analysis'

const GRAMMAR_MD = `
## Gesamtbewertung
**Anzahl Fehler:** 2
**Qualität:** Gut
**Kurzfassung:** Wenige Fehler.

## Fehler-Liste

### 1. Rechtschreibung (Schwere: hoch)
**Original:** Das ist ein Fehlar.
**Korrektur:** Das ist ein Fehler.
**Regel:** Rechtschreibung

### 2. Grammatik (Schwere: niedrig)
**Original:** Wir gehen in die Kino.
**Korrektur:** Wir gehen ins Kino.
`

describe('parseGrammar', () => {
  it('parst Gesamtbewertung und Fehlerliste', () => {
    const result = parseGrammar(GRAMMAR_MD)
    expect(result).not.toBeNull()
    expect(result!.overall.errorCount).toBe(2)
    expect(result!.overall.quality).toBe('Gut')
    expect(result!.errors).toHaveLength(2)
    expect(result!.errors[0].severity).toBe('high')
    expect(result!.errors[0].original).toBe('Das ist ein Fehlar.')
    expect(result!.errors[1].severity).toBe('low')
  })

  it('liefert null ohne Gesamtbewertungs-Sektion (Fallback auf Roh-Markdown)', () => {
    expect(parseGrammar('Nur freier Text ohne Struktur.')).toBeNull()
    expect(parseGrammar('')).toBeNull()
  })

  it('Evidenz-Validierung filtert halluzinierte Fehler', () => {
    const doc = 'Das ist ein Fehlar. Mehr Text hier.'
    const result = parseGrammar(GRAMMAR_MD, doc)
    expect(result).not.toBeNull()
    // Nur Fehler 1 steht wirklich im Dokument, Fehler 2 ist halluziniert
    expect(result!.errors).toHaveLength(1)
    expect(result!.errors[0].original).toBe('Das ist ein Fehlar.')
    expect(result!.errors[0].verified).toBe(true)
  })

  it('akzeptiert englische Headings', () => {
    const md = `
## Overall Assessment
**Error Count:** 1
**Quality:** Good

## Error List

### 1. Spelling (Severity: high)
**Original:** teh
**Correction:** the
`
    const result = parseGrammar(md)
    expect(result).not.toBeNull()
    expect(result!.errors).toHaveLength(1)
  })
})

const ZEUGNIS_JSON = {
  documentType: 'qualifiziertes',
  contentGrade: { grade: 2, label: 'Gut', confidence: 'high', reasoning: 'Solide Leistung.' },
  craftGrade: { grade: 3, label: 'Befriedigend', confidence: 'medium', reasoning: 'Ok.' },
  sections: [
    {
      name: 'Leistungsbeurteilung',
      present: true,
      grade: 2,
      evidence: 'stets zu unserer vollen Zufriedenheit'
    }
  ],
  codedPhrases: [
    {
      phrase: 'stets bemueht',
      evidence: 'Er war stets bemueht',
      decoded: 'Note 5: Bemuehen ohne Erfolg',
      severity: 'red'
    }
  ],
  missingElements: [],
  closingFormula: {
    regret: { excerpt: 'Wir bedauern sein Ausscheiden', assessment: 'positive' }
  },
  summary: 'Insgesamt ein gutes Zeugnis mit einer roten Flagge.'
}

function zeugnisMarkdown(json: unknown): string {
  return `## Analyse\nText davor.\n\n## Strukturierte Daten\n\`\`\`json\n${JSON.stringify(json)}\n\`\`\`\n`
}

describe('parseArbeitszeugnis', () => {
  it('parst das Dual-Grade-Schema aus dem JSON-Block', () => {
    const result = parseArbeitszeugnis(zeugnisMarkdown(ZEUGNIS_JSON))
    expect(result).not.toBeNull()
    expect(result!.contentGrade.grade).toBe(2)
    expect(result!.craftGrade.grade).toBe(3)
    expect(result!.sections).toHaveLength(1)
    expect(result!.codedPhrases).toHaveLength(1)
    expect(result!.closingFormula.regret?.assessment).toBe('positive')
  })

  it('Legacy-Schema (nur overallGrade) wird weiterhin gelesen', () => {
    const legacy = {
      overallGrade: { grade: 4, confidence: 'medium', reasoning: 'Alt.' },
      sections: []
    }
    const result = parseArbeitszeugnis(zeugnisMarkdown(legacy))
    expect(result).not.toBeNull()
    expect(result!.contentGrade.grade).toBe(4)
    expect(result!.craftGrade.label).toBe('Nicht separat bewertet')
  })

  it('liefert null bei kaputtem JSON oder fehlendem Block', () => {
    expect(parseArbeitszeugnis('```json\n{kaputt:\n```')).toBeNull()
    expect(parseArbeitszeugnis('Nur Prosa, kein JSON.')).toBeNull()
    expect(parseArbeitszeugnis('')).toBeNull()
  })

  it('ueberspringt Beispiel-JSON ohne Schema und nimmt den gueltigen Block', () => {
    const md =
      '```json\n{"beispiel": true}\n```\nProsa dazwischen\n' + zeugnisMarkdown(ZEUGNIS_JSON)
    const result = parseArbeitszeugnis(md)
    expect(result).not.toBeNull()
    expect(result!.contentGrade.grade).toBe(2)
  })

  it('Evidenz-Validierung filtert codierte Phrasen ohne Beleg im Dokument', () => {
    const doc = 'Er war stets bemueht, die Aufgaben zu erledigen.'
    const result = parseArbeitszeugnis(zeugnisMarkdown(ZEUGNIS_JSON), doc)
    expect(result).not.toBeNull()
    // codedPhrase-Evidenz steht im Dokument -> bleibt
    expect(result!.codedPhrases).toHaveLength(1)
    // Section-Evidenz steht NICHT im Dokument -> verified false (aber nicht gefiltert)
    expect(result!.sections[0].verified).toBe(false)

    const docOhneBeleg = 'Voellig anderer Text.'
    const filtered = parseArbeitszeugnis(zeugnisMarkdown(ZEUGNIS_JSON), docOhneBeleg)
    expect(filtered!.codedPhrases).toHaveLength(0)
  })
})

describe('stripTrailingJsonBlock', () => {
  it('entfernt die Strukturierte-Daten-Sektion am Ende', () => {
    const md = '## Analyse\nInhalt.\n\n## Strukturierte Daten\n```json\n{}\n```'
    expect(stripTrailingJsonBlock(md)).toBe('## Analyse\nInhalt.')
  })

  it('lässt Markdown ohne JSON-Sektion unverändert', () => {
    expect(stripTrailingJsonBlock('## Nur Text')).toBe('## Nur Text')
  })
})

describe('isInDocument', () => {
  it('findet Zitate unabhängig von Whitespace und Gross-/Kleinschreibung', () => {
    const doc = 'Er hat   STETS zu unserer\nvollen Zufriedenheit gearbeitet.'
    expect(isInDocument('stets zu unserer vollen Zufriedenheit', doc)).toBe(true)
  })

  it('lehnt zu kurze oder fehlende Kandidaten ab', () => {
    expect(isInDocument('ab', 'ab cd ef')).toBe(false)
    expect(isInDocument(undefined, 'text')).toBe(false)
    expect(isInDocument('nicht enthalten', 'völlig anderer text')).toBe(false)
  })
})
