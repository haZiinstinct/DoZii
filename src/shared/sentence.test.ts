import { describe, it, expect } from 'vitest'
import { sentenceAround } from './sentence'

/** Kleine Hilfe: Satz um das erste Vorkommen einer Wendung. */
function around(text: string, needle: string): string {
  return sentenceAround(text, text.indexOf(needle), needle.length)
}

describe('sentenceAround', () => {
  it('nimmt den ganzen Satz', () => {
    const t = 'Vorher. Der Mieter leistet eine Kaution. Danach.'
    expect(around(t, 'Kaution')).toBe('Der Mieter leistet eine Kaution.')
  })

  it('zerschneidet kein Datum', () => {
    // Der Anlass fuer dieses Modul: aus "spaetestens am 30.03.2026" wurde
    // "spaetestens am 30." und das Enddatum fehlte im Beleg.
    const t = 'Der Betrag ist innerhalb von vier Wochen, spaetestens am 30.03.2026, zu zahlen.'
    expect(around(t, 'innerhalb')).toBe(t)
  })

  it('zerschneidet kein ausgeschriebenes Datum', () => {
    const t = 'Die Frist endet am 30. April 2026 um Mitternacht.'
    expect(around(t, 'Frist')).toBe(t)
  })

  it('stolpert nicht ueber Paragrafenangaben', () => {
    const t = 'Die Anhoerung erfolgte nach § 102 Abs. 1 BetrVG ordnungsgemaess.'
    expect(around(t, 'Anhoerung')).toBe(t)
  })

  it('stolpert nicht ueber Abkuerzungen', () => {
    const t = 'Nebenkosten sind z. B. Heizung und Wasser zu tragen.'
    expect(around(t, 'Nebenkosten')).toBe(t)
  })

  it('beendet den Satz an der Leerzeile', () => {
    const t = 'Betreff: Kuendigung\n\nSehr geehrte Damen und Herren'
    expect(around(t, 'Kuendigung')).toBe('Betreff: Kuendigung')
  })

  it('kommt mit dem Textanfang und Textende zurecht', () => {
    expect(around('Ein einzelner Satz ohne Punkt', 'einzelner')).toBe(
      'Ein einzelner Satz ohne Punkt'
    )
  })

  it('trennt NICHT am einfachen Zeilenumbruch', () => {
    // Aus einem PDF kommt der Text mit Umbruch mitten im Satz. Wer daran
    // trennt, schneidet jeden zweiten Beleg ab - und faltet ihn zu einer
    // Zeile zusammen, damit er sich zitieren laesst.
    const t = 'Der Mieter leistet eine\nKaution von vier\nNettokaltmieten.'
    expect(around(t, 'Kaution')).toBe('Der Mieter leistet eine Kaution von vier Nettokaltmieten.')
  })
})
