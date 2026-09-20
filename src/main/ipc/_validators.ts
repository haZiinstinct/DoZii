/**
 * Gemeinsame Type-Guards fuer IPC-Eingaben. Vorher teils inline, teils als
 * lokale Guards pro Modul - hier zentral, damit neue Handler konsistent
 * validieren (Defense in Depth gegen fehlerhafte/boesartige Renderer-Calls).
 */
import {
  ALL_ANALYSIS_MODES,
  LETTER_KINDS,
  type AnalysisExtra,
  type AnalysisMode,
  type LetterKind
} from '@shared/types'

const VALID_MODES: ReadonlySet<AnalysisMode> = new Set<AnalysisMode>(ALL_ANALYSIS_MODES)
const VALID_LETTER_KINDS: ReadonlySet<LetterKind> = new Set<LetterKind>(LETTER_KINDS)

// Dokument-/Analyse-/Chat-IDs sind UUIDs (crypto.randomUUID).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidId(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export function isValidAnalysisMode(val: unknown): val is AnalysisMode {
  return typeof val === 'string' && VALID_MODES.has(val as AnalysisMode)
}

export function isValidLetterKind(val: unknown): val is LetterKind {
  return typeof val === 'string' && VALID_LETTER_KINDS.has(val as LetterKind)
}

/**
 * Saeubert das optionale `extra`-Objekt von `analysis:run`. Unbekannte oder
 * fehlerhafte Felder werden verworfen statt den Aufruf abzulehnen - so bleibt
 * eine aeltere Renderer-Version kompatibel.
 */
export function sanitizeAnalysisExtra(val: unknown, maxNotesChars: number): AnalysisExtra {
  if (!val || typeof val !== 'object') return {}
  const raw = val as Record<string, unknown>
  const extra: AnalysisExtra = {}
  if (isValidLetterKind(raw.letterKind)) extra.letterKind = raw.letterKind
  if (isValidId(raw.sourceAnalysisId)) extra.sourceAnalysisId = raw.sourceAnalysisId
  if (typeof raw.userNotes === 'string' && raw.userNotes.length > 0) {
    extra.userNotes = raw.userNotes.slice(0, maxNotesChars)
  }
  return extra
}
