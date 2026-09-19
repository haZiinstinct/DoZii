import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { scanKlauseln, minimumRisk } from './klausel-radar'

const ids = (text: string): string[] => scanKlauseln(text).map((f) => f.id)

describe('Kaution', () => {
  it('schlaegt ueber drei Nettokaltmieten an', () => {
    expect(ids('Der Mieter leistet eine Kaution in Hoehe von vier Nettokaltmieten.')).toContain(
      'kautionZuHoch'
    )
  })

  it('laesst drei Kaltmieten in Ruhe', () => {
    // Genau die gesetzliche Obergrenze - hier zu warnen waere ein Fehlalarm.
    expect(ids('Die Kaution betraegt drei Nettokaltmieten.')).not.toContain('kautionZuHoch')
  })

  it('rechnet auch mit Ziffern und Komma', () => {
    expect(ids('Als Mietsicherheit sind 3,5 Kaltmieten zu hinterlegen.')).toContain('kautionZuHoch')
    expect(ids('Als Mietsicherheit sind 2 Kaltmieten zu hinterlegen.')).not.toContain(
      'kautionZuHoch'
    )
  })

  it('verwechselt Mietrueckstand nicht mit Kaution', () => {
    // Ohne Umfeldpruefung waere das ein Fehlalarm - und ein Fehlalarm
    // entwertet die echten Funde.
    expect(
      ids('Bei einem Rueckstand von vier Monatsmieten kann fristlos gekuendigt werden.')
    ).not.toContain('kautionZuHoch')
  })
})

describe('Endrenovierung', () => {
  it('erkennt die Pflicht zur Renovierung bei Auszug', () => {
    expect(ids('Bei Auszug ist die Wohnung vollstaendig renoviert zurueckzugeben.')).toContain(
      'endrenovierung'
    )
  })

  it('meldet eine Renovierung beim Einzug nicht', () => {
    expect(ids('Die Wohnung wurde vor Einzug vollstaendig renoviert uebergeben.')).not.toContain(
      'endrenovierung'
    )
  })
})

describe('Arbeitsvertrag', () => {
  it('erkennt das Wettbewerbsverbot ohne Entschaedigung', () => {
    expect(ids('Eine Karenzentschaedigung wird nicht gezahlt.')).toContain('wettbewerbOhneKarenz')
  })

  it('erkennt die Pauschalabgeltung von Ueberstunden', () => {
    expect(ids('Mit dem Gehalt sind saemtliche Ueberstunden und Mehrarbeit abgegolten.')).toContain(
      'ueberstundenPauschal'
    )
  })
})

describe('Laufzeit und Form', () => {
  it('schlaegt bei Verlaengerung um zwoelf Monate an', () => {
    expect(ids('Der Vertrag verlaengert sich um weitere zwoelf Monate.')).toContain(
      'verlaengerungZuLang'
    )
  })

  it('laesst eine Verlaengerung um einen Monat in Ruhe', () => {
    expect(ids('Der Vertrag verlaengert sich um weitere 1 Monate.')).not.toContain(
      'verlaengerungZuLang'
    )
  })

  it('erkennt das Einschreiben als Kuendigungsform', () => {
    expect(ids('Die Kuendigung hat per Einschreiben zu erfolgen.')).toContain(
      'kuendigungNurSchriftlich'
    )
  })

  it('meldet ein Einschreiben ausserhalb der Kuendigung nicht', () => {
    expect(ids('Rechnungen werden per Einschreiben versandt.')).not.toContain(
      'kuendigungNurSchriftlich'
    )
  })
})

describe('Haftung und Preis', () => {
  it('erkennt den Ausschluss auch bei grober Fahrlaessigkeit', () => {
    expect(
      ids('Die Haftung des Anbieters ist ausgeschlossen, auch bei grober Fahrlaessigkeit.')
    ).toContain('haftungGrobeFahrlaessigkeit')
  })

  it('erkennt das einseitige Preisanpassungsrecht', () => {
    expect(ids('Der Anbieter kann die Beitraege jederzeit anpassen.')).toContain(
      'einseitigePreisaenderung'
    )
  })
})

describe('Beleg und Zusammenfassung', () => {
  it('zitiert den ganzen Satz, nicht nur die Wendung', () => {
    const text = 'Vorbemerkung. Der Mieter leistet eine Kaution von vier Nettokaltmieten. Ende.'
    const f = scanKlauseln(text).find((x) => x.id === 'kautionZuHoch')!
    expect(f.quote).toBe('Der Mieter leistet eine Kaution von vier Nettokaltmieten.')
  })

  it('nennt die Norm', () => {
    expect(scanKlauseln('Eine Karenzentschaedigung wird nicht gezahlt.')[0].law).toBe(
      '§ 74 Abs. 2 HGB'
    )
  })

  it('meldet dieselbe Regel nur einmal', () => {
    const text =
      'Eine Karenzentschaedigung wird nicht gezahlt. Ausdruecklich wird keine Karenzentschaedigung geschuldet.'
    expect(ids(text).filter((i) => i === 'wettbewerbOhneKarenz')).toHaveLength(1)
  })

  it('leitet das Mindestrisiko ab', () => {
    expect(minimumRisk(scanKlauseln('Die Kaution betraegt vier Nettokaltmieten.'))).toBe('high')
    expect(minimumRisk(scanKlauseln('Die Kuendigung hat per Einschreiben zu erfolgen.'))).toBe(
      'medium'
    )
    expect(minimumRisk(scanKlauseln('Ein ganz normaler Satz.'))).toBeUndefined()
  })
})

/**
 * Der eigentliche Nachweis: dieselben Vertraege, bei denen granite4.1:3b nur
 * 28,6 % der kritischen Klauseln fand und viermal "mittleres Risiko" meldete.
 */
describe('gegen die Eval-Fixtures', () => {
  const dir = join(__dirname, '..', '..', 'eval', 'fixtures', 'vertrag')
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
          id: string
          text: string
          expect: { redClauses: string[]; risk: string }
        }
    )

  it('findet ueberhaupt Fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(3)
  })

  for (const f of fixtures) {
    it(`${f.id}: Mindestrisiko passt zur Erwartung`, () => {
      const min = minimumRisk(scanKlauseln(f.text))
      if (f.expect.risk === 'low') {
        // Der faire Vertrag darf KEINEN roten Fund ausloesen.
        expect(min).not.toBe('high')
      } else {
        expect(min).toBe('high')
      }
    })
  }

  it('deckt die roten Klauseln der Fixtures weitgehend ab', () => {
    let hit = 0
    let total = 0
    const misses: string[] = []
    for (const f of fixtures) {
      const found = scanKlauseln(f.text)
      for (const expected of f.expect.redClauses) {
        total++
        const needle = expected.toLowerCase()
        if (found.some((x) => x.quote.toLowerCase().includes(needle))) hit++
        else misses.push(`${f.id}: ${expected}`)
      }
    }
    // Das Radar soll die schwersten Faelle sichern, nicht alle. Was hier
    // durchfaellt, bleibt Aufgabe des Modells.
    expect(hit / total, `nicht abgedeckt: ${misses.join(' | ')}`).toBeGreaterThanOrEqual(0.6)
  })
})
