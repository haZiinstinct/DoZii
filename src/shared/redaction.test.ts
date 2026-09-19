import { describe, it, expect } from 'vitest'
import {
  redactText,
  isValidIban,
  isValidLuhn,
  ALL_REDACTION_KINDS,
  DEFAULT_REDACTION_KINDS,
  REDACTION_KIND_LABELS,
  type RedactionResult
} from './redaction'

/** Spans muessen aufsteigend, ueberlappungsfrei und offset-treu sein. */
function expectConsistentSpans(input: string, result: RedactionResult): void {
  let previousEnd = -1
  for (const span of result.spans) {
    expect(span.start).toBeGreaterThanOrEqual(previousEnd)
    expect(span.end).toBeGreaterThan(span.start)
    expect(input.slice(span.start, span.end)).toBe(span.original)
    previousEnd = span.end
  }
}

describe('isValidIban', () => {
  it('akzeptiert gueltige IBANs mit und ohne Gruppierung', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('de89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('AT611904300234573201')).toBe(true)
    expect(isValidIban('GB82WEST12345698765432')).toBe(true)
  })

  it('lehnt falsche Pruefsumme und kaputte Formate ab', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false)
    expect(isValidIban('DE00370400440532013000')).toBe(false)
    expect(isValidIban('DE8937040044')).toBe(false)
    expect(isValidIban('1234567890')).toBe(false)
    expect(isValidIban('')).toBe(false)
  })
})

describe('isValidLuhn', () => {
  it('prueft Kartennummern mit und ohne Trennzeichen', () => {
    expect(isValidLuhn('4111 1111 1111 1111')).toBe(true)
    expect(isValidLuhn('5500-0000-0000-0004')).toBe(true)
    expect(isValidLuhn('4111 1111 1111 1112')).toBe(false)
    expect(isValidLuhn('1234 5678 9012 3456')).toBe(false)
    expect(isValidLuhn('')).toBe(false)
  })
})

describe('redactText - Grenzfaelle', () => {
  it('gibt leeren Text unveraendert zurueck', () => {
    const result = redactText('')
    expect(result.text).toBe('')
    expect(result.spans).toEqual([])
    expect(result.countByKind).toEqual({})
  })

  it('laesst Text ohne Treffer voellig unveraendert', () => {
    const input = 'Sehr geehrte Damen und Herren, Ihr Antrag wurde geprüft.'
    const result = redactText(input)
    expect(result.text).toBe(input)
    expect(result.spans).toHaveLength(0)
    expect(result.countByKind).toEqual({})
  })

  it('schwaerzt nichts bei leerer kinds-Liste', () => {
    const input = 'IBAN DE89 3704 0044 0532 0130 00'
    const result = redactText(input, { kinds: [] })
    expect(result.text).toBe(input)
    expect(result.spans).toHaveLength(0)
  })
})

describe('redactText - IBAN', () => {
  it('schwaerzt eine IBAN ohne Leerzeichen', () => {
    const result = redactText('Konto: DE89370400440532013000.')
    expect(result.text).toBe('Konto: [IBAN geschwaerzt].')
    expect(result.countByKind).toEqual({ iban: 1 })
  })

  it('schwaerzt eine IBAN mit Vierergruppen', () => {
    const input = 'Bitte auf DE89 3704 0044 0532 0130 00 ueberweisen.'
    const result = redactText(input)
    expect(result.text).toBe('Bitte auf [IBAN geschwaerzt] ueberweisen.')
    expect(result.spans[0].kind).toBe('iban')
    expect(result.spans[0].original).toBe('DE89 3704 0044 0532 0130 00')
    expectConsistentSpans(input, result)
  })

  it('laesst eine IBAN mit falscher Pruefsumme stehen', () => {
    const input = 'Aktenkennung DE89 3704 0044 0532 0130 01 beachten'
    const result = redactText(input)
    expect(result.text).toBe(input)
    expect(result.countByKind.iban).toBeUndefined()
  })

  it('zieht bei nachfolgendem BIC nur die IBAN selbst ein', () => {
    const result = redactText('DE89 3704 0044 0532 0130 00 BIC COBADEFFXXX')
    expect(result.text).toBe('[IBAN geschwaerzt] BIC COBADEFFXXX')
    expect(result.countByKind.iban).toBe(1)
  })
})

describe('redactText - Kreditkarte', () => {
  it('schwaerzt eine Luhn-gueltige Kartennummer', () => {
    const result = redactText('Karte 4111 1111 1111 1111 abgebucht')
    expect(result.text).toBe('Karte [Kreditkarte geschwaerzt] abgebucht')
    expect(result.countByKind.creditcard).toBe(1)
  })

  it('laesst eine Luhn-ungueltige Ziffernfolge stehen', () => {
    const input = 'Beleg 1234 5678 9012 3456 liegt bei'
    const result = redactText(input)
    expect(result.text).toBe(input)
    expect(result.countByKind.creditcard).toBeUndefined()
  })

  it('haelt einen 18-stelligen Kontoblock trotz Luhn-Treffer fuer keine Karte', () => {
    // Genau die Ziffern einer deutschen IBAN - Luhn-gueltig, aber keine Kartenlaenge.
    const input = 'Block 3704 0044 0532 0130 01 pruefen'
    const result = redactText(input)
    expect(result.text).toBe(input)
  })
})

describe('redactText - Nummern mit Pruefformat', () => {
  it('schwaerzt die Steuer-Identifikationsnummer in beiden Schreibweisen', () => {
    expect(redactText('Steuer-ID 12345678901 vormerken').text).toBe(
      'Steuer-ID [Steuer-ID geschwaerzt] vormerken'
    )
    expect(redactText('Steuer-ID 86 095742719 vormerken').text).toBe(
      'Steuer-ID [Steuer-ID geschwaerzt] vormerken'
    )
  })

  it('schwaerzt Steuernummern mit Schraegstrichen', () => {
    expect(redactText('Steuernummer 12/345/67890').text).toBe(
      'Steuernummer [Steuernummer geschwaerzt]'
    )
    expect(redactText('Steuernummer 123/456/78901').text).toBe(
      'Steuernummer [Steuernummer geschwaerzt]'
    )
  })

  it('schwaerzt die Sozialversicherungsnummer', () => {
    const result = redactText('SV-Nummer 12 150380 M 123 im Bescheid')
    expect(result.text).toBe('SV-Nummer [SV-Nummer geschwaerzt] im Bescheid')
    expect(result.countByKind.svnummer).toBe(1)
  })
})

describe('redactText - Kontaktdaten', () => {
  it('schwaerzt E-Mail-Adressen', () => {
    const result = redactText('Antwort an max.mustermann@beratung-berlin.de erbeten')
    expect(result.text).toBe('Antwort an [E-Mail geschwaerzt] erbeten')
    expect(result.countByKind.email).toBe(1)
  })

  it('schwaerzt Telefonnummern in vier Schreibweisen', () => {
    for (const phone of [
      '+49 30 12345678',
      '0176/12345678',
      '030 12345678',
      '(030) 1234-5678',
      '+49 (0) 176 1234567'
    ]) {
      const result = redactText(`Rueckruf unter ${phone} moeglich`)
      expect(result.text).toBe('Rueckruf unter [Telefon geschwaerzt] moeglich')
      expect(result.spans[0].original).toBe(phone)
    }
  })

  it('haelt eine zu lange Ziffernkette fuer keine Rufnummer', () => {
    const input = 'Verwendungszweck 0044 0532 0130 01 angeben'
    const result = redactText(input)
    expect(result.text).toBe(input)
    expect(result.countByKind.phone).toBeUndefined()
  })
})

describe('redactText - nur mit Schluesselwort', () => {
  it('schwaerzt den Wert hinter "AZ:" und laesst das Schluesselwort stehen', () => {
    const result = redactText('AZ: 1234/56')
    expect(result.text).toBe('AZ: [Aktenzeichen geschwaerzt]')
    expect(result.spans[0].original).toBe('1234/56')
  })

  it('schwaerzt mehrteilige Aktenzeichen, ohne den Folgesatz zu fressen', () => {
    const input = 'Az. S 12 AS 345/26 wurde uns zugestellt.'
    const result = redactText(input)
    expect(result.text).toBe('Az. [Aktenzeichen geschwaerzt] wurde uns zugestellt.')
    expect(result.spans[0].original).toBe('S 12 AS 345/26')
    expectConsistentSpans(input, result)
  })

  it('laesst ein Aktenzeichen ohne Schluesselwort unangetastet', () => {
    const input = 'Das Schreiben 1234/56 vom 12.03.2024 liegt vor'
    const result = redactText(input)
    expect(result.text).toBe(input)
    expect(result.spans).toHaveLength(0)
  })

  it('schwaerzt Kunden- und Rechnungsnummern', () => {
    expect(redactText('Kundennummer: 1234567').text).toBe(
      'Kundennummer: [Kundennummer geschwaerzt]'
    )
    expect(redactText('Rechnungsnr. 2024-0815 vom Montag').text).toBe(
      'Rechnungsnr. [Kundennummer geschwaerzt] vom Montag'
    )
  })

  it('schwaerzt das Geburtsdatum nur hinter einem Schluesselwort', () => {
    expect(redactText('geboren am 12.03.1980 in Kiel').text).toBe(
      'geboren am [Geburtsdatum geschwaerzt] in Kiel'
    )
    expect(redactText('Geburtsdatum: 12.03.1980').text).toBe(
      'Geburtsdatum: [Geburtsdatum geschwaerzt]'
    )
    expect(redactText('geb. 3. Mai 1980').text).toBe('geb. [Geburtsdatum geschwaerzt]')

    const plain = 'Der Bescheid vom 12.03.1980 ist bestandskraeftig'
    expect(redactText(plain).text).toBe(plain)
  })
})

describe('redactText - plz-ort', () => {
  it('bleibt per Default aus', () => {
    const input = 'Musterweg 1, 12345 Musterstadt'
    expect(redactText(input).text).toBe(input)
    expect(DEFAULT_REDACTION_KINDS).not.toContain('plz-ort')
  })

  it('greift, wenn es ausdruecklich angefordert wird', () => {
    const result = redactText('Musterweg 1, 12345 Musterstadt', { kinds: ['plz-ort'] })
    expect(result.text).toBe('Musterweg 1, [Ort geschwaerzt]')
    expect(result.countByKind['plz-ort']).toBe(1)
  })
})

describe('redactText - customTerms', () => {
  it('trifft Begriffe mit Umlauten unabhaengig von der Gross-/Kleinschreibung', () => {
    const input = 'Frau Müller und Herr Öztürk, Grünstraße 4'
    const result = redactText(input, { customTerms: ['müller', 'Öztürk', 'Grünstraße'] })
    expect(result.text).toBe(
      'Frau [Name geschwaerzt] und Herr [Name geschwaerzt], [Name geschwaerzt] 4'
    )
    expect(result.countByKind.custom).toBe(3)
    expectConsistentSpans(input, result)
  })

  it('achtet auf Wortgrenzen', () => {
    const result = redactText('Maier zahlt im Mai, Mailand wartet', { customTerms: ['Mai'] })
    expect(result.text).toBe('Maier zahlt im [Name geschwaerzt], Mailand wartet')
    expect(result.countByKind.custom).toBe(1)
  })

  it('behandelt Regex-Metazeichen als normalen Text', () => {
    const result = redactText('Akte A.B und AXB', { customTerms: ['A.B'] })
    expect(result.text).toBe('Akte [Name geschwaerzt] und AXB')
  })

  it('ignoriert leere Begriffe', () => {
    const input = 'Nichts zu tun'
    expect(redactText(input, { customTerms: ['', '   '] }).text).toBe(input)
  })
})

describe('redactText - Ueberlappungen', () => {
  it('laesst den laengeren Treffer gewinnen (IBAN schlaegt custom)', () => {
    const result = redactText('IBAN DE89 3704 0044 0532 0130 00 pruefen', {
      customTerms: ['DE89']
    })
    expect(result.text).toBe('IBAN [IBAN geschwaerzt] pruefen')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0].kind).toBe('iban')
  })

  it('laesst die E-Mail gewinnen, wenn ein custom-Begriff darin steckt', () => {
    const result = redactText('Mail an max.mustermann@example.de', {
      customTerms: ['max.mustermann']
    })
    expect(result.text).toBe('Mail an [E-Mail geschwaerzt]')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0].kind).toBe('email')
  })
})

describe('redactText - keepLastChars', () => {
  it('laesst die letzten Zeichen zur Wiedererkennung stehen', () => {
    const result = redactText('Konto DE89 3704 0044 0532 0130 00', { keepLastChars: 4 })
    expect(result.text).toBe('Konto [IBAN ...3000]')
  })

  it('verdeckt vollstaendig, wenn der Treffer nicht laenger als keepLastChars ist', () => {
    const result = redactText('Herr Ali kommt', { customTerms: ['Ali'], keepLastChars: 10 })
    expect(result.text).toBe('Herr [Name geschwaerzt] kommt')
  })
})

describe('redactText - Gesamtdurchlauf', () => {
  const input = [
    'Sehr geehrte Frau Schmidt,',
    'Ihr Aktenzeichen: S 12 AS 345/26.',
    'Bitte ueberweisen Sie auf DE89 3704 0044 0532 0130 00.',
    'Rueckfragen an beratung@example.de oder 030 12345678.'
  ].join('\n')

  it('schwaerzt alle Fundstellen und zaehlt sie nach Art', () => {
    const result = redactText(input)
    expect(result.countByKind).toEqual({ aktenzeichen: 1, iban: 1, email: 1, phone: 1 })
    expect(result.text).toContain('Ihr Aktenzeichen: [Aktenzeichen geschwaerzt].')
    expect(result.text).toContain('auf [IBAN geschwaerzt].')
    expect(result.text).toContain('an [E-Mail geschwaerzt] oder [Telefon geschwaerzt].')
    expect(result.text).not.toMatch(/\d{4}/)
  })

  it('liefert sortierte, ueberlappungsfreie Spans mit Offsets auf den Originaltext', () => {
    const result = redactText(input)
    expect(result.spans).toHaveLength(4)
    expect(result.spans.map((span) => span.kind)).toEqual([
      'aktenzeichen',
      'iban',
      'email',
      'phone'
    ])
    expectConsistentSpans(input, result)
  })

  it('beruecksichtigt eine eingeschraenkte kinds-Liste', () => {
    const result = redactText(input, { kinds: ['email'] })
    expect(result.countByKind).toEqual({ email: 1 })
    expect(result.text).toContain('DE89 3704 0044 0532 0130 00')
  })
})

describe('Konstanten', () => {
  it('kennt alle Arten und beschriftet jede', () => {
    expect(ALL_REDACTION_KINDS).toHaveLength(12)
    expect(DEFAULT_REDACTION_KINDS).toHaveLength(11)
    for (const kind of ALL_REDACTION_KINDS) {
      expect(REDACTION_KIND_LABELS[kind]).toBeTruthy()
    }
  })
})
