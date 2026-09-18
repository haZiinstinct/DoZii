import { describe, it, expect } from 'vitest'
import { parseEml, decodeTextBytes } from './eml-parse'

/** Baut eine Mail mit CRLF-Zeilenenden, so wie sie auf der Platte liegt. */
function eml(...lines: string[]): string {
  return lines.join('\r\n')
}

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

/** Zeichen ueber Codepoints bauen - hier stehen sonst unsichtbare Zeichen im Quelltext. */
function chars(...codes: number[]): string {
  return String.fromCharCode(...codes)
}

describe('parseEml', () => {
  it('liest Header und Klartext-Body einer einfachen Mail', () => {
    const parsed = parseEml(
      eml(
        'From: amt@example.de',
        'To: max@example.de',
        'Subject: Ihr Antrag',
        'Date: Mon, 3 Feb 2025 09:12:00 +0100',
        '',
        'Sehr geehrte Damen und Herren,',
        'anbei der Bescheid.'
      )
    )

    expect(parsed.from).toBe('amt@example.de')
    expect(parsed.to).toBe('max@example.de')
    expect(parsed.subject).toBe('Ihr Antrag')
    expect(parsed.date).toBe('Mon, 3 Feb 2025 09:12:00 +0100')
    expect(parsed.body).toBe(
      'Von: amt@example.de\n' +
        'An: max@example.de\n' +
        'Datum: Mon, 3 Feb 2025 09:12:00 +0100\n' +
        'Betreff: Ihr Antrag\n' +
        '\n' +
        'Sehr geehrte Damen und Herren,\nanbei der Bescheid.'
    )
  })

  it('dekodiert base64-Bodies inklusive Umlauten', () => {
    const parsed = parseEml(
      eml(
        'From: jobcenter@example.de',
        'Subject: Nachweis',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        b64('Bitte reichen Sie die fehlenden Unterlagen für Ihre Prüfung nach.'),
        ''
      )
    )

    expect(parsed.body).toContain('fehlenden Unterlagen für Ihre Prüfung')
  })

  it('dekodiert quoted-printable inklusive Soft Line Breaks', () => {
    const parsed = parseEml(
      eml(
        'From: amt@example.de',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        'Gr=C3=BC=C3=9Fe aus der Beh=C3=B6rde, dieser Satz wurde weich =',
        'umgebrochen.',
        ''
      )
    )

    expect(parsed.body).toContain('Grüße aus der Behörde')
    expect(parsed.body).toContain('weich umgebrochen.')
  })

  it('dekodiert quoted-printable mit Windows-1252-Charset', () => {
    const parsed = parseEml(
      eml(
        'Subject: Test',
        'Content-Type: text/plain; charset=windows-1252',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        'Gr=FC=DFe und =84Anf=FChrungszeichen=93',
        ''
      )
    )

    expect(parsed.body).toContain('Grüße')
    // 0x84/0x93 sind in Windows-1252 typografische Anfuehrungszeichen,
    // in reinem latin1 waeren es Steuerzeichen.
    expect(parsed.body).toContain(chars(0x201e) + 'Anführungszeichen' + chars(0x201c))
  })

  it('bevorzugt text/plain in multipart/alternative', () => {
    const parsed = parseEml(
      eml(
        'From: amt@example.de',
        'Subject: Bescheid',
        'Content-Type: multipart/alternative; boundary="b1"',
        '',
        'Diese Preamble ist unsichtbar.',
        '--b1',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Reiner Text der Mail.',
        '--b1',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>HTML-Variante</p>',
        '--b1--',
        ''
      )
    )

    expect(parsed.body).toContain('Reiner Text der Mail.')
    expect(parsed.body).not.toContain('HTML-Variante')
    expect(parsed.body).not.toContain('Preamble')
  })

  it('wandelt HTML in Text, wenn es keinen text/plain-Teil gibt', () => {
    const parsed = parseEml(
      eml(
        'Subject: Nur HTML',
        'Content-Type: multipart/alternative; boundary="xyz"',
        '',
        '--xyz',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<html><head><style>p{color:red}</style></head><body>',
        '<p>Erste Zeile</p><p>Zweite&nbsp;Zeile<br>mit Umbruch</p>',
        '<p>AT&amp;T &lt;Zeichen&gt; &quot;zitiert&quot; &#39;einfach&#39;</p>',
        '</body></html>',
        '--xyz--',
        ''
      )
    )

    expect(parsed.body).toContain('Erste Zeile')
    expect(parsed.body).toContain('Zweite Zeile\nmit Umbruch')
    expect(parsed.body).toContain('AT&T <Zeichen> "zitiert" \'einfach\'')
    expect(parsed.body).not.toContain('color:red')
    expect(parsed.body).not.toMatch(/\n{3,}/)
  })

  it('dekodiert RFC-2047-Betreff in Base64', () => {
    const parsed = parseEml(
      eml('Subject: =?UTF-8?B?' + b64('Änderungsbescheid für März') + '?=', '', 'Text')
    )

    expect(parsed.subject).toBe('Änderungsbescheid für März')
    expect(parsed.body.startsWith('Betreff: Änderungsbescheid für März')).toBe(true)
  })

  it('dekodiert RFC-2047-Betreff in Quoted-Printable mit Unterstrichen', () => {
    const parsed = parseEml(
      eml('Subject: =?UTF-8?Q?Wichtige_Mitteilung_=C3=BCber_Ihren_Antrag?=', '', 'Text')
    )

    expect(parsed.subject).toBe('Wichtige Mitteilung über Ihren Antrag')
  })

  it('fuehrt gefaltete Header-Zeilen zusammen', () => {
    const parsed = parseEml(
      eml(
        'Subject: Sehr wichtige',
        '\tMitteilung zu Ihrem Vorgang',
        'To: max@example.de,',
        ' erika@example.de',
        '',
        'Text'
      )
    )

    expect(parsed.subject).toBe('Sehr wichtige Mitteilung zu Ihrem Vorgang')
    expect(parsed.to).toBe('max@example.de, erika@example.de')
  })

  it('setzt ueber mehrere Zeilen gefaltete kodierte Woerter zusammen', () => {
    const parsed = parseEml(
      eml('Subject: =?UTF-8?Q?Teil_eins_?=', ' =?UTF-8?Q?und_Teil_zwei?=', '', 'Text')
    )

    expect(parsed.subject).toBe('Teil eins und Teil zwei')
  })

  it('liest verschachtelte multipart-Teile und ueberspringt Anhaenge', () => {
    const parsed = parseEml(
      eml(
        'From: amt@example.de',
        'Content-Type: multipart/mixed; boundary="outer"',
        '',
        '--outer',
        'Content-Type: multipart/alternative; boundary="inner"',
        '',
        '--inner',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Innerer Klartext.',
        '--inner',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<b>Innerer HTML</b>',
        '--inner--',
        '--outer',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Disposition: attachment; filename="anhang.txt"',
        '',
        'Geheimer Anhang',
        '--outer--',
        ''
      )
    )

    expect(parsed.body).toContain('Innerer Klartext.')
    expect(parsed.body).not.toContain('Geheimer Anhang')
    expect(parsed.body).not.toContain('Innerer HTML')
  })

  it('gibt bei Text ohne Header den Rohtext zurueck', () => {
    const parsed = parseEml('Nur ein Zettel ohne Kopf.\n\nZweiter Absatz.')

    expect(parsed.from).toBeNull()
    expect(parsed.subject).toBeNull()
    expect(parsed.body).toBe('Nur ein Zettel ohne Kopf.\n\nZweiter Absatz.')
  })

  it('wirft bei Muell-Eingabe nicht und liefert etwas Lesbares', () => {
    const muell = chars(0x00, 0x01, 0xff) + ' ??? =?BROKEN?X?zzz?= --b1 Content-Type:'
    expect(() => parseEml(muell)).not.toThrow()
    expect(parseEml(muell).body).toContain('BROKEN')

    const abgeschnitten = eml(
      'Content-Type: multipart/alternative; boundary="fehlt"',
      '',
      'Text ohne jede Boundary'
    )
    expect(parseEml(abgeschnitten).body).toContain('Text ohne jede Boundary')
  })

  it('liefert fuer leere Eingaben ein leeres Ergebnis', () => {
    for (const input of ['', '   \r\n  ']) {
      const parsed = parseEml(input)
      expect(parsed.body).toBe('')
      expect(parsed.from).toBeNull()
      expect(parsed.to).toBeNull()
      expect(parsed.subject).toBeNull()
      expect(parsed.date).toBeNull()
    }
  })

  it('kommt mit einer Mail ohne Body aus', () => {
    const parsed = parseEml(eml('From: amt@example.de', 'Subject: Ohne Inhalt'))

    expect(parsed.subject).toBe('Ohne Inhalt')
    expect(parsed.body).toBe('Von: amt@example.de\nBetreff: Ohne Inhalt')
  })

  it('ignoriert Nicht-Text-Teile und unbekannte Transfer-Encodings', () => {
    const parsed = parseEml(
      eml(
        'Subject: Nur PDF',
        'Content-Type: multipart/mixed; boundary="m"',
        '',
        '--m',
        'Content-Type: application/pdf; name="bescheid.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        b64('%PDF-1.4 binaerkram'),
        '--m',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        'Der Bescheid hängt an.',
        '--m--',
        ''
      )
    )

    expect(parsed.body).toContain('Der Bescheid hängt an.')
    expect(parsed.body).not.toContain('binaerkram')
  })
})

describe('decodeTextBytes', () => {
  it('liest sauberes UTF-8', () => {
    expect(decodeTextBytes(Buffer.from('Grüße, §31 SGB II', 'utf8'), 'utf-8')).toBe(
      'Grüße, §31 SGB II'
    )
  })

  it('faellt ohne Charset-Angabe auf Windows-1252 zurueck', () => {
    // 'Grüße' in latin1 ist kein gueltiges UTF-8.
    const bytes = Uint8Array.from([0x47, 0x72, 0xfc, 0xdf, 0x65])
    expect(decodeTextBytes(bytes, null)).toBe('Grüße')
  })

  it('mappt den Windows-1252-Sonderbereich statt Steuerzeichen zu liefern', () => {
    const bytes = Uint8Array.from([0x80, 0x93, 0x96, 0x92])
    expect(decodeTextBytes(bytes, 'windows-1252')).toBe(chars(0x20ac, 0x201c, 0x2013, 0x2019))
  })
})
