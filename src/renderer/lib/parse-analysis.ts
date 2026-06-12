/**
 * Parsers for each analysis mode. Extract structured data from the markdown
 * output the LLM produces. Returns null on failure, in which case the UI
 * falls back to rendering the raw markdown.
 *
 * v3.0:
 * - extractField regex fix (matches **Label:**, **Label**:, **Label**)
 * - extractSection accepts multiple aliases
 * - Evidence-based validation (substring check against source document)
 * - JSON-Block scanner for Arbeitszeugnis (finds the valid block, not blindly the last)
 */

// ============================================================================
// Shared helper functions
// ============================================================================

/**
 * Normalize whitespace for substring matching. Lowercased, collapsed spaces,
 * newlines -> space, so we can check if an evidence quote appears in the text.
 */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Check whether `candidate` occurs in `documentText` (after normalization).
 * A short candidate (< 4 chars) is considered non-matching to avoid
 * matching single words. Used for evidence validation.
 */
export function isInDocument(candidate: string | undefined, documentText: string): boolean {
  if (!candidate || candidate.length < 4) return false
  const n = normalizeForMatch(candidate)
  const d = normalizeForMatch(documentText)
  if (n.length < 4) return false
  return d.includes(n)
}

/**
 * Extract a top-level section (##) by title. Tries each title in order so the
 * parser can accept both German and English headings AND common variants.
 */
function extractSection(markdown: string, ...titles: string[]): string | null {
  for (const title of titles) {
    // Allow the title to contain optional hyphens and whitespace variations
    // e.g. "Gesamt-Bewertung" should match "Gesamtbewertung"
    const flexible = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')
    // Bis zur naechsten ##-Ueberschrift oder zum absoluten String-Ende.
    // Achtung: \Z existiert in JS-Regex nicht (waere ein literales "Z" und
    // wuerde mit dem i-Flag die Sektion am ersten "z" abschneiden).
    const re = new RegExp(`##\\s*${flexible}([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'im')
    const match = markdown.match(re)
    if (match) return match[1]
  }
  return null
}

/**
 * Extract a `**Label:** value` field from a block.
 *
 * v3.0 fix: Accepts all of these variants:
 *   **Label:** value
 *   **Label**: value
 *   **Label** value
 *   **Label:**\nvalue
 */
function extractField(block: string, fieldName: string): string | undefined {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Stars first, then optional colon (inside or outside), then whitespace, then value.
  // Value runs until the next **Label** or blank line or heading or end.
  const re = new RegExp(
    `\\*\\*${escaped}\\s*:?\\s*\\*\\*\\s*:?\\s*(.+?)(?=\\n\\s*\\*\\*[A-ZÄÖÜa-zäöü0-9]|\\n\\s*\\n|\\n\\s*#|$)`,
    'is'
  )
  const match = block.match(re)
  if (!match) return undefined
  // Strip surrounding quotes if present
  return match[1]
    .trim()
    .replace(/^["'„»“”]+|["'»«“”]+$/g, '')
    .trim()
}

/**
 * Bilingual variant: tries several aliases in order and returns the first match.
 */
function extractBilingualField(block: string, ...aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const v = extractField(block, alias)
    if (v !== undefined && v.length > 0) return v
  }
  return undefined
}

/**
 * Split a section by `### 1. Title`, `### 2. Title`, or `#### 1.` etc.
 */
function extractNumberedBlocks(section: string): Array<{ index: number; body: string }> {
  const parts = section.split(/#{3,4}\s+(\d+)\.\s*/)
  const result: Array<{ index: number; body: string }> = []
  for (let i = 1; i < parts.length; i += 2) {
    const index = parseInt(parts[i], 10)
    const body = parts[i + 1] ?? ''
    if (body.trim()) {
      result.push({ index, body })
    }
  }
  return result
}

/**
 * Extract bullet list items. Accepts -, *, and bullet-style markers.
 */
function extractBulletLines(section: string): string[] {
  const lines = section.match(/^\s*[-*•]\s+(.+)$/gm) ?? []
  return lines.map((l) => l.replace(/^\s*[-*•]\s+/, '').trim()).filter(Boolean)
}

// ============================================================================
// Normalization helpers
// ============================================================================

export type Severity = 'high' | 'medium' | 'low'

function normalizeSeverity(raw: string | undefined): Severity {
  if (!raw) return 'medium'
  const s = raw.toLowerCase()
  if (s.includes('hoch') || s.includes('high')) return 'high'
  if (s.includes('niedrig') || s.includes('low')) return 'low'
  return 'medium'
}

export type Priority = 'high' | 'medium' | 'low'

function normalizePriority(raw: string | undefined): Priority | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase()
  if (s.startsWith('hoch') || s.startsWith('high')) return 'high'
  if (s.startsWith('nied') || s.startsWith('low')) return 'low'
  if (s.startsWith('mittel') || s.startsWith('medium')) return 'medium'
  return undefined
}

// ============================================================================
// Grammar Check
// ============================================================================

export interface GrammarError {
  index: number
  type: string
  severity: Severity
  original: string
  correction: string
  context?: string
  rule?: string
  verified?: boolean
}

export interface GrammarResult {
  overall: { errorCount: number; quality: string; summary: string }
  errors: GrammarError[]
}

export function parseGrammar(markdown: string, documentText?: string): GrammarResult | null {
  try {
    const overallText = extractSection(
      markdown,
      'Gesamtbewertung',
      'Gesamtquality',
      'Uebersicht',
      'Overall Assessment',
      'Overall'
    )
    if (!overallText) return null

    const errorCountStr =
      extractBilingualField(overallText, 'Anzahl Fehler', 'Fehleranzahl', 'Error Count') ?? '0'
    const errorCount = parseInt(errorCountStr.replace(/\D/g, ''), 10) || 0
    const quality =
      extractBilingualField(overallText, 'Qualitaet', 'Qualität', 'Quality', 'Bewertung', 'Note') ??
      'Unbekannt'
    const summary =
      extractBilingualField(overallText, 'Kurzfassung', 'Zusammenfassung', 'Summary') ?? ''

    const errorSection =
      extractSection(markdown, 'Fehler-Liste', 'Fehlerliste', 'Error List', 'Errors') ?? ''

    let errors: GrammarError[] = []
    for (const { index, body } of extractNumberedBlocks(errorSection)) {
      const headerMatch = body.match(/^\s*([^\n(]+?)\s*\((?:Schwere|Severity):\s*([^)]+)\)/i)
      const type = headerMatch?.[1]?.trim() ?? 'Fehler'
      const severity = normalizeSeverity(headerMatch?.[2])

      const original = extractField(body, 'Original')
      const correction = extractBilingualField(body, 'Korrektur', 'Correction')
      const context = extractBilingualField(
        body,
        'Kontext',
        'Context',
        'Kontext-Satz',
        'Context Sentence'
      )
      const rule = extractBilingualField(body, 'Regel', 'Rule')

      if (original && correction) {
        errors.push({ index, type, severity, original, correction, context, rule })
      }
    }

    // Evidence validation: filter out errors whose 'original' or 'context' does
    // not appear in the actual document text. This kills hallucinated findings.
    if (documentText) {
      errors = errors
        .map((e) => {
          const verified =
            isInDocument(e.original, documentText) || isInDocument(e.context, documentText)
          return { ...e, verified }
        })
        .filter((e) => e.verified)
    }

    return { overall: { errorCount, quality, summary }, errors }
  } catch {
    return null
  }
}

// ============================================================================
// Formulation
// ============================================================================

export interface FormulationSuggestion {
  index: number
  title: string
  category?: string
  before: string
  after: string
  why?: string
  verified?: boolean
}

export interface FormulationResult {
  documentType: string
  toneRecommendation: string
  overallImpression: string
  suggestions: FormulationSuggestion[]
  revisedFullText?: string
}

export function parseFormulation(
  markdown: string,
  documentText?: string
): FormulationResult | null {
  try {
    const docTypeText = extractSection(markdown, 'Dokumenttyp', 'Document Type')
    if (!docTypeText) return null

    const documentType =
      extractBilingualField(docTypeText, 'Erkannt', 'Typ', 'Dokumenttyp', 'Detected', 'Type') ??
      'Unbekannt'
    const toneRecommendation =
      extractBilingualField(
        docTypeText,
        'Tonalitaets-Empfehlung',
        'Tonalitaet',
        'Ton',
        'Tone Recommendation',
        'Tone'
      ) ?? ''
    const overallImpression =
      extractBilingualField(
        docTypeText,
        'Gesamteindruck',
        'Eindruck',
        'Overall Impression',
        'Impression'
      ) ?? ''

    const suggestionsText =
      extractSection(
        markdown,
        'Verbesserungsvorschlaege',
        'Verbesserungen',
        'Vorschlaege',
        'Suggestions'
      ) ?? ''

    let suggestions: FormulationSuggestion[] = []
    for (const { index, body } of extractNumberedBlocks(suggestionsText)) {
      const titleMatch = body.match(/^\s*([^\n]+)/)
      const title = titleMatch?.[1]?.trim() ?? `Vorschlag ${index}`
      const category = extractBilingualField(body, 'Kategorie', 'Category')
      const before = extractBilingualField(body, 'Vorher', 'Before', 'Original')
      const after = extractBilingualField(body, 'Nachher', 'After', 'Verbessert')
      const why = extractBilingualField(body, 'Warum', 'Why', 'Begruendung', 'Reason')
      if (before && after) {
        suggestions.push({ index, title, category, before, after, why })
      }
    }

    // Evidence validation for formulation: 'before' must be in the document
    if (documentText) {
      suggestions = suggestions
        .map((s) => ({ ...s, verified: isInDocument(s.before, documentText) }))
        .filter((s) => s.verified)
    }

    const revisedMatch =
      markdown.match(/##\s*Ueberarbeitete\s*Gesamtversion\s*([\s\S]*?)$/i) ||
      markdown.match(/##\s*Komplette\s*Ueberarbeitete\s*Version\s*([\s\S]*?)$/i) ||
      markdown.match(/##\s*Endversion\s*([\s\S]*?)$/i) ||
      markdown.match(/##\s*Revised\s*Full\s*Version\s*([\s\S]*?)$/i)
    const revisedFullText = revisedMatch?.[1]?.trim()

    return { documentType, toneRecommendation, overallImpression, suggestions, revisedFullText }
  } catch {
    return null
  }
}

// ============================================================================
// Summary
// ============================================================================

export interface KeyFact {
  label: string
  value: string
}

export interface ActionItem {
  text: string
  priority?: Priority
  deadline?: string
}

export interface SummaryResult {
  documentType: string
  title?: string
  keyFacts: KeyFact[]
  keyPoints: string[]
  summary: string
  actionItems: ActionItem[]
  observations: string[]
  phishingWarning?: string
}

export function parseSummary(markdown: string): SummaryResult | null {
  try {
    const docTypeText = extractSection(markdown, 'Dokumenttyp', 'Document Type')
    if (!docTypeText) return null

    const documentType =
      extractBilingualField(docTypeText, 'Typ', 'Type', 'Erkannt', 'Detected') ?? 'Unbekannt'
    const title = extractBilingualField(docTypeText, 'Titel', 'Title', 'Betreff', 'Subject')

    const keyFactsText = extractSection(markdown, 'Wichtige Fakten', 'Key Facts', 'Fakten') ?? ''
    const keyFacts: KeyFact[] = []
    const factLines = keyFactsText.match(/-\s*\*\*([^:*]+):?\*\*\s*([^\n]+)/g) ?? []
    for (const line of factLines) {
      const m = line.match(/-\s*\*\*([^:*]+):?\*\*\s*([^\n]+)/)
      if (m) keyFacts.push({ label: m[1].trim(), value: m[2].trim() })
    }

    const keyPointsText =
      extractSection(markdown, 'Kernaussagen', 'Key Points', 'Hauptpunkte') ?? ''
    const keyPoints: string[] = extractBulletLines(keyPointsText).map((l) => {
      const labelMatch = l.match(/^\*\*([^:*]+):?\*\*\s*(.+)$/)
      return labelMatch ? labelMatch[2].trim() : l
    })

    const summary = extractSection(markdown, 'Zusammenfassung', 'Summary')?.trim() ?? ''

    const actionText = extractSection(markdown, 'Handlungsbedarf', 'Action Items', 'Aktionen') ?? ''
    const actionItems: ActionItem[] = []
    // Accept both `- [ ] Text` and plain `- Text` in the action section
    const checkboxLines = actionText.match(/-\s*\[\s*\]\s*([^\n]+)/g) ?? []
    const bulletOnlyLines = actionText.match(/^\s*-\s+(?!\[)([^\n]+)/gm) ?? []
    const combined: string[] = []
    for (const line of checkboxLines) {
      combined.push(line.replace(/^\s*-\s*\[\s*\]\s*/, '').trim())
    }
    for (const line of bulletOnlyLines) {
      const text = line.replace(/^\s*-\s+/, '').trim()
      if (text && !text.toLowerCase().startsWith('kein')) combined.push(text)
    }
    for (const raw of combined) {
      if (!raw) continue
      const priorityMatch = raw.match(/(?:Prioritaet|Priority|Prio):\s*(\w+)/i)
      const deadlineMatch = raw.match(/(?:Frist|Deadline|Bis):\s*([^),]+)/i)
      const cleanText = raw.replace(/\([^)]*\)/g, '').trim()
      actionItems.push({
        text: cleanText,
        priority: normalizePriority(priorityMatch?.[1]),
        deadline: deadlineMatch?.[1]?.trim()
      })
    }

    const observationsText =
      extractSection(markdown, 'Auffaelligkeiten', 'Observations', 'Hinweise') ?? ''
    const observations = extractBulletLines(observationsText).filter(
      (l) => !l.toLowerCase().includes('keine besonderen')
    )

    // Phishing warning detection - if the model placed "PHISHING-VERDACHT" anywhere
    const phishingMatch = markdown.match(
      /(?:⚠\s*)?PHISHING[-\s]?(?:VERDACHT|WARNING):?\s*([^\n]+)/i
    )
    const phishingWarning = phishingMatch?.[1]?.trim()

    return {
      documentType,
      title,
      keyFacts,
      keyPoints,
      summary,
      actionItems,
      observations,
      phishingWarning
    }
  } catch {
    return null
  }
}

// ============================================================================
// Arbeitszeugnis
// ============================================================================

export type Grade = 1 | 2 | 3 | 4 | 5 | 6
export type ZeugnisSeverity = 'green' | 'yellow' | 'red'
export type ZeugnisAssessment = 'positive' | 'neutral' | 'negative' | 'missing_negative'

export interface ZeugnisSection {
  name: string
  present: boolean
  grade?: Grade
  excerpt?: string
  evidence?: string
  assessment?: string
  verified?: boolean
}

export interface ZeugnisCodedPhrase {
  phrase: string
  evidence?: string
  decoded: string
  severity: ZeugnisSeverity
  category?: string
  suggestion?: {
    note2?: string
    note3?: string
    howToNegotiate?: string
  }
  verified?: boolean
}

export interface ZeugnisMissingElement {
  element: string
  importance: string
  implication: string
}

export interface ZeugnisClosingFormula {
  regret?: { excerpt?: string; assessment?: ZeugnisAssessment }
  wishes?: { excerpt?: string; assessment?: ZeugnisAssessment }
  thanks?: { excerpt?: string; assessment?: ZeugnisAssessment }
  reason?: { excerpt?: string; assessment?: ZeugnisAssessment }
}

export interface ZeugnisGrade {
  grade: Grade
  label?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface ArbeitszeugnisResult {
  documentType: string
  /**
   * Content grade: what does this reference ACTUALLY say about the employee?
   * The classic 1-6 performance judgment.
   */
  contentGrade: ZeugnisGrade
  /**
   * Craft / structure grade: how skillfully written is the reference?
   * High grade = polished, complete, HR-conformant. Low grade = sloppy, incomplete,
   * clumsy formulations.
   */
  craftGrade: ZeugnisGrade
  /** @deprecated Use contentGrade instead. Kept for backwards compatibility with legacy analyses. */
  overallGrade: ZeugnisGrade
  sections: ZeugnisSection[]
  codedPhrases: ZeugnisCodedPhrase[]
  missingElements: ZeugnisMissingElement[]
  closingFormula: ZeugnisClosingFormula
  summary: string
  notGenuineZeugnis?: boolean
}

function isValidGrade(n: unknown): n is Grade {
  return typeof n === 'number' && n >= 1 && n <= 6 && Number.isInteger(n)
}

function isValidSeverity(s: unknown): s is ZeugnisSeverity {
  return s === 'green' || s === 'yellow' || s === 'red'
}

function isValidConfidence(c: unknown): c is 'high' | 'medium' | 'low' {
  return c === 'high' || c === 'medium' || c === 'low'
}

/**
 * Scan all ```json``` blocks in the markdown and return the first one that
 * has the expected Arbeitszeugnis schema (overallGrade + sections). This is
 * MUCH safer than blindly taking the last block, because the model sometimes
 * embeds example JSON snippets in the prose.
 */
function findValidArbeitszeugnisJson(markdown: string): Record<string, unknown> | null {
  const blocks = [...markdown.matchAll(/```json\s*([\s\S]*?)```/gi)]
  // Iterate from last to first (the real answer is usually at the end)
  for (let i = blocks.length - 1; i >= 0; i--) {
    const raw = blocks[i][1].trim()
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.sections) &&
        // Accept either the new dual-grade schema (contentGrade) or the legacy
        // single-grade schema (overallGrade). This preserves backwards compat
        // so old persisted analyses still render.
        ((parsed.contentGrade && typeof parsed.contentGrade === 'object') ||
          (parsed.overallGrade && typeof parsed.overallGrade === 'object'))
      ) {
        return parsed
      }
    } catch {
      // Invalid JSON, keep scanning
    }
  }
  return null
}

/**
 * Parse a grade block (contentGrade / craftGrade / overallGrade).
 * Returns null if the grade is invalid/missing.
 */
function extractGrade(raw: unknown): ZeugnisGrade | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!isValidGrade(obj.grade)) return null
  return {
    grade: obj.grade,
    label: typeof obj.label === 'string' ? obj.label : undefined,
    confidence: isValidConfidence(obj.confidence) ? obj.confidence : 'medium',
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : ''
  }
}

function extractClosingPart(
  raw: unknown
): { excerpt?: string; assessment?: ZeugnisAssessment } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const obj = raw as Record<string, unknown>
  const excerpt = typeof obj.excerpt === 'string' ? obj.excerpt : undefined
  const a = obj.assessment
  const assessment: ZeugnisAssessment | undefined =
    a === 'positive' || a === 'neutral' || a === 'negative' || a === 'missing_negative'
      ? a
      : undefined
  if (!excerpt && !assessment) return undefined
  return { excerpt, assessment }
}

export function parseArbeitszeugnis(
  markdown: string,
  documentText?: string
): ArbeitszeugnisResult | null {
  try {
    const parsed = findValidArbeitszeugnisJson(markdown)
    if (!parsed) return null

    // Dual-grade schema: prefer contentGrade + craftGrade, fall back to overallGrade
    const contentGrade = extractGrade(parsed.contentGrade) ?? extractGrade(parsed.overallGrade)
    if (!contentGrade) return null

    // craftGrade is optional in legacy analyses - we synthesize a fallback
    const craftGrade: ZeugnisGrade = extractGrade(parsed.craftGrade) ?? {
      grade: 3,
      label: 'Nicht separat bewertet',
      confidence: 'low',
      reasoning: 'Diese Analyse stammt aus einer aelteren Version ohne separate Struktur-Bewertung.'
    }

    // Legacy overallGrade is the same as contentGrade for backwards-compat UI
    const overallGrade: ZeugnisGrade = extractGrade(parsed.overallGrade) ?? contentGrade

    // Sections
    let sections: ZeugnisSection[] = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
          .map((s) => ({
            name: typeof s.name === 'string' ? s.name : 'Unbekannt',
            present: s.present !== false,
            grade: isValidGrade(s.grade) ? s.grade : undefined,
            excerpt: typeof s.excerpt === 'string' ? s.excerpt : undefined,
            evidence: typeof s.evidence === 'string' ? s.evidence : undefined,
            assessment: typeof s.assessment === 'string' ? s.assessment : undefined
          }))
      : []

    // Coded phrases (with optional suggestion accordion data)
    let codedPhrases: ZeugnisCodedPhrase[] = Array.isArray(parsed.codedPhrases)
      ? parsed.codedPhrases
          .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
          .map((p) => {
            const suggestionRaw = p.suggestion as Record<string, unknown> | undefined
            const suggestion = suggestionRaw
              ? {
                  note2: typeof suggestionRaw.note2 === 'string' ? suggestionRaw.note2 : undefined,
                  note3: typeof suggestionRaw.note3 === 'string' ? suggestionRaw.note3 : undefined,
                  howToNegotiate:
                    typeof suggestionRaw.howToNegotiate === 'string'
                      ? suggestionRaw.howToNegotiate
                      : undefined
                }
              : undefined
            return {
              phrase: typeof p.phrase === 'string' ? p.phrase : '',
              evidence: typeof p.evidence === 'string' ? p.evidence : undefined,
              decoded: typeof p.decoded === 'string' ? p.decoded : '',
              severity: isValidSeverity(p.severity) ? p.severity : 'yellow',
              category: typeof p.category === 'string' ? p.category : undefined,
              suggestion
            }
          })
          .filter((p) => p.phrase && p.decoded)
      : []

    const missingElements: ZeugnisMissingElement[] = Array.isArray(parsed.missingElements)
      ? parsed.missingElements
          .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
          .map((m) => ({
            element: typeof m.element === 'string' ? m.element : '',
            importance: typeof m.importance === 'string' ? m.importance : '',
            implication: typeof m.implication === 'string' ? m.implication : ''
          }))
          .filter((m) => m.element)
      : []

    const closingRaw = (parsed.closingFormula ?? {}) as Record<string, unknown>
    const closingFormula: ZeugnisClosingFormula = {
      regret: extractClosingPart(closingRaw.regret),
      wishes: extractClosingPart(closingRaw.wishes),
      thanks: extractClosingPart(closingRaw.thanks),
      reason: extractClosingPart(closingRaw.reason)
    }

    // Evidence validation: filter sections and codedPhrases whose evidence
    // is NOT in the document (prevents halluzinated quotes).
    if (documentText) {
      sections = sections.map((s) => ({
        ...s,
        verified: s.evidence
          ? isInDocument(s.evidence, documentText)
          : isInDocument(s.excerpt, documentText)
      }))
      codedPhrases = codedPhrases
        .map((p) => ({
          ...p,
          verified: isInDocument(p.evidence ?? p.phrase, documentText)
        }))
        .filter((p) => p.verified)
    }

    return {
      documentType:
        typeof parsed.documentType === 'string' ? parsed.documentType : 'qualifiziertes',
      contentGrade,
      craftGrade,
      overallGrade,
      sections,
      codedPhrases,
      missingElements,
      closingFormula,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      notGenuineZeugnis:
        typeof parsed.notGenuineZeugnis === 'boolean' ? parsed.notGenuineZeugnis : undefined
    }
  } catch {
    return null
  }
}

/**
 * Strip the trailing "Strukturierte Daten" section (which contains the JSON
 * block) from the markdown before rendering the fallback view.
 */
export function stripTrailingJsonBlock(markdown: string): string {
  return markdown.replace(/##\s*Strukturierte\s*Daten[\s\S]*$/i, '').trimEnd()
}
