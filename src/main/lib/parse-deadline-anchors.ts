/**
 * Validiert die Fristanker-Antwort von `buildDeadlineExtractPrompt`.
 *
 * Grundsatz "Evidence-or-Abstain": ein Anker ohne woertliches Zitat wird
 * verworfen - eine erfundene Frist ist schlimmer als gar keine. Gerechnet wird
 * hier nichts, das Enddatum bestimmt spaeter die deterministische
 * Fristberechnung.
 *
 * Wirft nie: kaputtes JSON, fehlende Felder und Unsinnswerte ergeben eine leere
 * Liste bzw. null-Felder. Keine Electron-/Node-APIs, damit testbar.
 */

import type {
  DeadlineAnchor,
  DeadlineConfidence,
  DeadlineKind,
  DeadlinePeriodUnit
} from '@shared/types'
import { extractJsonObject } from './extract-json'

const DEADLINE_KINDS: readonly DeadlineKind[] = [
  'widerspruch',
  'einspruch',
  'klage',
  'zahlung',
  'widerruf',
  'kuendigung',
  'mitwirkung',
  'sonstige'
]

const PERIOD_UNITS: readonly DeadlinePeriodUnit[] = ['day', 'week', 'month', 'year']

const CONFIDENCES: readonly DeadlineConfidence[] = ['high', 'medium', 'low']

/** Fallback, wenn das Modell kein Label liefert - die Fristenliste braucht eine Zeile. */
const FALLBACK_LABELS: Record<DeadlineKind, string> = {
  widerspruch: 'Widerspruchsfrist',
  einspruch: 'Einspruchsfrist',
  klage: 'Klagefrist',
  zahlung: 'Zahlungsfrist',
  widerruf: 'Widerrufsfrist',
  kuendigung: 'Kuendigungsfrist',
  mitwirkung: 'Mitwirkungsfrist',
  sonstige: 'Frist'
}

/** 60 Monate/Wochen/Tage sind noch plausibel, 600 ist Modell-Rauschen. */
const MAX_PERIOD_VALUE = 60

/** Plausibler Jahresbereich fuer Datumsangaben in Behoerdenpost und Vertraegen. */
const MIN_YEAR = 1990
const MAX_YEAR = 2100

/** Deutsche Monatsnamen inkl. gaengiger Abkuerzungen, Umlaute bereits gefaltet. */
const MONTH_NAMES: Record<string, number> = {
  januar: 1,
  jaenner: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  maerz: 3,
  marz: 3,
  mrz: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12
}

/**
 * Liest die Anker aus einer Modell-Antwort. Alles, was nicht sauber validiert,
 * faellt raus - im Zweifel lieber eine leere Liste.
 */
/**
 * Normalisiert fuer den Belegabgleich: Kleinschreibung, Whitespace vereinheitlicht.
 * Dieselbe Idee wie die Evidence-Pruefung im Zeugnis-Decoder.
 */
function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Anker aus der Modellantwort lesen.
 *
 * `documentText` schaltet die Belegpruefung scharf: ein Zitat, das so nicht im
 * Dokument steht, wird verworfen. Ohne diese Pruefung war "Evidence-or-Abstain"
 * nur eine Behauptung im Prompt - ein halluziniertes Zitat reichte, damit eine
 * erfundene Frist mit Countdown in der Oberflaeche steht. Eine erfundene Frist
 * ist der schlimmste Fehler, den diese App machen kann.
 */
export function parseDeadlineAnchors(
  raw: string,
  documentText?: string,
  /**
   * Wird mit der Anzahl verworfener Anker gerufen. Callback statt Logger,
   * damit dieses Modul frei von Electron-Abhaengigkeiten bleibt und ohne
   * Mocks getestet werden kann.
   */
  onUnverified?: (count: number) => void
): DeadlineAnchor[] {
  if (!raw) return []
  const haystack = documentText ? normalizeForMatch(documentText) : null

  const parsed = extractJsonObject(raw)
  if (!parsed || !Array.isArray(parsed.anchors)) return []

  const entries: unknown[] = parsed.anchors
  const anchors: DeadlineAnchor[] = []
  let unverified = 0
  for (const entry of entries) {
    const anchor = toAnchor(entry)
    if (!anchor) continue
    // Belegpflicht: das Zitat muss so im Dokument stehen.
    if (haystack !== null && !haystack.includes(normalizeForMatch(anchor.quote))) {
      unverified++
      continue
    }
    anchors.push(anchor)
  }
  // Privacy: nur die Anzahl nach aussen, niemals das Zitat selbst.
  if (unverified > 0) onUnverified?.(unverified)
  return anchors
}

/**
 * Normalisiert eine Datumsangabe auf YYYY-MM-DD. Versteht ISO, 15.03.2026,
 * 5.3.26, 15/03/2026 und "15. Maerz 2026". Unplausibles (Monat 13, 31. Februar,
 * Jahr 1200) wird zu null.
 */
export function normalizeGermanDate(input: string): string | null {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text) return null

  // ISO - Modelle haengen gern noch eine Uhrzeit an.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text)
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  // 15.03.2026, 5.3.26, 15/03/2026
  const numeric = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/.exec(text)
  if (numeric) return toIsoDate(expandYear(numeric[3]), Number(numeric[2]), Number(numeric[1]))

  // 15. Maerz 2026, 1. Mai 2026, 15 Dez. 2026
  const named = /^(\d{1,2})\.?\s*(\p{L}+)\.?\s*(\d{4})$/iu.exec(text)
  if (named) {
    const month = MONTH_NAMES[foldUmlauts(named[2].toLowerCase())]
    if (month === undefined) return null
    return toIsoDate(Number(named[3]), month, Number(named[1]))
  }

  return null
}

function toAnchor(entry: unknown): DeadlineAnchor | null {
  if (!isRecord(entry)) return null

  // Evidence-or-Abstain: ohne Beleg im Dokument existiert die Frist fuer uns nicht.
  const quote = asText(entry.quote)
  if (!quote) return null

  const kind = asKind(entry.kind)
  const period = asPeriod(entry.periodValue, entry.periodUnit)

  return {
    kind,
    label: asText(entry.label) ?? FALLBACK_LABELS[kind],
    startDateIso: asDate(entry.startDateIso),
    startDateQuote: asText(entry.startDateQuote),
    periodText: asText(entry.periodText),
    periodValue: period.value,
    periodUnit: period.unit,
    explicitDueDateIso: asDate(entry.explicitDueDateIso),
    quote,
    confidence: asConfidence(entry.confidence)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Getrimmter String oder null - Leerstrings zaehlen als "nicht geliefert". */
function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asDate(value: unknown): string | null {
  const text = asText(value)
  return text ? normalizeGermanDate(text) : null
}

/** Unbekannte Fristart ist kein Grund zum Verwerfen - sie landet in 'sonstige'. */
function asKind(value: unknown): DeadlineKind {
  const text = asText(value)?.toLowerCase()
  return DEADLINE_KINDS.find((kind) => kind === text) ?? 'sonstige'
}

/** Unbekannte Confidence wird konservativ als 'low' behandelt. */
function asConfidence(value: unknown): DeadlineConfidence {
  const text = asText(value)?.toLowerCase()
  return CONFIDENCES.find((level) => level === text) ?? 'low'
}

/**
 * Zahl und Einheit gelten nur gemeinsam: "3" ohne Einheit ist unbrauchbar,
 * "month" ohne Zahl ebenso.
 */
function asPeriod(
  rawValue: unknown,
  rawUnit: unknown
): { value: number | null; unit: DeadlinePeriodUnit | null } {
  const value = asPeriodValue(rawValue)
  const unit = asPeriodUnit(rawUnit)
  if (value === null || unit === null) return { value: null, unit: null }
  return { value, unit }
}

function asPeriodValue(value: unknown): number | null {
  const num =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
  // Halbe Fristen gibt es nicht, 0/negative und absurd grosse Werte auch nicht.
  if (!Number.isInteger(num)) return null
  if (num < 1 || num > MAX_PERIOD_VALUE) return null
  return num
}

function asPeriodUnit(value: unknown): DeadlinePeriodUnit | null {
  const text = asText(value)?.toLowerCase()
  return PERIOD_UNITS.find((unit) => unit === text) ?? null
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

function daysInMonth(year: number, month: number): number {
  // Tag 0 des Folgemonats = letzter Tag des gesuchten Monats (inkl. Schaltjahr).
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

/** Faltet Umlaute auf ae/oe/ue/ss - "Maerz" und die Umlaut-Schreibweise treffen gleich. */
function foldUmlauts(text: string): string {
  return text
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
}

/** Zweistellige Jahre: 00-69 -> 2000er, 70-99 -> 1900er (wie in Formularen ueblich). */
function expandYear(raw: string): number {
  const value = Number(raw)
  if (raw.length !== 2) return value
  return value <= 69 ? 2000 + value : 1900 + value
}
