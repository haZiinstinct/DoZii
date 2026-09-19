import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { findDeadlineAnchors, parseGermanDate } from './fristen-radar'

const KOPF = 'Stadt Hagen\nAktenzeichen 12/345\n\nHagen, 26. Februar 2026\n\n'

describe('parseGermanDate', () => {
  it('liest den ausgeschriebenen Monat', () => {
    expect(parseGermanDate('26. Februar 2026')).toBe('2026-02-26')
    expect(parseGermanDate('1. März 2027')).toBe('2027-03-01')
  })

  it('liest die reine Ziffernschreibweise', () => {
    expect(parseGermanDate('05.11.2026')).toBe('2026-11-05')
  })

  it('weist Unsinn zurueck', () => {
    expect(parseGermanDate('kein Datum')).toBeNull()
    expect(parseGermanDate('45. Februar 2026')).toBeNull()
  })
})

describe('Rechtsbehelfsfristen', () => {
  it('liest die Widerspruchsfrist samt Bezugsdatum', () => {
    const a = findDeadlineAnchors(
      KOPF +
        'Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Widerspruch erhoben werden.'
    )
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({
      kind: 'widerspruch',
      periodValue: 1,
      periodUnit: 'month',
      startDateIso: '2026-02-26'
    })
  })

  it('liest die Einspruchsfrist in Wochen', () => {
    const a = findDeadlineAnchors(
      KOPF + 'Gegen diesen Bussgeldbescheid koennen Sie binnen zwei Wochen Einspruch einlegen.'
    )
    expect(a[0]).toMatchObject({ kind: 'einspruch', periodValue: 2, periodUnit: 'week' })
  })

  it('liest Ziffern statt Zahlwoertern', () => {
    const a = findDeadlineAnchors(KOPF + 'Der Betrag ist innerhalb von 14 Tagen zu zahlen.')
    expect(a[0]).toMatchObject({ kind: 'zahlung', periodValue: 14, periodUnit: 'day' })
  })

  it('nimmt beim Widerspruchsbescheid die Klagefrist', () => {
    // Ein Widerspruchsbescheid enthaelt beide Woerter. Entscheidend ist die
    // Klage - wer hier auf "Widerspruch" hoert, nennt die falsche Frist.
    const a = findDeadlineAnchors(
      KOPF +
        'Gegen diesen Widerspruchsbescheid kann innerhalb eines Monats Klage beim Verwaltungsgericht erhoben werden.'
    )
    expect(a[0].kind).toBe('klage')
  })

  it('uebernimmt ein im Text genanntes Enddatum', () => {
    const a = findDeadlineAnchors(
      KOPF + 'Der Betrag ist innerhalb von vier Wochen, spaetestens am 30.03.2026, zu zahlen.'
    )
    expect(a[0].explicitDueDateIso).toBe('2026-03-30')
    expect(a[0].confidence).toBe('high')
  })
})

describe('Zurueckhaltung', () => {
  it('meldet keine Frist ohne erkennbare Fristart', () => {
    // Die Meldepflicht bei der Agentur fuer Arbeit ist keine
    // Rechtsbehelfsfrist - wer sie als solche anzeigt, verwirrt nur.
    expect(
      findDeadlineAnchors(
        KOPF + 'Sie sind verpflichtet, sich innerhalb von drei Tagen arbeitsuchend zu melden.'
      )
    ).toHaveLength(0)
  })

  it('meldet nichts ohne Bezugsdatum und ohne Enddatum', () => {
    expect(
      findDeadlineAnchors(
        'Gegen diesen Bescheid kann innerhalb eines Monats Widerspruch erhoben werden.'
      )
    ).toHaveLength(0)
  })

  it('nimmt das Datum aus dem Kopf, nicht aus dem Fliesstext', () => {
    // Weiter hinten stehen Geburtsdaten und Aktenzeichen. Als Bezugsdatum
    // taugt nur das Datum des Schreibens.
    const text =
      KOPF +
      'Geboren am 14. Juli 1988. Gegen diesen Bescheid kann innerhalb eines Monats Widerspruch erhoben werden.'
    expect(findDeadlineAnchors(text)[0].startDateIso).toBe('2026-02-26')
  })

  it('meldet dieselbe Frist nur einmal', () => {
    const text =
      KOPF +
      'Innerhalb eines Monats kann Widerspruch erhoben werden. Der Widerspruch ist innerhalb eines Monats einzulegen.'
    expect(findDeadlineAnchors(text)).toHaveLength(1)
  })

  it('belegt jeden Fund mit dem ganzen Satz', () => {
    const a = findDeadlineAnchors(
      KOPF + 'Gegen diesen Bescheid kann innerhalb eines Monats Widerspruch erhoben werden.'
    )
    expect(a[0].quote).toContain('innerhalb eines Monats')
    expect(a[0].quote).toContain('Widerspruch')
  })
})

/**
 * Der Nachweis an den echten Bescheiden: granite4.1:3b fand hier bei zwei von
 * sechs gar nichts und kam auf 42,9 % Trefferquote.
 */
describe('gegen die Eval-Fixtures', () => {
  const dir = join(__dirname, '..', '..', 'eval', 'fixtures', 'bescheid')
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
          id: string
          text: string
          expect: { deadlines?: Array<{ kind?: string }>; kinds?: string[] }
        }
    )

  it('findet ueberhaupt Fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(3)
  })

  it('erfindet beim Bescheid ohne Frist keine', () => {
    const f = fixtures.find((x) => x.id.includes('ohne-frist'))
    if (!f) return
    // Lieber nichts melden als etwas erfinden.
    expect(findDeadlineAnchors(f.text).length).toBeLessThanOrEqual(1)
  })

  it('findet in der Mehrheit der Bescheide eine Frist', () => {
    const withAny = fixtures.filter((f) => findDeadlineAnchors(f.text).length > 0)
    expect(withAny.length / fixtures.length).toBeGreaterThanOrEqual(0.6)
  })
})

describe('Bezugspunkt in der Zukunft', () => {
  it('rechnet nicht ab Rechtskraft', () => {
    // Rechtskraft tritt erst ein, wenn die Einspruchsfrist abgelaufen ist.
    // Vom Bescheiddatum gerechnet kam eine Zahlungsfrist heraus, die zwei
    // Wochen zu frueh lag - und voellig plausibel aussah.
    const t =
      KOPF +
      'Der Gesamtbetrag ist innerhalb von zwei Wochen nach Rechtskraft dieses Bescheides zu zahlen.'
    expect(findDeadlineAnchors(t)).toHaveLength(0)
  })

  it('nimmt ein genanntes Enddatum trotzdem', () => {
    const t =
      KOPF +
      'Der Betrag ist innerhalb von zwei Wochen nach Rechtskraft, spaetestens am 30.03.2026, zu zahlen.'
    expect(findDeadlineAnchors(t)[0].explicitDueDateIso).toBe('2026-03-30')
  })
})
