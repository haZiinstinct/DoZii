import { describe, it, expect } from 'vitest'
import { escapeRtf, markdownToRtf } from './rtf'

const HEADER = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}'

/** Klammerbilanz unter Beachtung von \-Escapes und Steuerwoertern. */
function braceBalance(rtf: string): number {
  let depth = 0
  for (let i = 0; i < rtf.length; i++) {
    const char = rtf[i]
    if (char === '\\') {
      i++ // naechstes Zeichen gehoert zum Escape bzw. Steuerwort
      continue
    }
    if (char === '{') depth++
    else if (char === '}') depth--
  }
  return depth
}

function isPureAscii(text: string): boolean {
  return [...text].every((char) => char.charCodeAt(0) < 128)
}

describe('escapeRtf', () => {
  it('wandelt Umlaute und ß in \\u<dezimal>?', () => {
    expect(escapeRtf('äöü')).toBe('\\u228?\\u246?\\u252?')
    expect(escapeRtf('ÄÖÜ')).toBe('\\u196?\\u214?\\u220?')
    expect(escapeRtf('Grüße')).toBe('Gr\\u252?\\u223?e')
  })

  it('wandelt Euro-Zeichen und typografische Satzzeichen', () => {
    expect(escapeRtf('€')).toBe('\\u8364?')
    expect(escapeRtf('„Zitat“')).toBe('\\u8222?Zitat\\u8220?')
    expect(escapeRtf('a–b')).toBe('a\\u8211?b')
  })

  it('ersetzt Emoji durch ein Fragezeichen', () => {
    expect(escapeRtf('ok 😀')).toBe('ok ?')
    expect(escapeRtf('👍🏽')).toBe('??')
  })

  it('escaped Backslash und geschweifte Klammern', () => {
    expect(escapeRtf('a\\b{c}d')).toBe('a\\\\b\\{c\\}d')
  })

  it('wandelt Tabulator und Zeilenumbruch in Steuerwoerter', () => {
    expect(escapeRtf('a\tb')).toBe('a\\tab b')
    expect(escapeRtf('a\nb')).toBe('a\\line b')
    expect(escapeRtf('a\r\nb')).toBe('a\\line b')
  })

  it('verwirft uebrige Steuerzeichen', () => {
    expect(escapeRtf(`a${String.fromCharCode(7)}b${String.fromCharCode(0)}c`)).toBe('abc')
  })

  it('laesst reines ASCII unveraendert', () => {
    expect(escapeRtf('Hallo Welt 123 !?')).toBe('Hallo Welt 123 !?')
    expect(escapeRtf('')).toBe('')
  })
})

describe('markdownToRtf', () => {
  it('liefert ein vollstaendiges Dokument mit korrektem Kopf', () => {
    const rtf = markdownToRtf('Hallo')
    expect(rtf.startsWith(HEADER)).toBe(true)
    expect(rtf.endsWith('}')).toBe(true)
    expect(rtf).toContain('\\uc1\\f0\\fs22')
    expect(braceBalance(rtf)).toBe(0)
  })

  it('kommt mit leerem Input klar', () => {
    const rtf = markdownToRtf('')
    expect(rtf.startsWith(HEADER)).toBe(true)
    expect(rtf.endsWith('}')).toBe(true)
    expect(rtf).not.toContain('\\par')
    expect(braceBalance(rtf)).toBe(0)
  })

  it('setzt Ueberschriften der Ebenen 1 bis 3 in absteigender Groesse', () => {
    const rtf = markdownToRtf('# Eins\n\n## Zwei\n\n### Drei')
    expect(rtf).toContain('\\b\\fs34 Eins\\par')
    expect(rtf).toContain('\\b\\fs30 Zwei\\par')
    expect(rtf).toContain('\\b\\fs26 Drei\\par')
  })

  it('haelt Zeilenumbrueche innerhalb eines Absatzes (Briefanschrift)', () => {
    const rtf = markdownToRtf('Max Mustermann\nMusterweg 1\n12345 Musterstadt')
    expect(rtf).toContain(
      '{\\pard\\sa120\\fs22 Max Mustermann\\line Musterweg 1\\line 12345 Musterstadt\\par}'
    )
  })

  it('trennt Absaetze an Leerzeilen', () => {
    const rtf = markdownToRtf('Erster\n\nZweiter')
    expect(rtf).toContain('{\\pard\\sa120\\fs22 Erster\\par}')
    expect(rtf).toContain('{\\pard\\sa120\\fs22 Zweiter\\par}')
  })

  it('rendert Aufzaehlungen mit - und * als Bullet-Liste', () => {
    const rtf = markdownToRtf('- Eins\n* Zwei')
    expect(rtf).toContain('{\\pard\\fi-284\\li284\\sa60\\fs22 \\bullet\\tab Eins\\par}')
    expect(rtf).toContain('{\\pard\\fi-284\\li284\\sa60\\fs22 \\bullet\\tab Zwei\\par}')
  })

  it('rueckt verschachtelte Listenebenen weiter ein', () => {
    const rtf = markdownToRtf('- Oben\n  - Tiefer')
    expect(rtf).toContain('\\li284\\sa60\\fs22 \\bullet\\tab Oben\\par')
    expect(rtf).toContain('\\li568\\sa60\\fs22 \\bullet\\tab Tiefer\\par')
  })

  it('rendert Checklisten als ASCII-Kaestchen', () => {
    const rtf = markdownToRtf('- [ ] Offen\n- [x] Erledigt\n- [X] Auch erledigt')
    expect(rtf).toContain('[ ]\\tab Offen\\par')
    expect(rtf).toContain('[x]\\tab Erledigt\\par')
    expect(rtf).toContain('[x]\\tab Auch erledigt\\par')
    expect(rtf).not.toContain('\\bullet\\tab Offen')
  })

  it('rendert **fett** und *kursiv*', () => {
    expect(markdownToRtf('**fett**')).toContain('{\\b fett}')
    expect(markdownToRtf('*kursiv*')).toContain('{\\i kursiv}')
  })

  it('rendert verschachtelte Auszeichnungen in beiden Richtungen', () => {
    expect(markdownToRtf('**fett mit *kursiv* drin**')).toContain(
      '{\\b fett mit {\\i kursiv} drin}'
    )
    expect(markdownToRtf('*kursiv mit **fett** drin*')).toContain(
      '{\\i kursiv mit {\\b fett} drin}'
    )
  })

  it('laesst unpaarige Sternchen als Text stehen', () => {
    const rtf = markdownToRtf('3 * 4 = 12')
    expect(rtf).toContain('3 * 4 = 12')
    expect(rtf).not.toContain('{\\i ')
  })

  it('rendert Zitate eingerueckt und kursiv', () => {
    const rtf = markdownToRtf('> Bitte antworten Sie bis zum 01.04.')
    expect(rtf).toContain(
      '{\\pard\\li284\\ri284\\sa120\\i\\cf3\\fs22 Bitte antworten Sie bis zum 01.04.\\par}'
    )
  })

  it('rendert --- als Trennlinie', () => {
    const rtf = markdownToRtf('Oben\n\n---\n\nUnten')
    expect(rtf).toContain('\\brdrb\\brdrs\\brdrw10\\brsp20\\sa120\\fs22')
  })

  it('setzt Inline-code farbig ab und interpretiert darin kein Markdown', () => {
    const rtf = markdownToRtf('Feld `**wert**` pruefen')
    expect(rtf).toContain('{\\cf2 **wert**}')
    expect(rtf).not.toContain('{\\b wert}')
  })

  it('reicht Tabellenzeilen als einfachen Text durch', () => {
    const rtf = markdownToRtf('| Frist | Datum |\n| --- | --- |\n| Widerspruch | 01.04. |')
    expect(rtf).toContain('| Frist | Datum |\\line | --- | --- |\\line | Widerspruch | 01.04. |')
  })

  it('beruecksichtigt die fontSize-Option in Halbpunkten', () => {
    const rtf = markdownToRtf('Text', { fontSize: 14 })
    expect(rtf).toContain('\\uc1\\f0\\fs28')
    expect(rtf).toContain('{\\pard\\sa120\\fs28 Text\\par}')
    // Unsinnige Werte werden geklemmt, nicht uebernommen.
    expect(markdownToRtf('Text', { fontSize: 999 })).toContain('\\fs144')
    expect(markdownToRtf('Text', { fontSize: Number.NaN })).toContain('\\fs22')
  })

  it('setzt title als \\info-Titel und als Ueberschrift', () => {
    const rtf = markdownToRtf('Inhalt', { title: 'Widerspruch Bürgergeld' })
    expect(rtf).toContain('{\\info{\\title Widerspruch B\\u252?rgergeld}}')
    expect(rtf).toContain('\\b\\fs34 Widerspruch B\\u252?rgergeld\\par')
    expect(braceBalance(rtf)).toBe(0)
  })

  it('escaped Sonderzeichen auch im Fliesstext', () => {
    const rtf = markdownToRtf('Betrag: 1.234,50 € – „Grüße“ {Aktenzeichen}')
    expect(rtf).toContain('\\u8364?')
    expect(rtf).toContain('Gr\\u252?\\u223?e')
    expect(rtf).toContain('\\{Aktenzeichen\\}')
    expect(isPureAscii(rtf)).toBe(true)
  })

  it('erzeugt aus einem gemischten Dokument gueltiges, rein asciihaltiges RTF', () => {
    const md = [
      '# Zeugnis-Prüfung',
      '',
      'Sehr geehrte Damen und Herren,',
      '',
      '> "stets zu unserer Zufriedenheit"',
      '',
      '- [x] Formulierung geprüft',
      '- [ ] Nachbesserung angefordert',
      '',
      'Das entspricht **Note 3** – siehe `§ 109 GewO`.',
      '',
      '---',
      '',
      'Mit freundlichen Grüßen'
    ].join('\n')
    const rtf = markdownToRtf(md, { title: 'Prüfbericht' })
    expect(braceBalance(rtf)).toBe(0)
    expect(isPureAscii(rtf)).toBe(true)
    expect(rtf.startsWith(HEADER)).toBe(true)
    expect(rtf.endsWith('}')).toBe(true)
  })
})
