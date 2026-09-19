/**
 * Parser fuer den Vertrags-Check (Modus "contract").
 *
 * Gleiches Prinzip wie parseArbeitszeugnis: das Modell liefert ein
 * JSON-Objekt, wir holen es defensiv heraus und pruefen jede Klausel gegen
 * den Originaltext (Evidence-Check). Nichts wird geworfen - fehlende oder
 * falsch getypte Felder werden ausgelassen statt den ganzen Parse zu kippen.
 *
 * Das Herausholen des JSON steckt in @shared/json-blocks - denselben Scanner
 * benutzt der Zeugnis-Parser. Zwei Kopien haben sich vorher auseinander
 * entwickelt: hier wurde nacktes JSON akzeptiert, dort nur eingezaeuntes.
 */

import { isInDocument } from './parse-analysis'
import { stripThinking } from '@shared/strip-thinking'
import { findJson } from '@shared/json-blocks'

// ============================================================================
// Typen
// ============================================================================

export type ClauseSeverity = 'red' | 'yellow' | 'green'

export interface ContractClause {
  title: string
  quote: string
  category: string
  severity: ClauseSeverity
  side: string | null
  plain: string
  why: string
  typical: string | null
  askFor: string | null
  /** true, wenn `quote` woertlich im Dokument steht */
  verified: boolean
}

export interface ContractParty {
  role: string
  name: string
}

export interface ContractKeyTerm {
  label: string
  value: string
  quote: string | null
  verified: boolean
}

export interface ContractMissing {
  element: string
  importance: 'high' | 'medium' | 'low'
  implication: string
}

export interface ContractCheckResult {
  documentType: string
  notAContract: boolean
  parties: ContractParty[]
  keyTerms: ContractKeyTerm[]
  clauses: ContractClause[]
  missingClauses: ContractMissing[]
  overallRisk: { level: 'low' | 'medium' | 'high'; reasoning: string }
  summary: string
  /** Anzahl Klauseln ohne Textbeleg - die UI warnt darauf hin */
  unverifiedCount: number
}

// ============================================================================
// Defensive Helfer
// ============================================================================

/** Strings, Zahlen und Booleans zu getrimmtem Text; alles andere zu ''. */
function toText(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw === 'boolean') return String(raw)
  return ''
}

/** Wie toText, aber leere Werte werden zu null (fuer optionale Felder). */
function toTextOrNull(raw: unknown): string | null {
  const text = toText(raw)
  return text.length > 0 ? text : null
}

/** Nur echte Objekt-Eintraege eines Arrays; alles andere (auch Strings) faellt raus. */
function toObjectArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
}

/** Kleine Modelle schreiben Booleans gern als Text ("true"/"ja"). */
function toBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    return s === 'true' || s === 'ja' || s === 'yes'
  }
  return false
}

/** Ampel-Wert normalisieren; akzeptiert auch deutsche Farben. Default: yellow. */
function normalizeClauseSeverity(raw: unknown): ClauseSeverity {
  const s = toText(raw).toLowerCase()
  if (s.startsWith('red') || s.startsWith('rot')) return 'red'
  if (s.startsWith('green') || s.startsWith('gruen') || s.startsWith('grün')) return 'green'
  if (s.startsWith('yellow') || s.startsWith('gelb')) return 'yellow'
  return 'yellow'
}

/** Wichtigkeit normalisieren; akzeptiert deutsche Stufen. Default: medium. */
function normalizeImportance(raw: unknown): 'high' | 'medium' | 'low' {
  const s = toText(raw).toLowerCase()
  if (s.startsWith('high') || s.startsWith('hoch')) return 'high'
  if (s.startsWith('low') || s.startsWith('niedrig') || s.startsWith('gering')) return 'low'
  return 'medium'
}

/** Risiko-Level normalisieren; akzeptiert deutsche Stufen. Default: medium. */
function normalizeRiskLevel(raw: unknown): 'low' | 'medium' | 'high' {
  const s = toText(raw).toLowerCase()
  if (s.startsWith('high') || s.startsWith('hoch')) return 'high'
  if (s.startsWith('low') || s.startsWith('niedrig') || s.startsWith('gering')) return 'low'
  return 'medium'
}

// ============================================================================
// JSON-Block-Scanner
// ============================================================================

/**
 * Sieht das Objekt nach einem Vertrags-Check aus? Verhindert, dass ein
 * Beispiel-Snippet aus der Prosa als Ergebnis durchgeht.
 */
function looksLikeContractResult(o: Record<string, unknown>): boolean {
  if (Array.isArray(o.clauses)) return true
  if (typeof o.overallRisk === 'object' && o.overallRisk !== null) return true
  if (Array.isArray(o.missingClauses)) return true
  return o.notAContract === true
}

/**
 * Sucht den JSON-Block mit dem erwarteten Vertrags-Schema.
 *
 * Eingezaeunt oder nackt - manche Modelle lassen die Backticks weg. Geprueft
 * wird das Schema, damit nicht das Beispiel aus dem Prompt gewinnt.
 */
function findContractJson(raw: string): Record<string, unknown> | null {
  return findJson(raw, looksLikeContractResult)
}

// ============================================================================
// Feld-Mapper
// ============================================================================

function mapParties(raw: unknown): ContractParty[] {
  return toObjectArray(raw)
    .map((p) => ({ role: toText(p.role), name: toText(p.name) }))
    .filter((p) => p.role || p.name)
}

function mapKeyTerms(raw: unknown, documentText: string): ContractKeyTerm[] {
  return toObjectArray(raw)
    .map((t) => {
      const label = toText(t.label)
      const value = toText(t.value)
      const quote = toTextOrNull(t.quote)
      // Ohne Zitat pruefen wir den Wert selbst - Betraege stehen meist woertlich drin.
      return { label, value, quote, verified: isInDocument(quote ?? value, documentText) }
    })
    .filter((t) => t.label.length > 0)
}

function mapClauses(raw: unknown, documentText: string): ContractClause[] {
  return toObjectArray(raw)
    .map((c) => {
      const quote = toText(c.quote)
      return {
        title: toText(c.title),
        quote,
        category: toText(c.category) || 'sonstiges',
        severity: normalizeClauseSeverity(c.severity),
        side: toTextOrNull(c.side),
        plain: toText(c.plain),
        why: toText(c.why),
        typical: toTextOrNull(c.typical),
        askFor: toTextOrNull(c.askFor),
        verified: isInDocument(quote, documentText)
      }
    })
    .filter((c) => c.title.length > 0 || c.quote.length > 0)
}

/**
 * Fehlende Klauseln. Kleine Modelle liefern hier gern nur Strings
 * (["Kuendigungsfrist"]) statt Objekte - das wird mitgenommen.
 */
function mapMissing(raw: unknown): ContractMissing[] {
  if (!Array.isArray(raw)) return []
  const result: ContractMissing[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const element = entry.trim()
      if (element) result.push({ element, importance: 'medium', implication: '' })
      continue
    }
    if (typeof entry !== 'object' || entry === null) continue
    const m = entry as Record<string, unknown>
    const element = toText(m.element)
    if (!element) continue
    result.push({
      element,
      importance: normalizeImportance(m.importance),
      implication: toText(m.implication)
    })
  }
  return result
}

/**
 * Gesamt-Risiko. Fehlt es in der Modellantwort, wird es aus den Klauseln
 * ABGELEITET statt geraten: ein pauschales "mittleres Risiko" waere eine
 * Aussage, die niemand getroffen hat - und die der Nutzer fuer eine
 * Einschaetzung haelt.
 */
function mapRisk(
  raw: unknown,
  clauses: ContractClause[]
): { level: 'low' | 'medium' | 'high'; reasoning: string } {
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    if (typeof r.level === 'string') {
      return { level: normalizeRiskLevel(r.level), reasoning: toText(r.reasoning) }
    }
  }
  // Die schwerste Klausel bestimmt das Gesamtbild - eine rote Klausel
  // irgendwo macht den ganzen Vertrag riskant.
  const level = clauses.some((c) => c.severity === 'red')
    ? 'high'
    : clauses.some((c) => c.severity === 'yellow')
      ? 'medium'
      : 'low'
  return { level, reasoning: '' }
}

// ============================================================================
// Einstiegspunkt
// ============================================================================

export function parseContractCheck(raw: string, documentText: string): ContractCheckResult | null {
  try {
    // Denkmodelle stellen ihrer Antwort einen Gedankengang voran. Bleibt
    // der stehen, findet die JSON-Suche dahinter nichts mehr.
    const parsed = findContractJson(stripThinking(raw))
    if (!parsed) return null

    const clauses = mapClauses(parsed.clauses, documentText)

    return {
      documentType: toText(parsed.documentType) || 'sonstiges',
      notAContract: toBool(parsed.notAContract),
      parties: mapParties(parsed.parties),
      keyTerms: mapKeyTerms(parsed.keyTerms, documentText),
      clauses,
      missingClauses: mapMissing(parsed.missingClauses),
      overallRisk: mapRisk(parsed.overallRisk, clauses),
      summary: toText(parsed.summary),
      unverifiedCount: clauses.filter((c) => !c.verified).length
    }
  } catch {
    return null
  }
}
