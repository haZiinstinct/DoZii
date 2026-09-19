/**
 * ICS-Kalenderdateien (RFC 5545) fuer den Fristen-Radar.
 *
 * Bewusst selbst gebaut statt per Bibliothek: eine Handvoll ganztaegiger
 * VEVENTs braucht keine Abhaengigkeit. Die drei Stellen, an denen
 * handgeschriebene ICS-Dateien ueblicherweise kaputtgehen, sind hier
 * abgedeckt: Zeilenfaltung auf 75 Oktette, TEXT-Escaping und CRLF.
 *
 * Keine Node-/DOM-APIs -> reine Logik, ohne electron testbar.
 */

/** Maximale Laenge einer Content-Line in Oktetten (RFC 5545, 3.1). */
const MAX_OCTETS = 75

/** CRLF ist im Standard vorgeschrieben, nicht optional. */
const CRLF = '\r\n'

const DEFAULT_PROD_ID = '-//DoZii//Fristen-Radar//DE'

export interface IcsEvent {
  /** Stabile Kennung; bei Re-Export desselben Termins identisch halten. */
  uid: string
  summary: string
  description?: string
  /** Ganztaegiger Termin als ISO-Datum (YYYY-MM-DD). */
  dateIso: string
  /** Erinnerungen n Tage vorher, z.B. [7, 1]. */
  alarmDaysBefore?: number[]
}

export interface IcsCalendarOptions {
  prodId?: string
}

/**
 * Escaping fuer TEXT-Werte (RFC 5545, 3.3.11). Reihenfolge ist wichtig:
 * der Backslash zuerst, sonst werden die eigenen Escapes nochmal escaped.
 */
export function escapeIcsText(value: string): string {
  return stripControlChars(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Steuerzeichen (ausser TAB) haben in ICS-Werten nichts verloren; Zeilen-
 * umbrueche werden weiter unten zu \n escaped. Bewusst als Schleife statt
 * als Regex - ein Zeichenbereich mit echten Steuerzeichen im Quelltext ist
 * unlesbar und nicht diff-freundlich.
 */
function stripControlChars(value: string): string {
  let out = ''
  for (const char of value) {
    const cp = char.codePointAt(0) ?? 0
    if (cp === 127) continue
    if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) continue
    out += char
  }
  return out
}

/**
 * Baut einen kompletten VCALENDAR-String. Events mit unbrauchbarem Datum
 * werden uebersprungen statt eine kaputte Datei zu erzeugen - ein Termin
 * weniger ist besser als ein Kalender, den Outlook gar nicht erst oeffnet.
 */
export function buildIcsCalendar(events: IcsEvent[], opts: IcsCalendarOptions = {}): string {
  const usable = events
    .map((event) => ({ event, start: parseIsoDate(event.dateIso) }))
    .filter((entry): entry is { event: IcsEvent; start: Date } => entry.start !== null)

  // Kein Date.now(): DTSTAMP wird aus dem Datum des ersten brauchbaren Events
  // abgeleitet. Gleicher Input -> byte-gleiche Datei (testbar, und ein
  // erneuter Export erzeugt keinen kuenstlichen Unterschied).
  const dtStamp = usable.length > 0 ? `${formatIcsDate(usable[0].start)}T000000Z` : ''

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeIcsText(opts.prodId?.trim() || DEFAULT_PROD_ID)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  usable.forEach((entry, index) => {
    lines.push(...buildEventLines(entry.event, entry.start, dtStamp, index))
  })

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join(CRLF) + CRLF
}

function buildEventLines(event: IcsEvent, start: Date, dtStamp: string, index: number): string[] {
  const uid = event.uid.trim() || `dozii-${index}@dozii.local`
  const summary = event.summary.trim()
  const description = event.description?.trim() ?? ''

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${dtStamp}`,
    // Ganztaegig: VALUE=DATE, DTEND ist der Folgetag (das Ende ist exklusiv).
    `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(addDays(start, 1))}`,
    `SUMMARY:${escapeIcsText(summary)}`
  ]

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`)
  }

  // Ganztaegige Fristen blockieren keine Zeit im Kalender.
  lines.push('TRANSP:TRANSPARENT')

  for (const days of normalizeAlarmDays(event.alarmDaysBefore)) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      // Relativ zum Beginn (RELATED=START ist der Default).
      `TRIGGER:-P${days}D`,
      'END:VALARM'
    )
  }

  lines.push('END:VEVENT')
  return lines
}

/** Ganze Tage >= 0, ohne Duplikate, in der uebergebenen Reihenfolge. */
function normalizeAlarmDays(days: number[] | undefined): number[] {
  if (!days) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const raw of days) {
    if (!Number.isFinite(raw)) continue
    const value = Math.trunc(raw)
    if (value < 0 || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * ISO-Datum -> UTC-Mitternacht. Der Roundtrip ueber Date.UTC faengt
 * Scheindaten wie 2026-02-30 ab, die `new Date()` stillschweigend
 * weiterrechnen wuerde.
 */
function parseIsoDate(dateIso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** YYYYMMDD (Werttyp DATE). */
function formatIcsDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Faltet eine Content-Line auf 75 Oktette. Gezaehlt werden UTF-8-Bytes, nicht
 * Zeichen - sonst rutschen Zeilen mit Umlauten ueber das Limit. Iteriert wird
 * ueber Codepoints, damit weder ein Mehrbyte-Zeichen noch ein Surrogatpaar
 * zerschnitten wird. Jede Folgezeile beginnt mit einem Leerzeichen, das selbst
 * mitzaehlt - dort bleiben also nur 74 Oktette Nutzlast.
 */
function foldLine(line: string): string {
  const chunks: string[] = []
  let current = ''
  let octets = 0
  let limit = MAX_OCTETS

  for (const char of line) {
    const size = utf8OctetLength(char)
    if (octets + size > limit) {
      chunks.push(current)
      current = ''
      octets = 0
      limit = MAX_OCTETS - 1
    }
    current += char
    octets += size
  }
  chunks.push(current)

  return chunks.join(`${CRLF} `)
}

function utf8OctetLength(char: string): number {
  const cp = char.codePointAt(0) ?? 0
  if (cp < 0x80) return 1
  if (cp < 0x800) return 2
  if (cp < 0x10000) return 3
  return 4
}
