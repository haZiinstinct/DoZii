import { describe, it, expect } from 'vitest'
import { findQuoteRange, buildHighlightSegments, type HighlightQuery } from './highlight'

/** Kurzhelfer: was steht laut Treffer wirklich im Originaltext? */
function sliceOf(text: string, range: { start: number; end: number } | null): string | null {
  return range ? text.slice(range.start, range.end) : null
}

describe('findQuoteRange', () => {
  it('findet ein zeichengenaues Zitat', () => {
    const doc = 'Der Mitarbeiter war stets puenktlich.'
    const range = findQuoteRange(doc, 'war stets puenktlich')
    expect(range).toEqual({ start: 16, end: 36 })
    expect(sliceOf(doc, range)).toBe('war stets puenktlich')
  })

  it('findet ein Zitat ueber einen Zeilenumbruch hinweg', () => {
    const doc = 'Der Vertrag\nist unbefristet.'
    const range = findQuoteRange(doc, 'Vertrag ist unbefristet')
    expect(sliceOf(doc, range)).toBe('Vertrag\nist unbefristet')
  })

  it('findet ein Zitat trotz Trennstrich am Zeilenende', () => {
    const doc = 'Der Ver-\ntrag ist wirksam.'
    const range = findQuoteRange(doc, 'Vertrag ist wirksam')
    expect(sliceOf(doc, range)).toBe('Ver-\ntrag ist wirksam')
  })

  it('findet ein Zitat trotz Trennstrich plus Einrueckung der Folgezeile', () => {
    const doc = 'Der Ver-\n    trag ist wirksam.'
    const range = findQuoteRange(doc, 'Vertrag ist wirksam')
    expect(sliceOf(doc, range)).toBe('Ver-\n    trag ist wirksam')
  })

  it('findet ein Zitat trotz weichem Trennstrich im Original', () => {
    const doc = 'Der Ver\u00ADtrag ist wirksam.'
    const range = findQuoteRange(doc, 'Vertrag ist wirksam')
    expect(sliceOf(doc, range)).toBe('Ver\u00ADtrag ist wirksam')
  })

  it('laesst einen echten Bindestrich innerhalb der Zeile stehen', () => {
    const doc = 'Das Arbeits-Verhaeltnis endet zum 31.12.'
    const range = findQuoteRange(doc, 'Arbeits-Verhaeltnis endet')
    expect(sliceOf(doc, range)).toBe('Arbeits-Verhaeltnis endet')
  })

  it('gleicht typografische Anfuehrungszeichen an gerade an', () => {
    const doc = 'Er sagte: \u201EDas Zeugnis ist wohlwollend\u201C und ging.'
    const range = findQuoteRange(doc, '"Das Zeugnis ist wohlwollend"')
    expect(sliceOf(doc, range)).toBe('\u201EDas Zeugnis ist wohlwollend\u201C')
  })

  it('gleicht typografische Apostrophe an', () => {
    const doc = 'Das Unternehmen\u2019s Angebot gilt bis Montag.'
    const range = findQuoteRange(doc, "Unternehmen's Angebot")
    expect(sliceOf(doc, range)).toBe('Unternehmen\u2019s Angebot')
  })

  it('ignoriert Gross-/Kleinschreibung', () => {
    const doc = 'MIT FREUNDLICHEN GRUESSEN'
    const range = findQuoteRange(doc, 'mit freundlichen gruessen')
    expect(range).toEqual({ start: 0, end: 25 })
  })

  it('normalisiert Whitespace-Folgen (Tabs, mehrfache Leerzeichen)', () => {
    const doc = 'Die   Kuendigung\t\tist   wirksam.'
    const range = findQuoteRange(doc, 'Kuendigung ist wirksam')
    expect(sliceOf(doc, range)).toBe('Kuendigung\t\tist   wirksam')
  })

  it('liefert null, wenn das Zitat nicht im Dokument steht', () => {
    const doc = 'Der Mitarbeiter war stets puenktlich.'
    expect(findQuoteRange(doc, 'Der Mitarbeiter war unzuverlaessig')).toBeNull()
  })

  it('liefert null bei zu kurzen Zitaten (keine Zufallstreffer)', () => {
    expect(findQuoteRange('Das ist gut so.', 'gut')).toBeNull()
  })

  it('liefert null bei leeren Eingaben', () => {
    expect(findQuoteRange('', 'Vertrag laeuft')).toBeNull()
    expect(findQuoteRange('Der Vertrag laeuft.', '')).toBeNull()
    expect(findQuoteRange('Der Vertrag laeuft.', '   \n  ')).toBeNull()
  })

  it('nimmt bei Zitaten ueber 40 Zeichen den Praefix-Fallback', () => {
    const doc =
      'Der Mitarbeiter hat die ihm uebertragenen Aufgaben stets zu unserer vollsten Zufriedenheit erledigt.'
    // Das Modell laesst "vollsten" weg - das vollstaendige Zitat trifft nicht,
    // die ersten 40 normalisierten Zeichen aber schon.
    const range = findQuoteRange(
      doc,
      'Der Mitarbeiter hat die ihm uebertragenen Aufgaben stets zu unserer Zufriedenheit erledigt.'
    )
    expect(sliceOf(doc, range)).toBe('Der Mitarbeiter hat die ihm uebertragene')
  })

  it('nutzt den Praefix-Fallback NICHT bei Zitaten bis 40 Zeichen', () => {
    const doc = 'Der Mitarbeiter war stets puenktlich.'
    expect(findQuoteRange(doc, 'Der Mitarbeiter war immer')).toBeNull()
  })

  it('liefert null, wenn auch der Praefix nicht im Dokument steht', () => {
    const doc = 'Der Mitarbeiter war stets puenktlich und zuverlaessig.'
    expect(
      findQuoteRange(doc, 'Die Geschaeftsfuehrung bedauert das Ausscheiden des Mitarbeiters sehr.')
    ).toBeNull()
  })

  it('nimmt bei mehrfach identischem Zitat das erste Vorkommen', () => {
    const doc = 'Die Frist betraegt einen Monat. Die Frist betraegt einen Monat.'
    const range = findQuoteRange(doc, 'Die Frist betraegt einen Monat')
    expect(range).toEqual({ start: 0, end: 30 })
  })
})

describe('buildHighlightSegments', () => {
  it('zerlegt den Text in Vorher/Treffer/Nachher', () => {
    const doc = 'Der Mitarbeiter war stets puenktlich.'
    const segments = buildHighlightSegments(doc, [{ id: 'q1', quote: 'war stets puenktlich' }])
    expect(segments).toHaveLength(3)
    expect(segments[0]).toEqual({ text: 'Der Mitarbeiter ', spans: [] })
    expect(segments[1].text).toBe('war stets puenktlich')
    expect(segments[1].spans).toEqual([{ id: 'q1', start: 16, end: 36 }])
    expect(segments[2]).toEqual({ text: '.', spans: [] })
  })

  it('reicht severity durch', () => {
    const doc = 'Die Kuendigungsfrist betraegt vier Wochen.'
    const segments = buildHighlightSegments(doc, [
      { id: 'q1', quote: 'Kuendigungsfrist betraegt vier Wochen', severity: 'high' }
    ])
    const marked = segments.filter((s) => s.spans.length > 0)
    expect(marked).toHaveLength(1)
    expect(marked[0].spans[0].severity).toBe('high')
  })

  it('stellt ueberlappende Zitate als eigene Segmente dar', () => {
    const doc = 'Alpha Beta Gamma Delta'
    const segments = buildHighlightSegments(doc, [
      { id: 'q1', quote: 'Alpha Beta Gamma' },
      { id: 'q2', quote: 'Beta Gamma Delta' }
    ])
    expect(segments.map((s) => s.text)).toEqual(['Alpha ', 'Beta Gamma', ' Delta'])
    expect(segments[0].spans.map((s) => s.id)).toEqual(['q1'])
    expect(segments[1].spans.map((s) => s.id)).toEqual(['q1', 'q2'])
    expect(segments[2].spans.map((s) => s.id)).toEqual(['q2'])
  })

  it('haelt zwei Queries mit identischem Zitat auf derselben Fundstelle', () => {
    const doc = 'Die Frist betraegt einen Monat. Die Frist betraegt einen Monat.'
    const segments = buildHighlightSegments(doc, [
      { id: 'b', quote: 'Die Frist betraegt einen Monat' },
      { id: 'a', quote: 'Die Frist betraegt einen Monat' }
    ])
    expect(segments[0].text).toBe('Die Frist betraegt einen Monat')
    // Deckungsgleiche Spans werden stabil nach id sortiert.
    expect(segments[0].spans.map((s) => s.id)).toEqual(['a', 'b'])
    expect(segments[1].spans).toEqual([])
  })

  it('ignoriert Queries ohne Treffer, ohne die uebrigen zu verlieren', () => {
    const doc = 'Der Vertrag laeuft unbefristet und endet nicht automatisch.'
    const segments = buildHighlightSegments(doc, [
      { id: 'q1', quote: 'laeuft unbefristet' },
      { id: 'q2', quote: 'kann jederzeit fristlos gekuendigt werden' },
      { id: 'q3', quote: '' }
    ])
    const ids = segments.flatMap((s) => s.spans.map((span) => span.id))
    expect(ids).toEqual(['q1'])
  })

  it('setzt sich verlustfrei zum Originaltext zusammen', () => {
    const doc =
      'Sehr geehrte Frau Mueller,\n\nder Ver-\ntrag laeuft unbefristet. Die Kuendigungs\u00ADfrist\n' +
      'betraegt vier Wochen zum Monatsende. Er sagte: \u201EDas gilt ab sofort\u201C.\n\n' +
      'Mit freundlichen Gruessen'
    const queries: HighlightQuery[] = [
      { id: 'q1', quote: 'Vertrag laeuft unbefristet' },
      { id: 'q2', quote: 'Die Kuendigungsfrist betraegt vier Wochen zum Monatsende' },
      { id: 'q3', quote: '"Das gilt ab sofort"' },
      { id: 'q4', quote: 'steht so nicht im Dokument' }
    ]
    const segments = buildHighlightSegments(doc, queries)
    expect(segments.map((s) => s.text).join('')).toBe(doc)
    expect(segments.some((s) => s.spans.length > 0)).toBe(true)
  })

  it('markiert bei ueberlappenden Treffern verlustfrei', () => {
    const doc = 'Alpha Beta Gamma Delta Epsilon'
    const segments = buildHighlightSegments(doc, [
      { id: 'q1', quote: 'Alpha Beta Gamma' },
      { id: 'q2', quote: 'Beta Gamma Delta' },
      { id: 'q3', quote: 'Gamma Delta Epsilon' }
    ])
    expect(segments.map((s) => s.text).join('')).toBe(doc)
    // Jedes Segment traegt eine konstante Span-Menge, keine leeren Segmente.
    expect(segments.every((s) => s.text.length > 0)).toBe(true)
  })

  it('behandelt leere Eingaben', () => {
    expect(buildHighlightSegments('', [{ id: 'q1', quote: 'irgendwas' }])).toEqual([])
    expect(buildHighlightSegments('Nur Text.', [])).toEqual([{ text: 'Nur Text.', spans: [] }])
    expect(buildHighlightSegments('Nur Text.', [{ id: 'q1', quote: '' }])).toEqual([
      { text: 'Nur Text.', spans: [] }
    ])
  })

  it('haelt 200k Zeichen mit 60 Zitaten aus', () => {
    const lines: string[] = []
    for (let i = 0; i < 2000; i++) {
      lines.push(
        `Klausel ${i}: Der Vertrag laeuft unbefristet und kann mit einer Frist von vier Wochen gekuendigt werden.`
      )
    }
    const doc = lines.join('\n')
    expect(doc.length).toBeGreaterThan(200_000)

    const queries: HighlightQuery[] = []
    for (let i = 0; i < 60; i++) {
      queries.push({ id: `q${i}`, quote: `Klausel ${i * 30}: Der Vertrag laeuft unbefristet` })
    }

    const started = Date.now()
    const segments = buildHighlightSegments(doc, queries)
    const durationMs = Date.now() - started

    expect(segments.map((s) => s.text).join('')).toBe(doc)
    expect(segments.filter((s) => s.spans.length > 0)).toHaveLength(60)
    expect(durationMs).toBeLessThan(2000)
  })
})
