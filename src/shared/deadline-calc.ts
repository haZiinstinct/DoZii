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
import type { DeadlineAnchor, DeadlineConfidence, DeadlinePeriodUnit } from './types'

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
  }

  const shift = shiftToNextWorkingDay(base)
  if (shift.shifted) notes.push(describeShift(base, shift.iso))

  const daysLeft = daysUntil(shift.iso, todayIso)
  return {
    dueDateIso: shift.iso,
    source,
    note: notes.length > 0 ? notes.join(' ') : null,
    confidence,
    daysLeft,
    urgency: urgencyFor(daysLeft)
  }
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

function isPlausiblePeriod(value: number, unit: DeadlinePeriodUnit): boolean {
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

function urgencyFor(daysLeft: number): ComputedDeadline['urgency'] {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'soon'
  return 'ok'
}
