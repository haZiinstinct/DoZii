/**
 * Parser fuer den Modus "Einfach erklaert" (plain).
 *
 * Gleiches Prinzip wie parse-analysis.ts: Markdown rein, Struktur raus, bei
 * Fehlschlag null - dann rendert die UI das Roh-Markdown. Kleine Modelle
 * halten das Format nur ungefaehr ein, deshalb ist hier alles tolerant:
 * fehlende Sektionen, `-` statt `- [ ]`, `**Stufe**: hoch`, Geplapper vor und
 * nach dem Format.
 *
 * Die Ueberschriften spiegeln PLAIN_HEADINGS_DE / PLAIN_HEADINGS_EN aus
 * src/main/prompts/plain-language.prompt.ts. Sie stehen hier ein zweites Mal,
 * weil der Renderer nicht aus src/main importieren darf (eigener
 * tsconfig/Bundle) - genau wie parse-analysis.ts es fuer die anderen Modi tut.
 */

export type Urgency = 'high' | 'medium' | 'low'

export interface PlainAction {
  text: string
  /** Woertliche Fristangabe aus dem Dokument, null wenn keine genannt ist. */
  deadline: string | null
}

export interface PlainFact {
  label: string
  value: string
}

export interface PlainTerm {
  term: string
  explanation: string
}

export interface PlainLanguageResult {
  headline: string
  urgency: Urgency
  urgencyReason: string
  about: string
  demand: string
  ifNothing: string
  actions: PlainAction[]
  facts: PlainFact[]
  terms: PlainTerm[]
  gaps: string[]
}

// ============================================================================
// Ueberschriften (DE + EN, plus haeufige Modell-Abweichungen)
// ============================================================================

const HEADINGS = {
  headline: ['Das Wichtigste', 'The main point', 'Main point'],
  urgency: ['Dringlichkeit', 'Urgency'],
  about: ['Worum geht es', 'What this is about', 'What it is about'],
  demand: ['Was man von dir will', 'What they want from you'],
  ifNothing: ['Was passiert, wenn du nichts tust', 'What happens if you do nothing'],
  actions: ['Was du tun kannst', 'What you can do'],
  facts: ['Wichtige Zahlen und Daten', 'Important numbers and dates'],
  terms: ['Schwierige Woerter', 'Schwierige Wörter', 'Difficult words'],
  gaps: ['Was im Dokument nicht steht', 'What the document does not say']
} as const

const LEVEL_LABELS = ['Stufe', 'Level', 'Dringlichkeit', 'Urgency']
const WHY_LABELS = ['Warum', 'Why', 'Begruendung', 'Begründung', 'Reason']

/**
 * Zeilen, mit denen das Modell eine leere Liste markiert ("- Keine").
 * Nur exakte Treffer, damit "Keine Zahlung leisten" ein echter Schritt bleibt.
 */
const EMPTY_MARKERS = [
  'keine',
  'keine angabe',
  'keine angaben',
  'keine offenen punkte',
  'keine schwierigen woerter',
  'keine schwierigen wörter',
  'nichts',
  'nichts zu tun',
  'nichts davon im dokument',
  'steht nicht im dokument',
  'none',
  'nothing',
  'nothing to do',
  'nothing of that in the document',
  'not stated in the document',
  'n/a',
  '-'
]

// ============================================================================
// Hilfsfunktionen (schlanke Varianten der Helfer aus parse-analysis.ts,
// die dort nicht exportiert sind)
// ============================================================================

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Holt eine Sektion ueber ihre Ueberschrift. Probiert die Aliase der Reihe
 * nach durch, toleriert Bindestriche, fehlende Kommas, `###` statt `##` sowie
 * Zusaetze hinter der Ueberschrift ("## Das Wichtigste (kurz)").
 */
function extractSection(markdown: string, titles: readonly string[]): string | null {
  for (const title of titles) {
    const flexible = escapeRegExp(title).replace(/\s+/g, '[\\s-]+').replace(/,/g, ',?')
    const re = new RegExp(
      `^#{1,4}\\s*\\**\\s*(?:\\d+[.)]\\s*)?${flexible}[^\\n]*(?:\\n|$)([\\s\\S]*?)(?=^#{1,4}\\s|(?![\\s\\S]))`,
      'im'
    )
    const match = markdown.match(re)
    if (match) return match[1]
  }
  return null
}

/** Entfernt Markdown-Auszeichnung und Anfuehrungszeichen um einen Wert. */
function cleanValue(raw: string): string {
  return raw
    .trim()
    .replace(/^[*_`\s]+|[*_`\s]+$/g, '')
    .replace(/^["'„»“”]+|["'»«“”]+$/g, '')
    .trim()
}

/**
 * Liest `**Label:** Wert`. Akzeptiert auch `**Label**: Wert`, `Label: Wert`
 * und den Wert auf der Folgezeile.
 */
function extractField(block: string, labels: readonly string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `^\\s*(?:[-*•]\\s*)?\\*{0,2}\\s*${escapeRegExp(label)}\\s*:?\\s*\\*{0,2}\\s*:?[ \\t]*(.*)$`,
      'im'
    )
    const match = block.match(re)
    if (!match) continue
    let value = cleanValue(match[1])
    if (!value) {
      const rest = block.slice((match.index ?? 0) + match[0].length)
      value = cleanValue(rest.split('\n').find((l) => l.trim().length > 0) ?? '')
    }
    if (value) return value
  }
  return null
}

/** Inhalt aller Listenzeilen (`-`, `*`, `•`, `1.`) ohne Marker. */
function listLines(section: string): string[] {
  const out: string[] = []
  for (const raw of section.split('\n')) {
    const match = raw.match(/^\s*(?:[-*•+]|\d+[.)])\s+(.*)$/)
    if (!match) continue
    const text = match[1].trim()
    if (text) out.push(text)
  }
  return out
}

function isEmptyMarker(text: string): boolean {
  return EMPTY_MARKERS.includes(
    text
      .toLowerCase()
      .replace(/[.!:;]+$/, '')
      .trim()
  )
}

/** Erste nicht-leere Zeile einer Sektion, ohne Listenmarker. */
function firstLine(section: string | null): string {
  if (!section) return ''
  for (const raw of section.split('\n')) {
    const text = cleanValue(raw.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/, ''))
    if (text) return text
  }
  return ''
}

/** Fliesstext einer Sektion, nur getrimmt - Zeilenumbrueche bleiben erhalten. */
function paragraph(section: string | null): string {
  if (!section) return ''
  return section.replace(/\n{3,}/g, '\n\n').trim()
}

// ============================================================================
// Normalisierung
// ============================================================================

function normalizeUrgency(raw: string | null): Urgency {
  if (!raw) return 'medium'
  const s = raw.toLowerCase()
  if (/hoch|high|dringend|urgent|eilig|sofort|critical/.test(s)) return 'high'
  if (/niedrig|low|gering|keine eile|informativ/.test(s)) return 'low'
  return 'medium'
}

// (bis: 12.03.2026) / (Frist: ...) / (by: ...) / (until: ...)
const DEADLINE_RE = /\(\s*(?:bis|frist|deadline|by|until|due)\s*:?\s*([^)]*)\)/i
const NO_DEADLINE_RE = /^(?:keine(?:\s+frist)?|ohne\s+frist|no\s+deadline|none|n\/?a|-{1,2})$/i

// ============================================================================
// Sektions-Parser
// ============================================================================

function extractActions(section: string | null): PlainAction[] {
  if (!section) return []
  const actions: PlainAction[] = []
  for (const line of listLines(section)) {
    // Checkbox-Marker entfernen: "[ ]", "[x]", "[X]"
    const body = line.replace(/^\[\s*[xX✓]?\s*\]\s*/, '')
    const match = body.match(DEADLINE_RE)
    let deadline: string | null = null
    if (match) {
      const value = cleanValue(match[1])
      deadline = value && !NO_DEADLINE_RE.test(value) ? value : null
    }
    const text = cleanValue(match ? body.replace(match[0], ' ') : body)
    if (!text || isEmptyMarker(text)) continue
    actions.push({ text, deadline })
  }
  return actions
}

/** `- **Label:** Wert` und - als Rueckfallebene - `- Label: Wert`. */
function extractLabeled(section: string | null): PlainFact[] {
  if (!section) return []
  const items: PlainFact[] = []
  for (const line of listLines(section)) {
    const bold = line.match(/^\*\*(.+?)\s*:?\s*\*\*\s*:?\s*(.+)$/)
    const plain = bold ? null : line.match(/^([^:*]{1,60}):\s*(.+)$/)
    const hit = bold ?? plain
    if (!hit) continue
    const label = cleanValue(hit[1])
    const value = cleanValue(hit[2])
    if (!label || !value || isEmptyMarker(label)) continue
    items.push({ label, value })
  }
  return items
}

function extractGaps(section: string | null): string[] {
  if (!section) return []
  return listLines(section)
    .map((l) => cleanValue(l))
    .filter((l) => l && !isEmptyMarker(l))
}

// ============================================================================
// Hauptparser
// ============================================================================

/**
 * null nur, wenn selbst "Das Wichtigste" oder "Worum geht es" fehlt - ohne
 * diese beiden traegt die Karte nichts. Alles andere darf fehlen.
 */
export function parsePlainLanguage(markdown: string): PlainLanguageResult | null {
  try {
    if (!markdown) return null
    const md = markdown.replace(/\r\n?/g, '\n')

    const headline = firstLine(extractSection(md, HEADINGS.headline))
    const about = paragraph(extractSection(md, HEADINGS.about))
    if (!headline || !about) return null

    const urgencySection = extractSection(md, HEADINGS.urgency)
    // Ohne Feldlabel faellt die Stufe auf die erste Zeile der Sektion zurueck
    // ("## Dringlichkeit\nhoch").
    const levelRaw = urgencySection
      ? (extractField(urgencySection, LEVEL_LABELS) ?? firstLine(urgencySection))
      : null

    return {
      headline,
      urgency: normalizeUrgency(levelRaw),
      urgencyReason: urgencySection ? (extractField(urgencySection, WHY_LABELS) ?? '') : '',
      about,
      demand: paragraph(extractSection(md, HEADINGS.demand)),
      ifNothing: paragraph(extractSection(md, HEADINGS.ifNothing)),
      actions: extractActions(extractSection(md, HEADINGS.actions)),
      facts: extractLabeled(extractSection(md, HEADINGS.facts)),
      terms: extractLabeled(extractSection(md, HEADINGS.terms)).map((t) => ({
        term: t.label,
        explanation: t.value
      })),
      gaps: extractGaps(extractSection(md, HEADINGS.gaps))
    }
  } catch {
    return null
  }
}
