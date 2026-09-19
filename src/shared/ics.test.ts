import { describe, it, expect } from 'vitest'
import { buildIcsCalendar, escapeIcsText, type IcsEvent } from './ics'

const encoder = new TextEncoder()

/** Faltung rueckgaengig machen - so pruefen wir Inhalt getrennt von Layout. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '')
}

function octets(line: string): number {
  return encoder.encode(line).length
}

function event(over: Partial<IcsEvent> = {}): IcsEvent {
  return { uid: 'a@dozii', summary: 'Widerspruch', dateIso: '2026-03-10', ...over }
}

describe('escapeIcsText', () => {
  it('escaped Backslash, Semikolon und Komma', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })

  it('wandelt Zeilenumbrueche in \\n (auch CRLF)', () => {
    expect(escapeIcsText('a\nb')).toBe('a\\nb')
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb')
  })

  it('escaped den Backslash zuerst - keine Doppel-Escapes', () => {
    expect(escapeIcsText('\\;')).toBe('\\\\\\;')
  })

  it('laesst Umlaute unveraendert und entfernt Steuerzeichen', () => {
    const bel = String.fromCharCode(7)
    expect(escapeIcsText(`Grüße ${bel}ä`)).toBe('Grüße ä')
  })
})

describe('buildIcsCalendar', () => {
  it('erzeugt ein gueltiges VCALENDAR-Geruest mit Standard-PRODID', () => {
    const ics = unfold(buildIcsCalendar([event()]))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//DoZii//Fristen-Radar//DE')
    expect(ics).toContain('CALSCALE:GREGORIAN')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('uebernimmt eine eigene prodId', () => {
    const ics = unfold(buildIcsCalendar([event()], { prodId: '-//Test//EN' }))
    expect(ics).toContain('PRODID:-//Test//EN')
  })

  it('schreibt ganztaegige Termine mit VALUE=DATE und DTEND am Folgetag', () => {
    const ics = unfold(buildIcsCalendar([event({ dateIso: '2026-03-10' })]))
    expect(ics).toContain('DTSTART;VALUE=DATE:20260310')
    expect(ics).toContain('DTEND;VALUE=DATE:20260311')
  })

  it('rechnet DTEND ueber Monats- und Jahresgrenzen korrekt', () => {
    const silvester = unfold(buildIcsCalendar([event({ dateIso: '2026-12-31' })]))
    expect(silvester).toContain('DTEND;VALUE=DATE:20270101')

    // Schaltjahr: 28.02.2028 -> 29.02.2028
    const schaltjahr = unfold(buildIcsCalendar([event({ dateIso: '2028-02-28' })]))
    expect(schaltjahr).toContain('DTEND;VALUE=DATE:20280229')
  })

  it('nutzt CRLF als Zeilenende - kein nacktes LF', () => {
    const ics = buildIcsCalendar([event()])
    expect(ics.split('\n').length).toBe(ics.split('\r\n').length)
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('escaped Sonderzeichen in SUMMARY und DESCRIPTION', () => {
    const ics = unfold(
      buildIcsCalendar([
        event({ summary: 'Frist; wichtig, sehr', description: 'Zeile 1\nZeile 2\\Ende' })
      ])
    )
    expect(ics).toContain('SUMMARY:Frist\\; wichtig\\, sehr')
    expect(ics).toContain('DESCRIPTION:Zeile 1\\nZeile 2\\\\Ende')
  })

  it('laesst DESCRIPTION weg, wenn keine gesetzt ist', () => {
    const ics = unfold(buildIcsCalendar([event()]))
    expect(ics).not.toContain('DESCRIPTION:')
  })

  it('faltet lange Zeilen auf maximal 75 Oktette, Fortsetzung mit Leerzeichen', () => {
    const ics = buildIcsCalendar([event({ summary: 'A'.repeat(300) })])
    const lines = ics.split('\r\n').filter((l) => l.length > 0)
    for (const line of lines) {
      expect(octets(line)).toBeLessThanOrEqual(75)
    }
    const continuations = lines.filter((l) => l.startsWith(' '))
    expect(continuations.length).toBeGreaterThan(0)
    expect(unfold(ics)).toContain(`SUMMARY:${'A'.repeat(300)}`)
  })

  it('faltet Mehrbyte-UTF-8 ohne Zeichen zu zerschneiden', () => {
    const summary = 'Ü'.repeat(120)
    const ics = buildIcsCalendar([event({ summary })])
    for (const line of ics.split('\r\n').filter((l) => l.length > 0)) {
      expect(octets(line)).toBeLessThanOrEqual(75)
    }
    const restored = unfold(ics)
    expect(restored).toContain(`SUMMARY:${summary}`)
    expect(restored).not.toContain('�')
  })

  it('erzeugt VALARM-Bloecke mit TRIGGER:-P<n>D', () => {
    const ics = unfold(buildIcsCalendar([event({ alarmDaysBefore: [7, 1] })]))
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-P7D')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2)
  })

  it('ignoriert negative und doppelte Alarm-Tage', () => {
    const ics = unfold(buildIcsCalendar([event({ alarmDaysBefore: [3, 3, -1, Number.NaN] })]))
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(1)
    expect(ics).toContain('TRIGGER:-P3D')
  })

  it('schreibt mehrere Events mit demselben DTSTAMP aus dem ersten Datum', () => {
    const ics = unfold(
      buildIcsCalendar([
        event({ uid: 'a@dozii', dateIso: '2026-03-10' }),
        event({ uid: 'b@dozii', dateIso: '2026-05-01' })
      ])
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/DTSTAMP:20260310T000000Z/g)).toHaveLength(2)
    expect(ics).toContain('UID:a@dozii')
    expect(ics).toContain('UID:b@dozii')
  })

  it('liefert einen gueltigen leeren Kalender ohne Events', () => {
    const ics = unfold(buildIcsCalendar([]))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('ueberspringt Events mit unbrauchbarem Datum', () => {
    const ics = unfold(
      buildIcsCalendar([
        event({ uid: 'kaputt@dozii', dateIso: '2026-02-30' }),
        event({ uid: 'leer@dozii', dateIso: '' }),
        event({ uid: 'ok@dozii', dateIso: '2026-04-01' })
      ])
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('UID:ok@dozii')
  })

  it('vergibt eine Ersatz-UID, wenn keine geliefert wird', () => {
    const ics = unfold(buildIcsCalendar([event({ uid: '   ' })]))
    expect(ics).toContain('UID:dozii-0@dozii.local')
  })

  it('ist deterministisch - kein Date.now()', () => {
    const events = [event({ alarmDaysBefore: [7] })]
    expect(buildIcsCalendar(events)).toBe(buildIcsCalendar(events))
  })
})
