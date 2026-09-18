/**
 * Parser fuer den Vertrags-Check (Modus "contract").
 *
 * Gleiches Prinzip wie parseArbeitszeugnis: das Modell liefert einen
 * ```json-Block, wir holen ihn defensiv heraus und pruefen jede Klausel gegen
 * den Originaltext (Evidence-Check). Nichts wird geworfen - fehlende oder
 * falsch getypte Felder werden ausgelassen statt den ganzen Parse zu kippen.
 *
 * parse-analysis.ts wird nur fuer isInDocument mitbenutzt; der Block-Scanner
 * dort ist Zeugnis-spezifisch und nicht exportiert, deshalb steht hier ein
 * eigener, schlanker.
 */

import { isInDocument } from './parse-analysis'

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

function tryParse(text: string): Record<string, unknown> | null {
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* kein gueltiges JSON */
  }
  return null
}

/**
 * Teilstring vom '{' bei `start` bis zur passenden schliessenden Klammer,
 * String-Literale und Escapes korrekt ueberspringend.
 */
function sliceBalanced(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Findet das Ergebnis-Objekt: erst Codefences (von hinten, die echte Antwort
 * steht meist am Ende), dann ein balancierter Klammern-Scan fuer Modelle, die
 * den Block ohne Fences ausgeben.
 */
function findContractJson(raw: string): Record<string, unknown> | null {
  const text = raw.trim()
  if (!text) return null

  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (let i = fences.length - 1; i >= 0; i--) {
    const obj = tryParse(fences[i][1].trim())
    if (obj && looksLikeContractResult(obj)) return obj
  }

  let last: Record<string, unknown> | null = null
  let pos = text.indexOf('{')
  while (pos !== -1) {
    const candidate = sliceBalanced(text, pos)
    if (candidate) {
      const obj = tryParse(candidate)
      if (obj) {
        if (looksLikeContractResult(obj)) last = obj
        pos = text.indexOf('{', pos + candidate.length)
        continue
      }
    }
    pos = text.indexOf('{', pos + 1)
  }
  return last
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

function mapRisk(raw: unknown): { level: 'low' | 'medium' | 'high'; reasoning: string } {
  if (typeof raw !== 'object' || raw === null) return { level: 'medium', reasoning: '' }
  const r = raw as Record<string, unknown>
  return { level: normalizeRiskLevel(r.level), reasoning: toText(r.reasoning) }
}

// ============================================================================
// Einstiegspunkt
// ============================================================================

export function parseContractCheck(raw: string, documentText: string): ContractCheckResult | null {
  try {
    const parsed = findContractJson(raw)
    if (!parsed) return null

    const clauses = mapClauses(parsed.clauses, documentText)

    return {
      documentType: toText(parsed.documentType) || 'sonstiges',
      notAContract: toBool(parsed.notAContract),
      parties: mapParties(parsed.parties),
      keyTerms: mapKeyTerms(parsed.keyTerms, documentText),
      clauses,
      missingClauses: mapMissing(parsed.missingClauses),
      overallRisk: mapRisk(parsed.overallRisk),
      summary: toText(parsed.summary),
      unverifiedCount: clauses.filter((c) => !c.verified).length
    }
  } catch {
    return null
  }
}
