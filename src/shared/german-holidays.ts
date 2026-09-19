/**
 * Bundesweite Feiertage und Werktags-Pruefung - Grundlage der Fristberechnung.
 *
 * Bewusst OHNE lokale Zeitzone: ein Kalendertag ist hier ein ISO-String
 * 'YYYY-MM-DD', gerechnet wird ueber Date.UTC. Mit lokaler Zeit wuerde eine
 * Frist je nach Sommerzeit/Rechnerstandort um einen Tag springen - bei
 * Behoerdenfristen ist das ein realer Schaden, kein Schoenheitsfehler.
 *
 * Nur bundesweite Feiertage (in allen Laendern gesetzlich frei). Landesrecht
 * (Fronleichnam, Allerheiligen, Reformationstag ...) bleibt aussen vor: DoZii
 * kennt das Bundesland des Nutzers nicht. Ein uebersehener Landesfeiertag
 * setzt die Frist nach § 193 BGB hoechstens zu frueh an - das ist die
 * ungefaehrliche Richtung.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 */

export interface IsoDateParts {
  year: number
  month: number
  day: number
}

/** Anzahl Tage im Monat (month 1-12), schaltjahrsicher. */
export function daysInMonth(year: number, month: number): number {
  // Tag 0 des Folgemonats = letzter Tag des gesuchten Monats.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Zerlegt 'YYYY-MM-DD'. null, wenn Format oder Kalendertag ungueltig sind. */
export function parseIsoDate(iso: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

/** Format- und Kalenderpruefung. Modelle liefern gern "2025-02-30". */
export function isValidIsoDate(iso: string): boolean {
  return parseIsoDate(iso) !== null
}

export function toIsoDate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function requireParts(iso: string): IsoDateParts {
  const parts = parseIsoDate(iso)
  if (!parts) throw new Error(`Ungueltiges ISO-Datum: ${iso}`)
  return parts
}

/** Reine Tagesarithmetik ueber UTC - Monats- und Jahresgrenzen inklusive. */
export function addDays(iso: string, days: number): string {
  const { year, month, day } = requireParts(iso)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

/** Wochentag: 0 = Sonntag ... 6 = Samstag. */
export function weekdayOf(iso: string): number {
  const { year, month, day } = requireParts(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Ganze Tage zwischen zwei Kalendertagen (b - a). Beide Tage sind 00:00 UTC. */
export function diffDays(fromIso: string, toIso: string): number {
  const a = requireParts(fromIso)
  const b = requireParts(toIso)
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}

/**
 * Ostersonntag nach der anonymen gregorianischen Formel (Meeus/Jones/Butcher).
 *
 * a = Position im 19-jaehrigen Mondzyklus, b/c/d/e/f/g korrigieren Jahrhundert
 * und Schaltregel, h ist der Tag des Ostervollmonds im Maerz, l der Abstand
 * zum darauffolgenden Sonntag, m faengt die beiden Ausnahmefaelle ab
 * (26.04. -> 19.04., 25.04. -> 18.04.). Gueltig ab 1583 (gregorianisch).
 */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const total = h + l - 7 * m + 114
  return toIsoDate(year, Math.floor(total / 31), (total % 31) + 1)
}

// Feiertage sind pro Jahr fix - isNonWorkingDay laeuft in Schleifen, deshalb
// einmal rechnen und behalten.
const holidayCache = new Map<number, ReadonlyMap<string, string>>()

/**
 * Bundesweite Feiertage des Jahres als ISO-Datum -> Name.
 *
 * Zwei Feiertage koennen auf denselben Tag fallen (Christi Himmelfahrt am
 * 01.05., zuletzt 2008) - dann traegt der Tag beide Namen.
 */
export function nationwideHolidayNames(year: number): ReadonlyMap<string, string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const map = new Map<string, string>()
  const add = (iso: string, name: string): void => {
    const existing = map.get(iso)
    map.set(iso, existing ? `${existing} / ${name}` : name)
  }

  const easter = easterSunday(year)
  add(toIsoDate(year, 1, 1), 'Neujahr')
  add(addDays(easter, -2), 'Karfreitag')
  add(addDays(easter, 1), 'Ostermontag')
  add(toIsoDate(year, 5, 1), 'Tag der Arbeit')
  add(addDays(easter, 39), 'Christi Himmelfahrt')
  add(addDays(easter, 50), 'Pfingstmontag')
  add(toIsoDate(year, 10, 3), 'Tag der Deutschen Einheit')
  add(toIsoDate(year, 12, 25), '1. Weihnachtstag')
  add(toIsoDate(year, 12, 26), '2. Weihnachtstag')

  holidayCache.set(year, map)
  return map
}

/** Bundesweite Feiertage des Jahres als ISO-Daten. */
export function nationwideHolidays(year: number): Set<string> {
  return new Set(nationwideHolidayNames(year).keys())
}

/** Name des bundesweiten Feiertags an diesem Tag, sonst null. */
export function holidayNameFor(iso: string): string | null {
  const parts = parseIsoDate(iso)
  if (!parts) return null
  return nationwideHolidayNames(parts.year).get(iso) ?? null
}

/**
 * Samstag, Sonntag oder bundesweiter Feiertag.
 * Wirft bei ungueltigem Datum - ein still als Werktag behandelter Muelltag
 * wuerde eine falsche Frist erzeugen.
 */
export function isNonWorkingDay(iso: string): boolean {
  const { year, month, day } = requireParts(iso)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (weekday === 0 || weekday === 6) return true
  return nationwideHolidayNames(year).has(iso)
}
