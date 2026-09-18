/**
 * Zerlegt lange Dokumente in ueberlappende Abschnitte fuer die
 * Map-Reduce-Analyse.
 *
 * Hintergrund: Passt ein Dokument auch mit vergroessertem num_ctx nicht ins
 * Kontextfenster, wurde es bisher am Ende abgeschnitten (siehe
 * src/main/prompts/token-budget.ts) - alles danach war fuer die Analyse
 * verloren. Stattdessen wird hier abschnittsweise geschnitten und das
 * Ergebnis spaeter zusammengefuehrt.
 *
 * Wichtigste Eigenschaft: es geht NIE Text verloren. Die Bereiche
 * [startChar, endChar) aller Chunks sind luecken- und ueberschneidungsfrei
 * und ergeben aneinandergehaengt exakt den Originaltext. Die Ueberlappung
 * steckt nur zusaetzlich im Feld `text`, nicht im Bereich.
 *
 * Keine Node-/Electron-APIs -> in Main und Renderer nutzbar und testbar.
 */

/** Konservative Schaetzung Zeichen/Token fuer deutschen Text - wie CHARS_PER_TOKEN im Main. */
const DEFAULT_CHARS_PER_TOKEN = 3.5
/** Spiegelt CHUNK_OVERLAP_TOKENS; shared darf src/main nicht importieren. */
const DEFAULT_OVERLAP_TOKENS = 200
/** Spiegelt MAX_CHUNKS; shared darf src/main nicht importieren. */
const DEFAULT_MAX_CHUNKS = 12
/**
 * Anteil des Fensters, in dem rueckwaerts nach einer Schnittgrenze gesucht
 * wird. Groesser = schoenere Schnitte, aber deutlich kleinere Chunks.
 */
const LOOKBACK_RATIO = 0.25

/** Schnittgrenzen nach Prioritaet: Absatz > Zeilenumbruch > Satzende. */
const BOUNDARY_PRIORITY: readonly (readonly string[])[] = [
  ['\r\n\r\n', '\n\n'],
  ['\n'],
  ['. ', '! ', '? ']
]

export interface TextChunk {
  index: number
  total: number
  /** Eigener Bereich plus vorangestellte Ueberlappung - das geht ans Modell. */
  text: string
  /** Beginn des eigenen Bereichs im Originaltext (ohne Ueberlappung). */
  startChar: number
  /** Ende des eigenen Bereichs im Originaltext, exklusiv. */
  endChar: number
}

export interface ChunkOptions {
  /** Token-Budget pro Chunk - die Ueberlappung zaehlt mit hinein. */
  budgetTokens: number
  overlapTokens?: number
  maxChunks?: number
  charsPerToken?: number
}

function resolveCharsPerToken(value: number | undefined): number {
  return value !== undefined && value > 0 ? value : DEFAULT_CHARS_PER_TOKEN
}

function estimateTokens(text: string, charsPerToken: number): number {
  return Math.ceil(text.length / charsPerToken)
}

/** Nur Whitespace, an dem ein Wortbruch unbedenklich ist (kein NBSP). */
function isWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13
}

export function needsChunking(text: string, budgetTokens: number, charsPerToken?: number): boolean {
  if (text.length === 0) return false
  return estimateTokens(text, resolveCharsPerToken(charsPerToken)) > budgetTokens
}

/**
 * Spaetestes Vorkommen einer der Grenzen im hinteren Fensterteil.
 * Liefert die Position NACH der Grenze (relativ zum Fenster) oder 0.
 */
function lastBoundary(window: string, minRel: number, needles: readonly string[]): number {
  let cut = 0
  for (const needle of needles) {
    const at = window.lastIndexOf(needle)
    if (at >= minRel) cut = Math.max(cut, at + needle.length)
  }
  return cut
}

/**
 * Schnittpunkt fuer den Chunk ab `start`. Sucht im hinteren Viertel des
 * Fensters nach einer Grenze; findet sich keine, wird als letzte Rettung an
 * beliebigem Whitespace geschnitten, erst danach hart mitten im Wort.
 */
function findCut(text: string, start: number, ownChars: number): number {
  const hardEnd = start + ownChars
  if (hardEnd >= text.length) return text.length

  const window = text.slice(start, hardEnd)
  const lookback = Math.max(1, Math.floor(ownChars * LOOKBACK_RATIO))
  const minRel = Math.max(1, window.length - lookback)

  for (const needles of BOUNDARY_PRIORITY) {
    const cut = lastBoundary(window, minRel, needles)
    if (cut > 0) return start + cut
  }
  for (let i = window.length - 1; i >= minRel; i--) {
    if (isWhitespace(window.charCodeAt(i))) return start + i + 1
  }
  return hardEnd
}

/** Luecken- und ueberschneidungsfreie Bereiche ueber den gesamten Text. */
function splitRanges(text: string, ownChars: number): [number, number][] {
  const ranges: [number, number][] = []
  let start = 0
  while (start < text.length) {
    const end = findCut(text, start, ownChars)
    ranges.push([start, end])
    start = end
  }
  return ranges
}

/**
 * Startpunkt der Ueberlappung: overlapChars vor dem Chunk, aber nach vorne
 * auf einen Wortanfang gezogen, damit der Zusatzkontext nicht mit einem
 * halben Wort beginnt.
 */
function overlapStart(text: string, startChar: number, overlapChars: number): number {
  if (startChar === 0 || overlapChars === 0) return startChar
  const raw = Math.max(0, startChar - overlapChars)
  if (raw === 0) return 0
  for (let i = raw; i < startChar; i++) {
    if (isWhitespace(text.charCodeAt(i))) return i + 1
  }
  return raw
}

export function splitIntoChunks(text: string, options: ChunkOptions): TextChunk[] {
  if (text.length === 0) return []

  const charsPerToken = resolveCharsPerToken(options.charsPerToken)
  if (!needsChunking(text, options.budgetTokens, charsPerToken)) {
    return [{ index: 0, total: 1, text, startChar: 0, endChar: text.length }]
  }

  const budgetChars = Math.max(1, Math.floor(options.budgetTokens * charsPerToken))
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS
  // Die Ueberlappung zaehlt ins Budget, darf es aber nicht auffressen.
  const overlapChars = Math.min(
    Math.max(0, Math.floor(overlapTokens * charsPerToken)),
    Math.floor(budgetChars / 2)
  )
  const maxChunks = Math.max(1, Math.floor(options.maxChunks ?? DEFAULT_MAX_CHUNKS))

  let ownChars = Math.max(1, budgetChars - overlapChars)
  // Deckel: lieber groessere Chunks als mehr Modellaufrufe - Text wegwerfen nie.
  if (Math.ceil(text.length / ownChars) > maxChunks) {
    ownChars = Math.ceil(text.length / maxChunks)
  }

  let ranges = splitRanges(text, ownChars)
  // Die Grenzensuche schneidet frueher als ownChars, dadurch kann der Deckel
  // trotzdem reissen - dann Fenster vergroessern und erneut schneiden.
  while (ranges.length > maxChunks && ownChars < text.length) {
    ownChars = Math.min(text.length, Math.ceil((ownChars * ranges.length) / maxChunks) + 1)
    ranges = splitRanges(text, ownChars)
  }

  const total = ranges.length
  return ranges.map(([startChar, endChar], index) => ({
    index,
    total,
    text: text.slice(overlapStart(text, startChar, overlapChars), endChar),
    startChar,
    endChar
  }))
}
