import { describe, it, expect } from 'vitest'
import {
  detectScannedPages,
  detectScannedPdf,
  isMostlyGibberish,
  SCANNED_PDF_MIN_CHARS_PER_PAGE
} from './scan-detect'

/** Realistischer Behoerdensatz, ~110 Zeichen. */
const SATZ =
  'Sehr geehrte Damen und Herren, hiermit teilen wir Ihnen mit, dass Ihr Antrag bewilligt worden ist. '

describe('detectScannedPdf', () => {
  it('leerer Text gilt als Scan', () => {
    const v = detectScannedPdf('', 5)
    expect(v.isScanned).toBe(true)
    expect(v.charsPerPage).toBe(0)
  })

  it('reiner Whitespace gilt als Scan', () => {
    expect(detectScannedPdf('   \n\n\t  ', 3).isScanned).toBe(true)
  })

  it('Mini-Textebene aus Seitenzahlen gilt als Scan', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Seite ${i + 1} von 20`).join('\n')
    const v = detectScannedPdf(text, 20)
    expect(v.isScanned).toBe(true)
    expect(v.charsPerPage).toBeLessThan(SCANNED_PDF_MIN_CHARS_PER_PAGE)
  })

  it('derselbe Text auf mehr Seiten verteilt kippt das Urteil', () => {
    // Pro Seite entscheidet, nicht die Gesamtlaenge: 20 Absaetze auf 10 Seiten
    // sind normaler Text, dieselbe Menge auf 60 Seiten ist Kopfzeilen-Rest.
    expect(detectScannedPdf(SATZ.repeat(20), 10).isScanned).toBe(false)
    expect(detectScannedPdf(SATZ.repeat(20), 60).isScanned).toBe(true)
  })

  it('vollstaendige Textebene gilt nicht als Scan', () => {
    const v = detectScannedPdf(SATZ.repeat(20), 1)
    expect(v.isScanned).toBe(false)
    expect(v.charsPerPage).toBeGreaterThan(SCANNED_PDF_MIN_CHARS_PER_PAGE)
  })

  it('pageCount null wird wie eine Seite behandelt', () => {
    expect(detectScannedPdf(SATZ.repeat(20), null).isScanned).toBe(false)
    expect(detectScannedPdf('Nur ein kurzer Kopfzeilen-Rest', null).isScanned).toBe(true)
  })

  it('pageCount 0 und negative Werte werden wie eine Seite behandelt', () => {
    const text = SATZ.repeat(20)
    expect(detectScannedPdf(text, 0).charsPerPage).toBe(text.trim().length)
    expect(detectScannedPdf(text, -4).charsPerPage).toBe(text.trim().length)
  })

  it('genau am Schwellwert gilt nicht als Scan', () => {
    const text = 'a'.repeat(SCANNED_PDF_MIN_CHARS_PER_PAGE)
    const v = detectScannedPdf(text, 1)
    expect(v.charsPerPage).toBe(SCANNED_PDF_MIN_CHARS_PER_PAGE)
    expect(v.isScanned).toBe(false)
  })

  it('ein Zeichen unter dem Schwellwert gilt als Scan', () => {
    expect(detectScannedPdf('a'.repeat(SCANNED_PDF_MIN_CHARS_PER_PAGE - 1), 1).isScanned).toBe(true)
  })

  it('charsPerPage rechnet auf die Seitenzahl um', () => {
    expect(detectScannedPdf('x'.repeat(1000), 4).charsPerPage).toBe(250)
  })

  it('unlesbare Textebene gilt trotz genug Zeichen als Scan', () => {
    const v = detectScannedPdf('~|_^*#+<>{}[]()/\\'.repeat(40), 1)
    expect(v.isScanned).toBe(true)
    expect(v.charsPerPage).toBeGreaterThan(SCANNED_PDF_MIN_CHARS_PER_PAGE)
  })

  it('liefert immer eine Begruendung', () => {
    for (const v of [
      detectScannedPdf('', null),
      detectScannedPdf('kurz', 2),
      detectScannedPdf(SATZ.repeat(20), 1)
    ]) {
      expect(v.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('isMostlyGibberish', () => {
  it('normaler deutscher Text ist kein Gibberish', () => {
    expect(isMostlyGibberish(SATZ.repeat(3))).toBe(false)
  })

  it('Text mit Umlauten und Zahlen ist kein Gibberish', () => {
    expect(isMostlyGibberish('Bescheid über 1.250,00 € vom 14. März 2026 – Az. 4711/B')).toBe(false)
  })

  it('reine Sonderzeichen sind Gibberish', () => {
    expect(isMostlyGibberish('~|_^*#+<>{}[]()/\\'.repeat(5))).toBe(true)
  })

  it('Steuerzeichen-Muell ist Gibberish', () => {
    expect(isMostlyGibberish('Text'.repeat(10))).toBe(true)
  })

  it('zu kurze Texte werden nicht verurteilt', () => {
    expect(isMostlyGibberish('')).toBe(false)
    expect(isMostlyGibberish('~|^')).toBe(false)
  })
})

describe('detectScannedPages', () => {
  const textPage = 'Sehr geehrte Damen und Herren, hiermit teilen wir Ihnen mit. '.repeat(30)

  it('findet einzelne Scanseiten in einem sonst lesbaren Dokument', () => {
    // Genau der Fall, den der Durchschnitt uebersieht.
    const pages = [textPage, textPage, '', textPage, '  2  ']
    expect(detectScannedPages(pages)).toEqual([3, 5])
  })

  it('reines Textdokument liefert keine Seiten', () => {
    expect(detectScannedPages([textPage, textPage])).toEqual([])
  })

  it('reiner Scan liefert alle Seiten', () => {
    expect(detectScannedPages(['', '', ''])).toEqual([1, 2, 3])
  })

  it('leere Seitenliste ist kein Scan', () => {
    expect(detectScannedPages([])).toEqual([])
  })
})
