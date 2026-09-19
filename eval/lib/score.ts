/**
 * Metriken fuer die Eval-Laeufe.
 *
 * Bewusst rein: keine Netzwerk-, Datei- oder Zeit-Zugriffe, damit score.test.ts
 * im normalen `npm test` mitlaufen kann. Wer hier etwas aendert, aendert die
 * Bedeutung aller Zahlen im Scorecard - deshalb sind die Randfaelle
 * (nichts erwartet, nichts geliefert) hier festgeschrieben und getestet.
 */

import { isInDocument } from '../../src/renderer/lib/parse-analysis'

/** Wie weit die Note danebenliegen darf, wenn eine Fixture nichts anderes sagt. */
export const DEFAULT_GRADE_TOLERANCE = 1

// ============================================================================
// Note (Arbeitszeugnis)
// ============================================================================

export interface GradeScore {
  expected: number
  /** null = das Modell hat gar keine Note geliefert (Parse fehlgeschlagen). */
  actual: number | null
  /** Betrag der Abweichung, null wenn keine Note da ist. */
  deviation: number | null
  withinTolerance: boolean
}

/**
 * Vergleicht erwartete und gelieferte Note. Keine Note ist immer ein Fehlschlag -
 * "keine Antwort" darf nicht als Toleranztreffer durchgehen.
 */
export function scoreGrade(
  expected: number,
  actual: number | null,
  tolerance: number = DEFAULT_GRADE_TOLERANCE
): GradeScore {
  const limit = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : DEFAULT_GRADE_TOLERANCE
  if (actual === null || !Number.isFinite(actual)) {
    return { expected, actual: null, deviation: null, withinTolerance: false }
  }
  const deviation = Math.abs(expected - actual)
  return { expected, actual, deviation, withinTolerance: deviation <= limit }
}

// ============================================================================
// Belege (Evidence)
// ============================================================================

export interface EvidenceScore {
  /** Anzahl gepruefter Zitate (leere Strings zaehlen nicht mit). */
  total: number
  verified: number
  /** verified/total. Ohne Zitate 1 - nichts behauptet, nichts halluziniert. */
  rate: number
  /** Jedes Zitat, das nicht im Dokument steht - Duplikate bleiben drin. */
  hallucinated: string[]
}

/**
 * Wie viele der behaupteten Zitate stehen wirklich im Dokument?
 *
 * Benutzt dieselbe Normalisierung wie die App (isInDocument aus
 * parse-analysis): Kleinschreibung, zusammengefasste Leerzeichen. Damit misst
 * das Eval genau das, was die App als "verified" anzeigt - und nicht eine
 * eigene, freundlichere Definition.
 */
export function scoreEvidence(quotes: string[], documentText: string): EvidenceScore {
  const cleaned = quotes.map((quote) => quote.trim()).filter((quote) => quote.length > 0)
  const hallucinated = cleaned.filter((quote) => !isInDocument(quote, documentText))
  const total = cleaned.length
  const verified = total - hallucinated.length
  return { total, verified, rate: total === 0 ? 1 : verified / total, hallucinated }
}

// ============================================================================
// Fristen (Datumsmengen)
// ============================================================================

export interface DateScore {
  expected: string[]
  actual: string[]
  matched: string[]
  missed: string[]
  spurious: string[]
  /** matched/actual. Ohne gelieferte Daten 1. */
  precision: number
  /** matched/expected. Ohne erwartete Daten 1. */
  recall: number
}

/**
 * Mengenvergleich zweier Datumslisten (ISO, YYYY-MM-DD).
 *
 * Duplikate werden vorher entfernt: dreimal dieselbe Frist ist ein Treffer,
 * kein dreifacher. Ein Dokument ohne Frist ist der wichtigste Fall - dort
 * zaehlt jede gelieferte Frist als `spurious` und druckt die Precision.
 */
export function scoreDates(expected: string[], actual: string[]): DateScore {
  const exp = unique(expected)
  const act = unique(actual)
  const matched = exp.filter((date) => act.includes(date))
  const missed = exp.filter((date) => !act.includes(date))
  const spurious = act.filter((date) => !exp.includes(date))
  return {
    expected: exp,
    actual: act,
    matched,
    missed,
    spurious,
    precision: act.length === 0 ? 1 : matched.length / act.length,
    recall: exp.length === 0 ? 1 : matched.length / exp.length
  }
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

// ============================================================================
// Scorecard
// ============================================================================

/**
 * Rendert eine ausgerichtete ASCII-Tabelle. Spalten ergeben sich aus den
 * Schluesseln der Zeilen (Reihenfolge des ersten Auftretens); fehlende Werte
 * bleiben leer. Rein numerische Spalten werden rechtsbuendig gesetzt, damit
 * man Abweichungen untereinander lesen kann.
 */
export function formatScorecard(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '(keine Zeilen)'

  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }
  if (columns.length === 0) return '(keine Spalten)'

  const body = rows.map((row) => columns.map((column) => formatCell(row[column])))
  const rightAligned = columns.map((column) => rows.some((row) => typeof row[column] === 'number'))
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...body.map((cells) => cells[index].length))
  )

  const line = (cells: string[]): string =>
    cells
      .map((cell, index) =>
        rightAligned[index] ? cell.padStart(widths[index]) : cell.padEnd(widths[index])
      )
      .join('  ')
      .trimEnd()

  const separator = widths.map((width) => '-'.repeat(width)).join('  ')
  return [line(columns), separator, ...body.map(line)].join('\n')
}

/** Ganze Zahlen bleiben ganz, alles andere bekommt zwei Nachkommastellen. */
function formatCell(value: string | number | undefined): string {
  if (value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return value
}

/**
 * Prozentwert, der eine leere Stichprobe als solche ausweist.
 *
 * `x === 0 ? 1 : ...` machte aus "gar nichts geliefert" eine Quote von
 * 100 %. Eine Kennzahl, die bei Totalausfall am besten aussieht, ist
 * schlimmer als gar keine.
 */
export function rate(hit: number, total: number): string {
  if (total === 0) return 'n/a'
  return `${((hit / total) * 100).toFixed(1)} %`
}

/** Mittelwert, der eine leere Stichprobe als solche ausweist. */
export function mean(values: number[], digits = 2): string {
  if (values.length === 0) return 'n/a'
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(digits)
}
