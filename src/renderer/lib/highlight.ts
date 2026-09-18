/**
 * Evidence-Highlighting: bildet ein Zitat des Modells auf Zeichenpositionen im
 * Originaltext ab und zerlegt den Originaltext in Segmente mit jeweils
 * konstanter Menge aktiver Markierungen.
 *
 * Warum nicht einfach `indexOf`: das Modell zitiert selten zeichengenau -
 * Zeilenumbrueche, Silbentrennung am Zeilenende, typografische
 * Anfuehrungszeichen und Gross-/Kleinschreibung weichen ab. Deshalb laufen
 * Originaltext UND Zitat durch dieselbe Normalisierung; eine Index-Map fuehrt
 * den Treffer verlustfrei auf Originalpositionen zurueck.
 *
 * Bewusst KEIN Fuzzy-Matching: die Markierung ist der Beleg fuer den Nutzer -
 * eine falsch markierte Stelle ist schlimmer als eine nicht markierte.
 */

export interface HighlightQuery {
  id: string
  quote: string
  /** Frei belegbar (z.B. 'high' | 'medium' | 'low') - wird nur durchgereicht. */
  severity?: string
}

export interface HighlightSpan {
  id: string
  /** Startindex im ORIGINALTEXT, inklusiv. */
  start: number
  /** Endindex im ORIGINALTEXT, exklusiv. */
  end: number
  severity?: string
}

export interface HighlightSegment {
  text: string
  /** An dieser Stelle aktive Spans; leeres Array = unmarkierter Text. */
  spans: HighlightSpan[]
}

/**
 * Kuerzere Zitate werden ignoriert - "ja" oder "und" trifft irgendwo und
 * markiert Unsinn. Gleiche Schwelle wie `isInDocument` in parse-analysis.
 */
const MIN_QUOTE_CHARS = 4

/** Ab dieser Laenge darf ersatzweise nur der Zitatanfang gesucht werden. */
const PREFIX_FALLBACK_MIN_CHARS = 40

/** Typografische Anfuehrungszeichen/Apostrophe auf gerade Zeichen ziehen. */
const QUOTE_REPLACEMENTS: Record<string, string> = {
  '\u201E': '"',
  '\u201C': '"',
  '\u201D': '"',
  '\u201F': '"',
  '\u00AB': '"',
  '\u00BB': '"',
  '\u2033': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u2039': "'",
  '\u203A': "'",
  '\u02BC': "'",
  '\u2032': "'"
}

const WHITESPACE = /\s/

interface NormalizedText {
  text: string
  /** map[i] = Index, an dem text[i] im Originaltext beginnt. */
  map: number[]
}

/**
 * Prueft, ob an `hyphenIndex` eine Silbentrennung am Zeilenende steht, also
 * hinter dem Bindestrich (ausser Leerzeichen/Tabs) ein Umbruch folgt.
 */
function isHyphenLineBreak(input: string, hyphenIndex: number): boolean {
  for (let i = hyphenIndex + 1; i < input.length; i++) {
    const ch = input[i]
    if (ch === '\n' || ch === '\r') return true
    if (ch === ' ' || ch === '\t') continue
    return false
  }
  return false
}

/**
 * Ein einziger Durchlauf, der gleichzeitig normalisiert und die Index-Map
 * aufbaut. Normalisierung: Kleinschreibung, Whitespace-Folgen zu einem
 * Leerzeichen, weiche Trennstriche und Trennstrich-vor-Umbruch entfernt,
 * Anfuehrungszeichen vereinheitlicht.
 */
function normalizeWithMap(input: string): NormalizedText {
  const chars: string[] = []
  const map: number[] = []

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    // Weicher Trennstrich verschwindet spurlos.
    if (ch === '\u00AD') continue

    // Silbentrennung am Zeilenende ("Ver-\ntrag" -> "vertrag"): Bindestrich,
    // Umbruch und die Einrueckung der Folgezeile fallen weg.
    if ((ch === '-' || ch === '\u2010') && isHyphenLineBreak(input, i)) {
      let j = i + 1
      while (j < input.length && WHITESPACE.test(input[j])) j++
      i = j - 1
      continue
    }

    if (WHITESPACE.test(ch)) {
      chars.push(' ')
      map.push(i)
      let j = i + 1
      while (j < input.length && WHITESPACE.test(input[j])) j++
      i = j - 1
      continue
    }

    const replacement = QUOTE_REPLACEMENTS[ch]
    if (replacement !== undefined) {
      chars.push(replacement)
      map.push(i)
      continue
    }

    // toLowerCase kann aus einem Zeichen mehrere machen (z.B. 'İ'), deshalb
    // wird pro erzeugtem Zeichen ein Map-Eintrag geschrieben.
    const lower = ch.toLowerCase()
    for (let k = 0; k < lower.length; k++) {
      chars.push(lower[k])
      map.push(i)
    }
  }

  return { text: chars.join(''), map }
}

/**
 * Sucht ein Zitat im bereits normalisierten Dokument. Ausgelagert, damit
 * `buildHighlightSegments` die Normalisierung nur einmal bezahlt.
 */
function findInNormalized(
  normalized: NormalizedText,
  quote: string
): { start: number; end: number } | null {
  const needle = normalizeWithMap(quote).text.trim()
  if (needle.length < MIN_QUOTE_CHARS) return null

  let at = normalized.text.indexOf(needle)
  let length = needle.length

  // Einziges Zugestaendnis an ungenaue Zitate: bei langen Zitaten reicht der
  // Anfang. Modelle kuerzen das Ende gern mit "..." oder haengen eine
  // Erlaeuterung an - der Anfang stimmt dagegen fast immer.
  if (at === -1 && needle.length > PREFIX_FALLBACK_MIN_CHARS) {
    const prefix = needle.slice(0, PREFIX_FALLBACK_MIN_CHARS).trimEnd()
    if (prefix.length >= MIN_QUOTE_CHARS) {
      at = normalized.text.indexOf(prefix)
      length = prefix.length
    }
  }

  if (at === -1) return null

  // `indexOf` liefert das erste Vorkommen - bei mehrfach identischem Zitat
  // gewinnt damit die fruehste Stelle.
  return { start: normalized.map[at], end: normalized.map[at + length - 1] + 1 }
}

/**
 * Position eines Zitats im Originaltext oder null, wenn es dort nicht steht.
 * Fuer Einzelabfragen gedacht; bei mehreren Zitaten `buildHighlightSegments`
 * nutzen (normalisiert nur einmal).
 */
export function findQuoteRange(
  documentText: string,
  quote: string
): { start: number; end: number } | null {
  if (documentText.length === 0 || quote.length === 0) return null
  return findInNormalized(normalizeWithMap(documentText), quote)
}

/**
 * Zerlegt den Originaltext in aufeinanderfolgende Segmente. Innerhalb eines
 * Segments ist die Menge aktiver Spans konstant, damit sich ueberlappende
 * Zitate korrekt schachteln lassen. Aneinandergehaengt ergeben die Segmente
 * wieder exakt den Originaltext.
 */
export function buildHighlightSegments(
  documentText: string,
  queries: HighlightQuery[]
): HighlightSegment[] {
  if (documentText.length === 0) return []
  if (queries.length === 0) return [{ text: documentText, spans: [] }]

  // Nur EINE Normalisierung pro Aufruf - bei 200k Zeichen und 60 Zitaten
  // waere ein Durchlauf je Zitat mit Abstand der teuerste Teil.
  const normalized = normalizeWithMap(documentText)

  const spans: HighlightSpan[] = []
  for (const query of queries) {
    const range = findInNormalized(normalized, query.quote)
    if (!range) continue
    spans.push({ id: query.id, start: range.start, end: range.end, severity: query.severity })
  }

  if (spans.length === 0) return [{ text: documentText, spans: [] }]

  // Zwischen zwei benachbarten Span-Grenzen aendert sich die Menge aktiver
  // Spans nicht - genau das sind die Segmentgrenzen.
  const boundaries = new Set<number>([0, documentText.length])
  for (const span of spans) {
    boundaries.add(span.start)
    boundaries.add(span.end)
  }
  const sorted = [...boundaries].sort((a, b) => a - b)

  const segments: HighlightSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i]
    const to = sorted[i + 1]
    const active = spans
      .filter((span) => span.start <= from && span.end >= to)
      // Aeusserer Span zuerst, damit die UI schachteln kann; die id ist der
      // Stabilitaetsanker bei deckungsgleichen Zitaten.
      .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id))
    segments.push({ text: documentText.slice(from, to), spans: active })
  }

  return segments
}
