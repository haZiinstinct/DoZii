/**
 * Gemeinsame Type-Guards fuer IPC-Eingaben. Vorher teils inline, teils als
 * lokale Guards pro Modul - hier zentral, damit neue Handler konsistent
 * validieren (Defense in Depth gegen fehlerhafte/boesartige Renderer-Calls).
 */
import type { AnalysisMode } from '@shared/types'

const ANALYSIS_MODES: ReadonlySet<AnalysisMode> = new Set<AnalysisMode>([
  'grammar',
  'formulation',
  'arbeitszeugnis',
  'summary',
  'freeform'
])

// Dokument-/Analyse-/Chat-IDs sind UUIDs (crypto.randomUUID).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0
}

export function isValidId(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export function isValidAnalysisMode(val: unknown): val is AnalysisMode {
  return typeof val === 'string' && ANALYSIS_MODES.has(val as AnalysisMode)
}
