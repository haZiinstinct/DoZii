/**
 * Minimaler Parser fuer .eml-Dateien: RFC-822-Header, RFC-2045-MIME
 * (multipart, base64, quoted-printable) und RFC-2047-kodierte Header.
 *
 * Bewusst ohne neue Abhaengigkeit - DoZii bleibt offline und schlank, und die
 * Zielgruppe importiert einzelne Mails, keine Postfaecher. Der Parser wirft
 * nie: ein grob geparster Behoerdenbrief ist immer noch besser als ein
 * fehlgeschlagener Import.
 *
 * Keine Node-APIs ausser Buffer (Base64- und Charset-Dekodierung).
 */

export interface ParsedEmail {
  from: string | null
  to: string | null
  subject: string | null
  date: string | null
  body: string
}

/** Schutz gegen tief verschachtelte oder falsch terminierte multipart-Baeume. */
const MAX_MULTIPART_DEPTH = 4
/** Mehr Teile pro Ebene schaut sich niemand an - reiner Laufzeitschutz. */
const MAX_PARTS_PER_LEVEL = 50
/** Ab diesem Anteil an U+FFFD gilt eine UTF-8-Dekodierung als gescheitert. */
const REPLACEMENT_RATIO_MAX = 0.002

/**
 * Windows-1252 belegt 0x80-0x9F mit Satzzeichen (Anfuehrungszeichen,
 * Gedankenstrich, Euro). Reines latin1 macht daraus Steuerzeichen, die spaeter
 * die Druckbarkeitspruefung beim Import durchfallen lassen.
 */
const CP1252_HIGH_CODES = [
  0x20ac, -1, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, -1, 0x017d, -1, -1, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc,
  0x2122, 0x0161, 0x203a, 0x0153, -1, 0x017e, 0x0178
]

const LATIN1_CHARSETS = new Set([
  'iso-8859-1',
  'iso8859-1',
  'iso_8859-1',
  'latin1',
  'l1',
  'iso-8859-15',
  'iso8859-15',
  'latin9',
  'windows-1252',
  'cp1252',
  'cp-1252',
  'win-1252'
])

/** Nur die Entities, die in echten Mails vorkommen - kein vollstaendiger Katalog. */
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
  euro: '€',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß'
}

// ============================================================================
// Bytes -> Text
// ============================================================================

function normalizeCharset(charset?: string | null): string | null {
  if (!charset) return null
  const cs = charset
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '')
  return cs === '' ? null : cs
}

function decodeCp1252(bytes: Uint8Array): string {
  const latin1 = Buffer.from(bytes).toString('latin1')
  // Nur die 32 abweichenden Positionen ersetzen - der Rest ist mit latin1 identisch.
  let out = ''
  let start = 0
  for (let i = 0; i < latin1.length; i++) {
    const code = latin1.charCodeAt(i)
    if (code < 0x80 || code > 0x9f) continue
    const mapped = CP1252_HIGH_CODES[code - 0x80]
    if (mapped === -1) continue
    out += latin1.slice(start, i) + String.fromCharCode(mapped)
    start = i + 1
  }
  return start === 0 ? latin1 : out + latin1.slice(start)
}

function looksMisdecoded(text: string): boolean {
  if (text.length === 0) return false
  let bad = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) bad++
  }
  return bad / text.length > REPLACEMENT_RATIO_MAX
}

/**
 * Bytes in Text wandeln. Latin1-artige Charsets werden direkt ueber die
 * Windows-1252-Tabelle gelesen; sonst wird UTF-8 versucht und bei gehaeuften
 * Ersatzzeichen doch auf Windows-1252 zurueckgefallen - auch wenn der Header
 * UTF-8 behauptet, denn deutsche Amtspost ist oft falsch deklariert.
 *
 * Wird auch vom Text-Extraktor fuer .txt/.md genutzt, damit die Heuristik nur
 * einmal existiert.
 */
export function decodeTextBytes(bytes: Uint8Array, charset?: string | null): string {
  const cs = normalizeCharset(charset)
  if (cs !== null && LATIN1_CHARSETS.has(cs)) return decodeCp1252(bytes)
  const asUtf8 = Buffer.from(bytes).toString('utf8')
  return looksMisdecoded(asUtf8) ? decodeCp1252(bytes) : asUtf8
}

// ============================================================================
// Transfer-Encodings
// ============================================================================

function base64ToBytes(data: string): Uint8Array {
  // Buffer ignoriert ungueltige Zeichen still - genau das Verhalten, das wir
  // bei kaputten Mails wollen.
  return new Uint8Array(Buffer.from(data.replace(/\s+/g, ''), 'base64'))
}

/**
 * Quoted-Printable nach Bytes. `underscoreAsSpace` gilt nur fuer die
 * Q-Variante in Headern (RFC 2047).
 */
function qpToBytes(input: string, underscoreAsSpace: boolean): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '_' && underscoreAsSpace) {
      out.push(0x20)
      continue
    }
    if (ch === '=') {
      // Soft Line Break: '=' am Zeilenende (ggf. mit Leerzeichen davor) faellt weg.
      let j = i + 1
      while (input[j] === ' ' || input[j] === '\t') j++
      if (input[j] === '\n') {
        i = j
        continue
      }
      const hex = input.slice(i + 1, i + 3)
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16))
        i += 2
        continue
      }
      // Ungueltige Sequenz: '=' bleibt stehen, kommt in kaputten Mails vor.
      out.push(0x3d)
      continue
    }
    const code = input.charCodeAt(i)
    if (code < 256) {
      out.push(code)
      continue
    }
    // Nicht-Latin1 ist in QP regelwidrig - als UTF-8 durchreichen.
    const utf8 = Buffer.from(ch, 'utf8')
    for (let k = 0; k < utf8.length; k++) out.push(utf8[k])
  }
  return Uint8Array.from(out)
}

// ============================================================================
// Header
// ============================================================================

const ENCODED_WORD_RE = /=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g

/** RFC 2047: `=?UTF-8?B?...?=` / `=?UTF-8?Q?...?=` in Klartext wandeln. */
function decodeEncodedWords(value: string): string {
  if (!value.includes('=?')) return value
  // Whitespace zwischen zwei kodierten Woertern gehoert nicht zum Text.
  const joined = value.replace(/\?=\s+=\?/g, '?==?')
  return joined.replace(ENCODED_WORD_RE, (match, charset: string, enc: string, data: string) => {
    try {
      const bytes = enc.toLowerCase() === 'b' ? base64ToBytes(data) : qpToBytes(data, true)
      return decodeTextBytes(bytes, charset)
    } catch {
      return match
    }
  })
}

function looksLikeHeaderLine(text: string): boolean {
  return /^[A-Za-z][A-Za-z0-9-]*:/.test(text)
}

/** Gefaltete Zeilen (Fortsetzung mit Leerzeichen/Tab) zusammenfuehren. */
function unfold(headerBlock: string): string[] {
  const lines: string[] = []
  for (const line of headerBlock.split('\n')) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += ' ' + line.trim()
    } else {
      lines.push(line)
    }
  }
  return lines
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const map = new Map<string, string>()
  if (headerBlock === '') return map
  for (const line of unfold(headerBlock)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const name = line.slice(0, colon).trim().toLowerCase()
    // Erstes Vorkommen gewinnt (Received-Ketten haengen mehrfach dran).
    if (!map.has(name)) map.set(name, line.slice(colon + 1).trim())
  }
  return map
}

function headerValue(headers: Map<string, string>, name: string): string | null {
  const raw = headers.get(name)
  if (!raw) return null
  return decodeEncodedWords(raw).trim() || null
}

interface ContentType {
  type: string
  charset: string | null
  boundary: string | null
}

function readParam(parts: string[], name: string): string | null {
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim().toLowerCase() !== name) continue
    return part
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/s, '$1')
  }
  return null
}

function parseContentType(value: string | undefined): ContentType {
  if (!value) return { type: '', charset: null, boundary: null }
  const parts = value.split(';')
  const rest = parts.slice(1)
  return {
    type: parts[0].trim().toLowerCase(),
    charset: readParam(rest, 'charset'),
    boundary: readParam(rest, 'boundary')
  }
}

// ============================================================================
// HTML -> Text
// ============================================================================

function decodeEntities(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X'
      const code = parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match
      return String.fromCodePoint(code)
    }
    const named = HTML_ENTITIES[name]
    return named !== undefined ? named : match
  })
}

function collapseBlankLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
  const withBreaks = stripped
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td\s*>/gi, '\t')
    .replace(/<\/?(p|div|tr|li|h[1-6]|blockquote|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  return collapseBlankLines(decodeEntities(withBreaks))
}

// ============================================================================
// MIME-Struktur
// ============================================================================

interface PartText {
  plain: string | null
  html: string | null
}

const EMPTY_PART: PartText = { plain: null, html: null }

function splitMessage(raw: string): { headerBlock: string; body: string } {
  // Ohne erkennbare erste Header-Zeile ist das kein RFC-822-Kopf, sondern
  // schon Inhalt - sonst wuerde der erste Absatz als Header verschluckt.
  if (!looksLikeHeaderLine(raw)) return { headerBlock: '', body: raw }
  const sep = raw.indexOf('\n\n')
  if (sep === -1) return { headerBlock: raw, body: '' }
  return { headerBlock: raw.slice(0, sep), body: raw.slice(sep + 2) }
}

function splitParts(body: string, boundary: string): string[] {
  const segments = body.split(`--${boundary}`)
  const parts: string[] = []
  // Segment 0 ist die Preamble; '--' direkt nach der Boundary ist die Schlussmarke.
  for (let i = 1; i < segments.length && parts.length < MAX_PARTS_PER_LEVEL; i++) {
    const seg = segments[i]
    if (seg.startsWith('--')) break
    parts.push(seg.replace(/^[^\n]*\n/, ''))
  }
  return parts
}

function pickBest(parts: PartText[]): PartText {
  let plain: string | null = null
  let html: string | null = null
  for (const part of parts) {
    if (plain === null && part.plain !== null && part.plain.trim() !== '') plain = part.plain
    if (html === null && part.html !== null && part.html.trim() !== '') html = part.html
  }
  return { plain, html }
}

function decodeBody(body: string, encoding: string | undefined, charset: string | null): string {
  const enc = (encoding ?? '').trim().toLowerCase()
  if (enc === 'base64') return decodeTextBytes(base64ToBytes(body), charset)
  if (enc === 'quoted-printable') return decodeTextBytes(qpToBytes(body, false), charset)
  // 7bit/8bit/binary/unbekannt: der Text steht bereits lesbar da.
  return body
}

function bodyText(headers: Map<string, string>, body: string, depth: number): PartText {
  const ct = parseContentType(headers.get('content-type'))

  if (ct.type.startsWith('multipart/')) {
    if (!ct.boundary || depth >= MAX_MULTIPART_DEPTH) return EMPTY_PART
    return pickBest(splitParts(body, ct.boundary).map((p) => extractPart(p, depth + 1)))
  }

  const text = decodeBody(body, headers.get('content-transfer-encoding'), ct.charset)
  if (ct.type === 'text/html') return { plain: null, html: htmlToText(text) }
  // Fehlender Content-Type heisst laut RFC text/plain.
  if (ct.type === '' || ct.type.startsWith('text/')) return { plain: text, html: null }
  return EMPTY_PART
}

function extractPart(rawPart: string, depth: number): PartText {
  const { headerBlock, body } = splitMessage(rawPart)
  const headers = parseHeaders(headerBlock)
  // Anhaenge interessieren nicht - importiert wird der Mailtext.
  if ((headers.get('content-disposition') ?? '').trim().toLowerCase().startsWith('attachment')) {
    return EMPTY_PART
  }
  return bodyText(headers, body, depth)
}

// ============================================================================
// Oeffentliche API
// ============================================================================

function buildHeaderBlock(
  from: string | null,
  to: string | null,
  date: string | null,
  subject: string | null
): string {
  const lines: string[] = []
  if (from) lines.push(`Von: ${from}`)
  if (to) lines.push(`An: ${to}`)
  if (date) lines.push(`Datum: ${date}`)
  if (subject) lines.push(`Betreff: ${subject}`)
  return lines.join('\n')
}

/**
 * Zerlegt eine .eml-Datei. `body` traegt eine kompakte deutsche Kopfzeile
 * (Von/An/Datum/Betreff) vor dem eigentlichen Text, damit das Modell den
 * Kontext hat, ohne die Header separat durchreichen zu muessen.
 */
export function parseEml(raw: string): ParsedEmail {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { from: null, to: null, subject: null, date: null, body: '' }
  }

  const normalized = raw.replace(/\r\n?/g, '\n')

  try {
    const { headerBlock, body } = splitMessage(normalized)
    const headers = parseHeaders(headerBlock)
    const from = headerValue(headers, 'from')
    const to = headerValue(headers, 'to')
    const subject = headerValue(headers, 'subject')
    const date = headerValue(headers, 'date')

    const picked = bodyText(headers, body, 0)
    const head = buildHeaderBlock(from, to, date, subject)

    let text = (picked.plain ?? picked.html ?? '').trim()
    // Nichts Brauchbares gefunden: lieber Rohtext zeigen als eine leere Ansicht.
    if (text === '') text = body.trim()
    if (text === '' && head === '') text = normalized.trim()

    const composed = head === '' ? text : text === '' ? head : `${head}\n\n${text}`
    return { from, to, subject, date, body: composed }
  } catch {
    return { from: null, to: null, subject: null, date: null, body: normalized.trim() }
  }
}
