/**
 * Deterministische Fristberechnung nach §§ 187, 188, 193 BGB.
 *
 * Diese Datei ist der Grund, warum das Modell Fristen nicht selbst rechnet:
 * Das Modell liefert den Anker (Bezugsdatum, Zitat, ggf. woertliche
 * Fristangabe), hier entsteht daraus ein Datum - nachvollziehbar, testbar und
 * ohne `Date.now()`. Der heutige Tag wird immer hereingereicht, damit die
 * Logik reproduzierbar bleibt.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 */

import {
  addDays,
  daysInMonth,
  diffDays,
  holidayNameFor,
  isNonWorkingDay,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
  weekdayOf
} from './german-holidays'
import { defaultRuleFor } from './deadline-rules'
import type { DeadlineAnchor, DeadlineConfidence, DeadlineKind, DeadlinePeriodUnit } from './types'

const WEEKDAY_NAMES_DE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag'
] as const

/**
 * Obergrenzen je Einheit fuer Fristangaben aus dem Dokument. Eine vom Modell
 * gelesene "Frist von 9999 Tagen" ist ein Lesefehler, kein Rechtsanspruch -
 * in dem Fall greift der Regelkatalog.
 */
const MAX_PERIOD_VALUE: Record<DeadlinePeriodUnit, number> = {
  day: 730,
  week: 104,
  month: 24,
  year: 5
}

/**
 * Bekanntgabefiktion: ein per Post verschickter Verwaltungsakt gilt erst am
 * vierten Tag nach Aufgabe zur Post als bekannt gegeben (§ 41 Abs. 2 VwVfG,
 * § 122 Abs. 2 AO, § 37 Abs. 2 SGB X; seit 1.1.2025 vier statt drei Tage).
 */
const BEKANNTGABE_DAYS = 4

/** Rechtsbehelfe gegen Verwaltungsakte - nur fuer sie gilt die Fiktion. */
const POSTAL_FICTION_KINDS: ReadonlySet<DeadlineKind> = new Set([
  'widerspruch',
  'einspruch',
  'klage'
])

/** Stand das Bezugsdatum ausdruecklich beim Zugang ("Zugestellt am ...")? */
const DELIVERY_QUOTE =
  /zugestellt|zustellung|bekannt|zugang|zugegangen|erhalten|eingang|eingegangen/iu

/** Nach wie vielen Werktagsspruengen abgebrochen wird (Endlosschutz). */
const MAX_WORKING_DAY_SHIFT = 14

/**
 * Addiert eine Frist auf den Ereignistag nach deutschem Fristenrecht.
 *
 * § 187 Abs. 1 BGB (Ereignistag zaehlt nicht mit) und § 188 Abs. 2 BGB
 * (Ende am gleichnamigen bzw. gleichzahligen Tag) heben sich rechnerisch auf:
 * Bescheid vom 15.03. + 1 Monat endet am 15.04., nicht am 16.04.
 * § 188 Abs. 3 BGB: fehlt die Tageszahl im Zielmonat (31.01. + 1 Monat),
 * endet die Frist am letzten Tag des Monats.
 * Wochenfristen laufen analog auf denselben Wochentag (7 Tage je Woche).
 */
export function addPeriod(startIso: string, value: number, unit: DeadlinePeriodUnit): string {
  const parts = parseIsoDate(startIso)
  if (!parts) throw new Error(`Ungueltiges Startdatum: ${startIso}`)
  if (!Number.isInteger(value)) throw new Error(`Fristdauer muss ganzzahlig sein: ${value}`)

  switch (unit) {
    case 'day':
      return addDays(startIso, value)
    case 'week':
      return addDays(startIso, value * 7)
    case 'month':
      return addMonths(parts.year, parts.month, parts.day, value)
    case 'year':
      return addMonths(parts.year, parts.month, parts.day, value * 12)
  }
}

/** Monatsarithmetik mit Kappung auf den letzten Monatstag (§ 188 Abs. 3 BGB). */
function addMonths(year: number, month: number, day: number, months: number): string {
  const zeroBased = year * 12 + (month - 1) + months
  const targetYear = Math.floor(zeroBased / 12)
  const targetMonth = (zeroBased % 12) + 1
  return toIsoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
}

/**
 * § 193 BGB: faellt das Fristende auf Samstag, Sonntag oder einen Feiertag,
 * endet die Frist erst am naechsten Werktag.
 */
export function shiftToNextWorkingDay(iso: string): { iso: string; shifted: boolean } {
  let current = iso
  for (let i = 0; i < MAX_WORKING_DAY_SHIFT; i++) {
    if (!isNonWorkingDay(current)) {
      return { iso: current, shifted: current !== iso }
    }
    current = addDays(current, 1)
  }
  // Unerreichbar - in Deutschland folgen nie 14 arbeitsfreie Tage aufeinander.
  throw new Error(`Kein Werktag innerhalb von ${MAX_WORKING_DAY_SHIFT} Tagen nach ${iso}`)
}

/** Verbleibende ganze Tage bis zum Fristende (negativ = abgelaufen). */
export function daysUntil(dueIso: string, todayIso: string): number {
  return diffDays(todayIso, dueIso)
}

export interface ComputeInput {
  anchor: DeadlineAnchor
  /** Heutiger Tag als ISO-Datum - nie aus `Date.now()` in dieser Datei. */
  todayIso: string
  /** Dokumenttext oder Stichwort daraus, fuer die Fallgruppen des Regelkatalogs. */
  hint?: string
}

export interface ComputedDeadline {
  dueDateIso: string
  /**
   * Spaetestes Fristende, wenn ab dem Bescheiddatum gerechnet wurde und der
   * Bescheid per Post kam (Bekanntgabe +4 Tage). Sonst null. Die Frist gilt
   * erst als abgelaufen, wenn auch dieses Datum vorbei ist.
   */
  latestDueDateIso: string | null
  source: 'explicit' | 'computed'
  note: string | null
  confidence: DeadlineConfidence
  daysLeft: number
  urgency: 'expired' | 'critical' | 'soon' | 'ok'
}

/**
 * Berechnet das Fristende aus einem Anker.
 *
 * Vorrang hat ein im Dokument genanntes Enddatum; sonst Bezugsdatum plus
 * Dauer (aus dem Dokument, ersatzweise aus dem Regelkatalog). Fehlen beide,
 * kommt null zurueck - eine erfundene Frist waere schlimmer als keine.
 */
export function computeDeadline(input: ComputeInput): ComputedDeadline | null {
  const { anchor, todayIso, hint } = input
  if (!isValidIsoDate(todayIso)) return null

  const notes: string[] = []
  let confidence = anchor.confidence
  let base: string
  let source: 'explicit' | 'computed'

  const explicit = anchor.explicitDueDateIso
  let latestBase: string | null = null
  if (explicit && isValidIsoDate(explicit)) {
    base = explicit
    source = 'explicit'
  } else {
    const start = anchor.startDateIso
    if (!start || !isValidIsoDate(start)) return null

    const period = resolvePeriod(anchor, hint)
    if (!period) return null
    if (period.note) notes.push(period.note)
    // Aus dem Regelkatalog statt aus dem Dokument: die Aussage ist nur so
    // sicher wie die Einordnung der Fristart.
    if (period.fromRule) confidence = downgrade(confidence)

    base = addPeriod(start, period.value, period.unit)
    source = 'computed'

    /*
     * Gerechnet ab dem Datum des Bescheids statt ab dem Zugang: das Ergebnis
     * ist das FRUEHESTE Fristende. Fuer den Countdown ist das die sichere
     * Seite - fuer "abgelaufen" nicht. Wer der Anzeige glaubt, gaebe einen
     * Rechtsbehelf auf, der noch laeuft. Deshalb zusaetzlich das spaeteste
     * Ende mit Bekanntgabefiktion.
     */
    if (
      POSTAL_FICTION_KINDS.has(anchor.kind) &&
      !(anchor.startDateQuote && DELIVERY_QUOTE.test(anchor.startDateQuote))
    ) {
      latestBase = addPeriod(addDays(start, BEKANNTGABE_DAYS), period.value, period.unit)
    }
  }

  /*
   * § 193 BGB schuetzt den, der bis zum Fristende handeln muss. Fuer
   * Kuendigungsfristen gilt er nicht (BGH): faellt der Kuendigungstermin auf
   * einen Sonntag, bleibt es bei diesem Tag - verschoben haette DoZii einen
   * Tag zu viel Luft angezeigt.
   */
  let shift = shiftToNextWorkingDay(base)
  if (shift.shifted && anchor.kind === 'kuendigung') {
    notes.push(
      'Der Termin fällt auf einen arbeitsfreien Tag, verschiebt sich aber nicht - § 193 BGB gilt für Kündigungsfristen nicht. Die Kündigung muss rechtzeitig vorher zugehen.'
    )
    shift = { iso: base, shifted: false }
  } else if (shift.shifted) {
    notes.push(describeShift(base, shift.iso))
  }

  let latestDueDateIso: string | null = null
  if (latestBase) {
    const latest = shiftToNextWorkingDay(latestBase).iso
    if (latest > shift.iso) {
      latestDueDateIso = latest
      notes.push(
        `Gerechnet ab dem Datum des Bescheids. Kam er per Post, gilt er erst am vierten Tag danach als bekannt gegeben (§ 41 Abs. 2 VwVfG, § 122 Abs. 2 AO, § 37 Abs. 2 SGB X) - die Frist endet dann spätestens am ${formatGermanDate(latest)}.`
      )
    }
  }

  const daysLeft = daysUntil(shift.iso, todayIso)
  return {
    dueDateIso: shift.iso,
    latestDueDateIso,
    source,
    note: notes.length > 0 ? notes.join(' ') : null,
    confidence,
    daysLeft,
    urgency: deadlineUrgency(shift.iso, latestDueDateIso, todayIso)
  }
}

export type DeadlineUrgency = ComputedDeadline['urgency']

/**
 * Dringlichkeit einer Frist. Ist das frueheste Ende vorbei, das spaeteste
 * (Bekanntgabefiktion) aber nicht, zaehlt das spaeteste - "abgelaufen" erst,
 * wenn beide vorbei sind.
 */
export function deadlineUrgency(
  dueIso: string,
  latestIso: string | null | undefined,
  todayIso: string
): DeadlineUrgency {
  return urgencyFor(daysUntil(effectiveDueIso(dueIso, latestIso, todayIso), todayIso))
}

/** Das Fristende, an dem sich Countdown und "noch offen" ausrichten. */
export function effectiveDueIso(
  dueIso: string,
  latestIso: string | null | undefined,
  todayIso: string
): string {
  return dueIso < todayIso && latestIso ? latestIso : dueIso
}

interface ResolvedPeriod {
  value: number
  unit: DeadlinePeriodUnit
  fromRule: boolean
  note: string | null
}

/** Dauer aus dem Dokument, sonst aus dem Regelkatalog. */
function resolvePeriod(anchor: DeadlineAnchor, hint?: string): ResolvedPeriod | null {
  const { periodValue, periodUnit } = anchor
  if (periodUnit !== null && periodValue !== null && isPlausiblePeriod(periodValue, periodUnit)) {
    return { value: periodValue, unit: periodUnit, fromRule: false, note: null }
  }

  const rule = defaultRuleFor(anchor.kind, hint)
  if (!rule) return null

  const applied = formatPeriod(rule.periodValue, rule.periodUnit)
  const notes = [
    `Das Dokument nennt keine verwertbare Fristdauer - angesetzt wurden ${applied} nach ${rule.legalBasis}.`
  ]
  if (rule.note) notes.push(rule.note)
  return { value: rule.periodValue, unit: rule.periodUnit, fromRule: true, note: notes.join(' ') }
}

/** Gemeinsame Plausibilitaetsgrenze - auch der Anker-Parser prueft damit. */
export function isPlausiblePeriod(value: number, unit: DeadlinePeriodUnit): boolean {
  if (!Number.isInteger(value)) return false
  return value > 0 && value <= MAX_PERIOD_VALUE[unit]
}

function formatPeriod(value: number, unit: DeadlinePeriodUnit): string {
  const labels: Record<DeadlinePeriodUnit, [string, string]> = {
    day: ['Tag', 'Tage'],
    week: ['Woche', 'Wochen'],
    month: ['Monat', 'Monate'],
    year: ['Jahr', 'Jahre']
  }
  const [singular, plural] = labels[unit]
  return `${value} ${value === 1 ? singular : plural}`
}

/** Deutscher Satz zur Verschiebung nach § 193 BGB - der Nutzer soll sie sehen. */
function describeShift(originalIso: string, shiftedIso: string): string {
  const reasons: string[] = []
  const weekday = weekdayOf(originalIso)
  if (weekday === 6) reasons.push('einen Samstag')
  else if (weekday === 0) reasons.push('einen Sonntag')
  const holiday = holidayNameFor(originalIso)
  if (holiday) reasons.push(`den Feiertag ${holiday}`)

  const target = `${WEEKDAY_NAMES_DE[weekdayOf(shiftedIso)]}, den ${formatGermanDate(shiftedIso)}`
  return `Fristende fiel auf ${reasons.join(' und ')} - nach § 193 BGB verschoben auf ${target}.`
}

function formatGermanDate(iso: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  const dd = String(parts.day).padStart(2, '0')
  const mm = String(parts.month).padStart(2, '0')
  return `${dd}.${mm}.${parts.year}`
}

function downgrade(confidence: DeadlineConfidence): DeadlineConfidence {
  return confidence === 'high' ? 'medium' : confidence
}

function urgencyFor(daysLeft: number): DeadlineUrgency {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'soon'
  return 'ok'
}
