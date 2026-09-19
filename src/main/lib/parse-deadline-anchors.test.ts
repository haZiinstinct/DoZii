import { describe, it, expect } from 'vitest'
import { normalizeGermanDate, parseDeadlineAnchors } from './parse-deadline-anchors'

/** Anker, wie ihn der Prompt vorgibt - Basis fuer die Varianten unten. */
const VALID_ANCHOR = {
  kind: 'widerspruch',
  label: 'Widerspruch gegen den Bescheid',
  startDateIso: '2026-03-15',
  startDateQuote: 'Bescheid vom 15.03.2026',
  periodText: 'innerhalb eines Monats',
  periodValue: 1,
  periodUnit: 'month',
  explicitDueDateIso: null,
  quote: 'Gegen diesen Bescheid koennen Sie innerhalb eines Monats Widerspruch erheben.',
  confidence: 'high'
}

/** Packt Anker in eine realistische Modell-Antwort mit Codefence und Geschwafel. */
function modelAnswer(anchors: unknown[]): string {
  return `Ich habe folgende Fristen gefunden:\n\`\`\`json\n${JSON.stringify({ anchors })}\n\`\`\``
}

describe('normalizeGermanDate', () => {
  it('reicht ISO-Datum durch', () => {
    expect(normalizeGermanDate('2026-03-15')).toBe('2026-03-15')
  })

  it('schneidet einen angehaengten Zeitanteil ab', () => {
    expect(normalizeGermanDate('2026-03-15T00:00:00Z')).toBe('2026-03-15')
  })

  it('wandelt DD.MM.YYYY', () => {
    expect(normalizeGermanDate('15.03.2026')).toBe('2026-03-15')
  })

  it('wandelt einstellige Tage/Monate mit zweistelligem Jahr', () => {
    expect(normalizeGermanDate('5.3.26')).toBe('2026-03-05')
  })

  it('schiebt zweistellige Jahre ab 70 in die 1900er', () => {
    expect(normalizeGermanDate('5.3.95')).toBe('1995-03-05')
    // 85 -> 1985, damit vor MIN_YEAR und deshalb unplausibel
    expect(normalizeGermanDate('5.3.85')).toBeNull()
  })

  it('wandelt DD/MM/YYYY', () => {
    expect(normalizeGermanDate('15/03/2026')).toBe('2026-03-15')
  })

  it('versteht Monatsnamen mit echtem Umlaut', () => {
    expect(normalizeGermanDate('15. M\u00e4rz 2026')).toBe('2026-03-15')
  })

  it('versteht ASCII-Schreibweise und Abkuerzungen', () => {
    expect(normalizeGermanDate('1. Maerz 2026')).toBe('2026-03-01')
    expect(normalizeGermanDate('24. Dez. 2026')).toBe('2026-12-24')
    expect(normalizeGermanDate('3 September 2026')).toBe('2026-09-03')
  })

  it('lehnt unbekannte Monatsnamen ab', () => {
    expect(normalizeGermanDate('15. Smarch 2026')).toBeNull()
  })

  it('lehnt unmoegliche Monate ab', () => {
    expect(normalizeGermanDate('2026-13-01')).toBeNull()
    expect(normalizeGermanDate('01.00.2026')).toBeNull()
  })

  it('prueft den Tag gegen die Monatslaenge', () => {
    expect(normalizeGermanDate('31.02.2026')).toBeNull()
    expect(normalizeGermanDate('31.04.2026')).toBeNull()
  })

  it('kennt Schaltjahre', () => {
    expect(normalizeGermanDate('29.02.2024')).toBe('2024-02-29')
    expect(normalizeGermanDate('29.02.2025')).toBeNull()
  })

  it('lehnt Jahre ausserhalb 1990-2100 ab', () => {
    expect(normalizeGermanDate('01.01.1200')).toBeNull()
    expect(normalizeGermanDate('01.01.2150')).toBeNull()
  })

  it('liefert null bei Muell und Leerstring', () => {
    expect(normalizeGermanDate('')).toBeNull()
    expect(normalizeGermanDate('   ')).toBeNull()
    expect(normalizeGermanDate('demnaechst')).toBeNull()
    expect(normalizeGermanDate('irgendwann im Maerz')).toBeNull()
  })
})

describe('parseDeadlineAnchors', () => {
  it('liest einen vollstaendigen Anker aus einem json-Codefence', () => {
    expect(parseDeadlineAnchors(modelAnswer([VALID_ANCHOR]))).toEqual([
      {
        kind: 'widerspruch',
        label: 'Widerspruch gegen den Bescheid',
        startDateIso: '2026-03-15',
        startDateQuote: 'Bescheid vom 15.03.2026',
        periodText: 'innerhalb eines Monats',
        periodValue: 1,
        periodUnit: 'month',
        explicitDueDateIso: null,
        quote: 'Gegen diesen Bescheid koennen Sie innerhalb eines Monats Widerspruch erheben.',
        confidence: 'high'
      }
    ])
  })

  it('liefert eine leere Liste, wenn keine Frist gefunden wurde', () => {
    expect(parseDeadlineAnchors('{"anchors":[]}')).toEqual([])
  })

  it('wirft nicht bei kaputtem oder fehlendem JSON', () => {
    expect(parseDeadlineAnchors('Keine Fristen gefunden.')).toEqual([])
    expect(parseDeadlineAnchors('{anchors: [')).toEqual([])
    expect(parseDeadlineAnchors('')).toEqual([])
  })

  it('ignoriert ein anchors-Feld, das kein Array ist', () => {
    expect(parseDeadlineAnchors('{"anchors":"keine"}')).toEqual([])
    expect(parseDeadlineAnchors('{"foo":1}')).toEqual([])
  })

  it('verwirft Anker ohne Zitat (Evidence-or-Abstain)', () => {
    const ohneZitat = { ...VALID_ANCHOR, quote: '' }
    expect(parseDeadlineAnchors(modelAnswer([ohneZitat]))).toEqual([])
    const nullZitat = { ...VALID_ANCHOR, quote: null }
    expect(parseDeadlineAnchors(modelAnswer([nullZitat]))).toEqual([])
  })

  it('behaelt nur die belegten Anker, wenn mehrere geliefert werden', () => {
    const zweiter = { ...VALID_ANCHOR, kind: 'zahlung', quote: undefined }
    const result = parseDeadlineAnchors(modelAnswer([VALID_ANCHOR, zweiter]))
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('widerspruch')
  })

  it('verwirft Eintraege, die keine Objekte sind', () => {
    expect(parseDeadlineAnchors(modelAnswer(['Widerspruch', 42, null]))).toEqual([])
  })

  it('mappt unbekanntes kind auf sonstige', () => {
    const result = parseDeadlineAnchors(modelAnswer([{ ...VALID_ANCHOR, kind: 'rueckgabe' }]))
    expect(result[0].kind).toBe('sonstige')
  })

  it('akzeptiert kind unabhaengig von Gross-/Kleinschreibung', () => {
    const result = parseDeadlineAnchors(modelAnswer([{ ...VALID_ANCHOR, kind: 'Einspruch' }]))
    expect(result[0].kind).toBe('einspruch')
  })

  it('setzt ein Fallback-Label, wenn das Modell keins liefert', () => {
    const result = parseDeadlineAnchors(modelAnswer([{ ...VALID_ANCHOR, label: '   ' }]))
    expect(result[0].label).toBe('Widerspruchsfrist')
  })

  it('normalisiert deutsche Datumsangaben in den Datumsfeldern', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([
        {
          ...VALID_ANCHOR,
          startDateIso: '15.03.2026',
          explicitDueDateIso: '15. April 2026'
        }
      ])
    )
    expect(result[0].startDateIso).toBe('2026-03-15')
    expect(result[0].explicitDueDateIso).toBe('2026-04-15')
  })

  it('setzt unplausible Datumsangaben auf null, behaelt den Anker aber', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([{ ...VALID_ANCHOR, startDateIso: '31.02.2026', explicitDueDateIso: 'bald' }])
    )
    expect(result).toHaveLength(1)
    expect(result[0].startDateIso).toBeNull()
    expect(result[0].explicitDueDateIso).toBeNull()
  })

  it('verwirft periodValue ausserhalb 1-60', () => {
    for (const value of [0, -3, 61, 600, 1.5, 'abc', null]) {
      const result = parseDeadlineAnchors(modelAnswer([{ ...VALID_ANCHOR, periodValue: value }]))
      expect(result[0].periodValue).toBeNull()
      expect(result[0].periodUnit).toBeNull()
    }
  })

  it('akzeptiert periodValue als Zahl im String', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([{ ...VALID_ANCHOR, periodValue: '14', periodUnit: 'day' }])
    )
    expect(result[0].periodValue).toBe(14)
    expect(result[0].periodUnit).toBe('day')
  })

  it('verwirft Wert und Einheit gemeinsam, wenn die Einheit unbrauchbar ist', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([{ ...VALID_ANCHOR, periodValue: 2, periodUnit: 'Monate' }])
    )
    expect(result[0].periodValue).toBeNull()
    expect(result[0].periodUnit).toBeNull()
  })

  it('stuft unbekannte confidence auf low herunter', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([{ ...VALID_ANCHOR, confidence: 'sehr sicher' }])
    )
    expect(result[0].confidence).toBe('low')
  })

  it('ignoriert das Beispiel-JSON aus dem Prompt vor der echten Antwort', () => {
    const raw = `Beispiel: {"anchors":[{"kind":"zahlung"}]}\n\`\`\`json\n${JSON.stringify({
      anchors: [VALID_ANCHOR]
    })}\n\`\`\``
    const result = parseDeadlineAnchors(raw)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('widerspruch')
  })

  it('trimmt Zitate und Texte', () => {
    const result = parseDeadlineAnchors(
      modelAnswer([{ ...VALID_ANCHOR, quote: '  Zahlbar bis zum 01.04.2026.  ', periodText: '  ' }])
    )
    expect(result[0].quote).toBe('Zahlbar bis zum 01.04.2026.')
    expect(result[0].periodText).toBeNull()
  })
})
