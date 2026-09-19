import { describe, it, expect } from 'vitest'
import { findGlossaryMatches } from './glossary-match'
import { GLOSSARY, lookupTerm } from './glossary'

/** Kurzform: nur die kanonischen Begriffe der Treffer. */
function terms(text: string, options?: Parameters<typeof findGlossaryMatches>[1]): string[] {
  return findGlossaryMatches(text, options).map((m) => m.entry.term)
}

describe('glossary (Daten)', () => {
  it('hat mindestens 120 Eintraege', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(120)
  })

  it('short bleibt einzeilig und kurz, long ist ausfuehrlich', () => {
    for (const entry of GLOSSARY) {
      expect(entry.short.length, entry.term).toBeLessThanOrEqual(95)
      expect(entry.short).not.toContain('\n')
      expect(entry.long.length, entry.term).toBeGreaterThan(120)
    }
  })

  it('lookupTerm findet unabhaengig von Schreibweise und ueber Aliase', () => {
    expect(lookupTerm('Säumniszuschlag')?.term).toBe('Säumniszuschlag')
    expect(lookupTerm('saeumniszuschlag')?.term).toBe('Säumniszuschlag')
    expect(lookupTerm('Hartz IV')?.term).toBe('Bürgergeld')
    expect(lookupTerm('gibt es nicht')).toBeUndefined()
  })
})

describe('findGlossaryMatches', () => {
  it('leerer Text ergibt keine Treffer', () => {
    expect(findGlossaryMatches('')).toEqual([])
  })

  it('Text ohne Fachwoerter ergibt keine Treffer', () => {
    expect(findGlossaryMatches('Heute war das Wetter schoen und ruhig.')).toEqual([])
  })

  it('liefert Offsets, die exakt auf den Originaltext zeigen', () => {
    const text = 'Gegen diesen Bescheid koennen Sie Widerspruch einlegen.'
    const matches = findGlossaryMatches(text)
    for (const m of matches) {
      expect(text.slice(m.start, m.end).toLowerCase()).toContain(
        m.entry.term.slice(0, 6).toLowerCase()
      )
    }
    expect(text.slice(matches[0].start, matches[0].end)).toBe('Bescheid')
  })

  it('ignoriert Gross- und Kleinschreibung', () => {
    expect(terms('BESCHEID')).toEqual(['Bescheid'])
    expect(terms('bescheid')).toEqual(['Bescheid'])
  })

  it('findet Umlaut-Begriffe auch in ASCII-Schreibweise', () => {
    expect(terms('Ein Saeumniszuschlag wurde erhoben.')).toEqual(['Säumniszuschlag'])
    expect(terms('Ein Säumniszuschlag wurde erhoben.')).toEqual(['Säumniszuschlag'])
  })

  it('findet ß-Begriffe auch mit ss geschrieben', () => {
    expect(terms('eine ausserordentliche Kuendigung')).toEqual(['außerordentliche Kündigung'])
    expect(terms('eine außerordentliche Kündigung')).toEqual(['außerordentliche Kündigung'])
  })

  it('markiert die Umlaut-Fundstelle mit korrekter Laenge', () => {
    const text = 'Der Säumniszuschlag betraegt 1 Prozent.'
    const [match] = findGlossaryMatches(text)
    expect(text.slice(match.start, match.end)).toBe('Säumniszuschlag')
  })

  it('trifft nur an Wortgrenzen - kein Treffer in einem laengeren Kompositum', () => {
    // "Widerspruchsbehandlungsverfahren" steht nicht im Glossar und ist auch
    // keine erlaubte Beugungsform von "Widerspruch" -> bewusst kein Treffer.
    expect(terms('Das Widerspruchsbehandlungsverfahren dauert.')).toEqual([])
    expect(terms('Vorwiderspruch')).toEqual([])
  })

  it('erlaubt regelmaessige Beugung am Wortende', () => {
    expect(terms('Die Bescheide sind da.')).toEqual(['Bescheid'])
    expect(terms('Einlegung des Widerspruchs')).toEqual(['Widerspruch'])
    expect(terms('mehrere Abmahnungen')).toEqual(['Abmahnung'])
  })

  it('laengster Treffer gewinnt bei gleichem Wortanfang', () => {
    expect(terms('Die Widerspruchsfrist laeuft.')).toEqual(['Widerspruchsfrist'])
    expect(terms('Die Zustellungsurkunde liegt vor.')).toEqual(['Zustellungsurkunde'])
  })

  it('laengster Treffer gewinnt auch ueber mehrere Woerter', () => {
    expect(terms('Ihr Widerspruch gegen den Mahnbescheid ist eingegangen.')).toEqual([
      'Widerspruch gegen den Mahnbescheid'
    ])
    expect(terms('Die Kosten der Unterkunft werden uebernommen.')).toEqual([
      'Kosten der Unterkunft'
    ])
  })

  it('findet mehrteilige Begriffe ueber einen Zeilenumbruch hinweg', () => {
    const text = 'Die Kosten der\nUnterkunft werden uebernommen.'
    const [match] = findGlossaryMatches(text)
    expect(match.entry.term).toBe('Kosten der Unterkunft')
    expect(text.slice(match.start, match.end)).toBe('Kosten der\nUnterkunft')
  })

  it('reisst mehrteilige Begriffe nicht ueber Satzgrenzen zusammen', () => {
    // Punkt zwischen den Woertern ist kein erlaubtes Trennzeichen.
    expect(terms('Die Kosten. Der Unterkunft.')).toEqual([])
  })

  it('findet Begriffe ueber Aliase', () => {
    expect(terms('Ich beziehe Hartz IV.')).toEqual(['Bürgergeld'])
    expect(terms('Die fristlose Kuendigung kam gestern.')).toEqual(['außerordentliche Kündigung'])
  })

  it('liefert keine ueberlappenden Treffer und sortiert nach start', () => {
    const text =
      'Der Bescheid enthaelt eine Rechtsbehelfsbelehrung. Die Widerspruchsfrist betraegt einen Monat, danach tritt Bestandskraft ein.'
    const matches = findGlossaryMatches(text)
    expect(matches.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].end)
    }
  })

  it('uniqueTerms ist standardmaessig an - jeder Begriff nur beim ersten Mal', () => {
    const text = 'Bescheid hier, Bescheid da, noch ein Bescheid.'
    expect(terms(text)).toEqual(['Bescheid'])
    expect(findGlossaryMatches(text)[0].start).toBe(0)
  })

  it('uniqueTerms false markiert jedes Vorkommen', () => {
    const text = 'Bescheid hier, Bescheid da, noch ein Bescheid.'
    expect(terms(text, { uniqueTerms: false })).toEqual(['Bescheid', 'Bescheid', 'Bescheid'])
  })

  it('uniqueTerms zaehlt Alias und kanonischen Begriff als denselben Eintrag', () => {
    expect(terms('Hartz IV und Buergergeld sind dasselbe.')).toEqual(['Bürgergeld'])
  })

  it('maxMatches begrenzt die Trefferzahl', () => {
    const text = 'Bescheid, Widerspruch, Bestandskraft, Aktenzeichen, Anhoerung.'
    expect(findGlossaryMatches(text, { maxMatches: 2 })).toHaveLength(2)
    expect(findGlossaryMatches(text, { maxMatches: 0 })).toEqual([])
    expect(findGlossaryMatches(text).length).toBeGreaterThan(2)
  })

  it('bleibt bei 100k Zeichen schnell und ueberschneidungsfrei', () => {
    const block =
      'Gegen diesen Bescheid koennen Sie Widerspruch einlegen. Die Widerspruchsfrist betraegt einen Monat. Ein Saeumniszuschlag faellt an. '
    const text = block.repeat(Math.ceil(100_000 / block.length)).slice(0, 100_000)
    const started = Date.now()
    const matches = findGlossaryMatches(text, { uniqueTerms: false })
    expect(Date.now() - started).toBeLessThan(2000)
    expect(matches.length).toBeGreaterThan(1000)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].end)
    }
    const last = matches[matches.length - 1]
    expect(text.slice(last.start, last.end).length).toBe(last.end - last.start)
  })
})
