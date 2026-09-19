import { describe, it, expect } from 'vitest'
import { parsePlainLanguage } from './parse-plain-language'

const PERFEKT_DE = `
## Das Wichtigste
Das Jobcenter fordert 240,00 Euro von dir zurueck.

## Dringlichkeit
**Stufe:** hoch
**Warum:** Die Frist endet in zwei Wochen.

## Worum geht es
Das Jobcenter hat dir zu viel Geld gezahlt. Jetzt will es das Geld zurueck.

## Was man von dir will
Du sollst 240,00 Euro ueberweisen.

## Was passiert, wenn du nichts tust
Das Jobcenter behaelt das Geld von deiner naechsten Zahlung ein.

## Was du tun kannst
- [ ] Ueberweise 240,00 Euro (bis: 15.03.2026)
- [ ] Rufe beim Jobcenter an (bis: keine Frist)

## Wichtige Zahlen und Daten
- **Betrag:** 240,00 Euro
- **Aktenzeichen:** BG 1234/56

## Schwierige Woerter
- **Erstattungsbescheid:** Ein Brief, mit dem das Amt Geld zurueckfordert.
- **Widerspruch:** Ein Brief, mit dem du dem Amt sagst: das stimmt nicht.

## Was im Dokument nicht steht
- Die Kontonummer fuer die Ueberweisung fehlt.
`

const PERFEKT_EN = `
## The main point
The tax office demands 1,200.00 euros.

## Urgency
**Level:** medium
**Why:** The deadline is four weeks away.

## What this is about
The tax office recalculated your income tax.

## What they want from you
You should pay 1,200.00 euros.

## What happens if you do nothing
The tax office adds a late payment fee.

## What you can do
- [ ] Pay the amount (by: 2026-04-30)
- [ ] File an objection (by: no deadline)

## Important numbers and dates
- **Amount:** 1,200.00 euros
- **File number:** 12/345/67890

## Difficult words
- **Objection:** A letter telling the office that you disagree.

## What the document does not say
- The document does not say which bank account to use.
`

describe('parsePlainLanguage - Vollformat', () => {
  it('parst eine perfekte deutsche Ausgabe', () => {
    const result = parsePlainLanguage(PERFEKT_DE)
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('Das Jobcenter fordert 240,00 Euro von dir zurueck.')
    expect(result!.urgency).toBe('high')
    expect(result!.urgencyReason).toBe('Die Frist endet in zwei Wochen.')
    expect(result!.about).toContain('zu viel Geld gezahlt')
    expect(result!.demand).toBe('Du sollst 240,00 Euro ueberweisen.')
    expect(result!.ifNothing).toContain('naechsten Zahlung')
    expect(result!.actions).toEqual([
      { text: 'Ueberweise 240,00 Euro', deadline: '15.03.2026' },
      { text: 'Rufe beim Jobcenter an', deadline: null }
    ])
    expect(result!.facts).toEqual([
      { label: 'Betrag', value: '240,00 Euro' },
      { label: 'Aktenzeichen', value: 'BG 1234/56' }
    ])
    expect(result!.terms).toHaveLength(2)
    expect(result!.terms[0]).toEqual({
      term: 'Erstattungsbescheid',
      explanation: 'Ein Brief, mit dem das Amt Geld zurueckfordert.'
    })
    expect(result!.gaps).toEqual(['Die Kontonummer fuer die Ueberweisung fehlt.'])
  })

  it('parst eine perfekte englische Ausgabe', () => {
    const result = parsePlainLanguage(PERFEKT_EN)
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('The tax office demands 1,200.00 euros.')
    expect(result!.urgency).toBe('medium')
    expect(result!.urgencyReason).toBe('The deadline is four weeks away.')
    expect(result!.about).toContain('recalculated')
    expect(result!.demand).toContain('1,200.00 euros')
    expect(result!.ifNothing).toContain('late payment fee')
    expect(result!.actions).toEqual([
      { text: 'Pay the amount', deadline: '2026-04-30' },
      { text: 'File an objection', deadline: null }
    ])
    expect(result!.facts).toHaveLength(2)
    expect(result!.terms[0].term).toBe('Objection')
    expect(result!.gaps).toHaveLength(1)
  })
})

describe('parsePlainLanguage - schlampige Modelle', () => {
  it('liefert ein Teilergebnis, wenn Sektionen fehlen', () => {
    const md = `## Das Wichtigste
Die Stadt schickt dir eine Rechnung.

## Worum geht es
Es geht um die Muellabfuhr im Jahr 2025.`
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('Die Stadt schickt dir eine Rechnung.')
    expect(result!.about).toContain('Muellabfuhr')
    // Fehlende Dringlichkeit faellt auf 'medium' zurueck, Listen bleiben leer
    expect(result!.urgency).toBe('medium')
    expect(result!.urgencyReason).toBe('')
    expect(result!.demand).toBe('')
    expect(result!.ifNothing).toBe('')
    expect(result!.actions).toEqual([])
    expect(result!.facts).toEqual([])
    expect(result!.terms).toEqual([])
    expect(result!.gaps).toEqual([])
  })

  it('akzeptiert alle Checkbox- und Listen-Varianten', () => {
    const md = `## Das Wichtigste
Kurzfassung.

## Worum geht es
Ein Bescheid.

## Was du tun kannst
- [x] Lies den Bescheid
* [ ] Schicke den Widerspruch (Frist: 01.04.2026)
- Rufe die Beratungsstelle an
1. Zahle die Rechnung (bis: keine Frist)`
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.actions).toEqual([
      { text: 'Lies den Bescheid', deadline: null },
      { text: 'Schicke den Widerspruch', deadline: '01.04.2026' },
      { text: 'Rufe die Beratungsstelle an', deadline: null },
      { text: 'Zahle die Rechnung', deadline: null }
    ])
  })

  it('liest die Stufe auch als **Stufe**: und aus der Folgezeile', () => {
    const base = (urgencyBlock: string): string => `## Das Wichtigste
Kurzfassung.

## Dringlichkeit
${urgencyBlock}

## Worum geht es
Ein Bescheid.`
    expect(parsePlainLanguage(base('**Stufe**: hoch'))!.urgency).toBe('high')
    expect(parsePlainLanguage(base('**Stufe:**\nniedrig'))!.urgency).toBe('low')
    expect(parsePlainLanguage(base('Stufe: mittel'))!.urgency).toBe('medium')
    // Ganz ohne Feldlabel zaehlt die erste Zeile der Sektion
    expect(parsePlainLanguage(base('hoch'))!.urgency).toBe('high')
  })

  it('mappt Dringlichkeits-Woerter tolerant, Unbekanntes auf medium', () => {
    const base = (level: string): string => `## Das Wichtigste
Kurzfassung.

## Dringlichkeit
**Stufe:** ${level}

## Worum geht es
Ein Bescheid.`
    expect(parsePlainLanguage(base('dringend'))!.urgency).toBe('high')
    expect(parsePlainLanguage(base('HIGH'))!.urgency).toBe('high')
    expect(parsePlainLanguage(base('gering'))!.urgency).toBe('low')
    expect(parsePlainLanguage(base('low'))!.urgency).toBe('low')
    expect(parsePlainLanguage(base('Banane'))!.urgency).toBe('medium')
  })

  it('ignoriert Vor- und Nachgeplapper des Modells', () => {
    const md = `Gerne! Hier ist die Erklaerung in einfacher Sprache:

## Das Wichtigste
Die Krankenkasse lehnt deinen Antrag ab.

## Worum geht es
Du hast eine Kur beantragt. Die Kasse sagt Nein.

## Was im Dokument nicht steht
- Keine

Ich hoffe, das hilft dir weiter. Frag gern nach!`
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('Die Krankenkasse lehnt deinen Antrag ab.')
    expect(result!.about).toContain('Kur beantragt')
    // "- Keine" ist ein Leer-Marker, kein offener Punkt
    expect(result!.gaps).toEqual([])
  })

  it('liest Zahlen und Woerter auch ohne Fettschrift', () => {
    const md = `## Das Wichtigste
Kurzfassung.

## Worum geht es
Eine Rechnung.

## Wichtige Zahlen und Daten
- Betrag: 89,90 Euro
- Rechnungsnummer: R-2026-118

## Schwierige Woerter
- Mahngebuehr: Geld, das du zusaetzlich zahlst, weil du zu spaet warst.`
    const result = parsePlainLanguage(md)
    expect(result!.facts).toEqual([
      { label: 'Betrag', value: '89,90 Euro' },
      { label: 'Rechnungsnummer', value: 'R-2026-118' }
    ])
    expect(result!.terms).toEqual([
      {
        term: 'Mahngebuehr',
        explanation: 'Geld, das du zusaetzlich zahlst, weil du zu spaet warst.'
      }
    ])
  })

  it('erkennt die Ueberschrift auch mit echten Umlauten und ###', () => {
    const md = `### Das Wichtigste
Kurzfassung.

### Worum geht es
Ein Vertrag.

### Schwierige Wörter
- **Kündigungsfrist:** Die Zeit, die du vor dem Ende abwarten musst.`
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.terms).toHaveLength(1)
    expect(result!.terms[0].term).toBe('Kündigungsfrist')
  })

  it('toleriert fehlendes Komma und Zusaetze in der Ueberschrift', () => {
    const md = `## Das Wichtigste (kurz)
Kurzfassung.

## Worum geht es?
Ein Bescheid.

## Was passiert wenn du nichts tust
Die Forderung waechst.`
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.ifNothing).toBe('Die Forderung waechst.')
  })

  it('normalisiert CRLF-Zeilenenden', () => {
    const md = '## Das Wichtigste\r\nKurzfassung.\r\n\r\n## Worum geht es\r\nEin Bescheid.\r\n'
    const result = parsePlainLanguage(md)
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('Kurzfassung.')
    expect(result!.about).toBe('Ein Bescheid.')
  })
})

describe('parsePlainLanguage - Fallback auf Roh-Markdown', () => {
  it('liefert null bei Muell-Eingabe', () => {
    expect(parsePlainLanguage('Hallo, ich kann dir gerne helfen.')).toBeNull()
    expect(parsePlainLanguage('')).toBeNull()
    expect(parsePlainLanguage('## Irgendeine Ueberschrift\nIrgendein Text.')).toBeNull()
  })

  it('liefert null, wenn eine der beiden Kern-Sektionen fehlt', () => {
    const ohneWichtigstes = `## Dringlichkeit
**Stufe:** hoch

## Worum geht es
Ein Bescheid.`
    const ohneWorumGehtEs = `## Das Wichtigste
Kurzfassung.

## Was du tun kannst
- [ ] Zahle (bis: keine Frist)`
    expect(parsePlainLanguage(ohneWichtigstes)).toBeNull()
    expect(parsePlainLanguage(ohneWorumGehtEs)).toBeNull()
  })
})
