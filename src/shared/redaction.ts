/**
 * Schwaerzen personenbezogener Daten vor dem Export.
 *
 * Wer seine Analyse an eine Beratungsstelle weitergibt, soll Name, IBAN,
 * Adresse und Aktenzeichen maskieren koennen. Bewusst konservativ: geschwaerzt
 * wird nur, was sich pruefen laesst (IBAN-Pruefsumme, Luhn) oder an einem
 * Schluesselwort haengt (Aktenzeichen, Geburtsdatum). Ein uebersehener Treffer
 * ist aergerlich - ein zerschossener Analysetext ist unbrauchbar.
 *
 * Keine Node-/DOM-APIs -> in Main (Export) und Renderer (Vorschau) nutzbar.
 */

import { MONTHS_FULL_CAPITALIZED_PATTERN } from './german-months'

export type RedactionKind =
  | 'iban'
  | 'bic'
  | 'steuerid'
  | 'steuernummer'
  | 'svnummer'
  | 'email'
  | 'phone'
  | 'aktenzeichen'
  | 'kundennummer'
  | 'birthdate'
  | 'creditcard'
  | 'plz-ort'
  | 'custom'

export const ALL_REDACTION_KINDS = [
  'iban',
  'bic',
  'steuerid',
  'steuernummer',
  'svnummer',
  'email',
  'phone',
  'aktenzeichen',
  'kundennummer',
  'birthdate',
  'creditcard',
  'plz-ort',
  'custom'
] as const satisfies readonly RedactionKind[]

/**
 * Default-Auswahl. 'plz-ort' fehlt bewusst: "5 Ziffern + grossgeschriebenes
 * Wort" trifft in Behoerdentexten zu oft Betraege, Paragraphen oder
 * Aktenzeichen - nur auf ausdruecklichen Wunsch.
 */
export const DEFAULT_REDACTION_KINDS: readonly RedactionKind[] = ALL_REDACTION_KINDS.filter(
  (kind) => kind !== 'plz-ort'
)

/** Beschriftungen fuer die Auswahl im Export-Dialog. */
export const REDACTION_KIND_LABELS: Record<RedactionKind, string> = {
  iban: 'IBAN / Kontonummer',
  bic: 'BIC',
  steuerid: 'Steuer-Identifikationsnummer',
  steuernummer: 'Steuernummer',
  svnummer: 'Sozialversicherungsnummer',
  email: 'E-Mail-Adresse',
  phone: 'Telefonnummer',
  aktenzeichen: 'Aktenzeichen / Geschäftszeichen',
  kundennummer: 'Kunden- und Rechnungsnummer',
  birthdate: 'Geburtsdatum',
  creditcard: 'Kreditkartennummer',
  'plz-ort': 'Postleitzahl und Ort',
  custom: 'Eigene Begriffe (Name, Straße)'
}

export interface RedactionSpan {
  /** Offset im ORIGINALTEXT, nicht im Ergebnis. */
  start: number
  end: number
  kind: RedactionKind
  original: string
  replacement: string
}

export interface RedactionOptions {
  /** Welche Arten geschwaerzt werden. Default: alles ausser 'plz-ort'. */
  kinds?: RedactionKind[]
  /** Vom Nutzer genannte Begriffe (Name, Straße) - wortgrenzensensitiv. */
  customTerms?: string[]
  /** Letzte n Zeichen sichtbar lassen: `[IBAN ...3000]`. Default 0. */
  keepLastChars?: number
}

export interface RedactionResult {
  text: string
  /** Aufsteigend nach `start`, garantiert ueberlappungsfrei. */
  spans: RedactionSpan[]
  /** Nur Arten mit mindestens einem Treffer. */
  countByKind: Record<string, number>
}

/**
 * Sprechende Platzhalter statt eines gleichlangen '█'-Blocks: im PDF bleibt
 * der Satzbau lesbar und der Empfaenger sieht, WAS fehlt.
 */
const PLACEHOLDER_LABEL: Record<RedactionKind, string> = {
  iban: 'IBAN',
  bic: 'BIC',
  steuerid: 'Steuer-ID',
  steuernummer: 'Steuernummer',
  svnummer: 'SV-Nummer',
  email: 'E-Mail',
  phone: 'Telefon',
  aktenzeichen: 'Aktenzeichen',
  kundennummer: 'Kundennummer',
  birthdate: 'Geburtsdatum',
  creditcard: 'Kreditkarte',
  'plz-ort': 'Ort',
  custom: 'Name'
}

/**
 * Spezifitaet: entscheidet, wenn zwei GLEICH LANGE Treffer kollidieren. Bei
 * unterschiedlicher Laenge gewinnt immer der laengere.
 */
const PRIORITY: Record<RedactionKind, number> = {
  iban: 0,
  bic: 1,
  creditcard: 2,
  svnummer: 3,
  steuernummer: 4,
  steuerid: 5,
  email: 6,
  birthdate: 7,
  aktenzeichen: 8,
  kundennummer: 9,
  phone: 10,
  'plz-ort': 11,
  custom: 12
}

// ============================================================================
// Pruefsummen
// ============================================================================

/**
 * IBAN-Pruefung nach ISO 13616 (MOD 97-10). Ohne sie wuerde jedes zweite
 * Aktenzeichen als IBAN durchgehen. Leerzeichen und Kleinschreibung erlaubt.
 */
export function isValidIban(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false

  // Erste vier Zeichen ans Ende, Buchstaben als 10..35, Rest mod 97 muss 1 sein.
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let remainder = 0
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i)
    const num = code >= 65 ? code - 55 : code - 48
    remainder = num > 9 ? (remainder * 100 + num) % 97 : (remainder * 10 + num) % 97
  }
  return remainder === 1
}

/**
 * Pruefziffer der Steuer-Identifikationsnummer (ISO 7064, MOD 11,10). Ohne sie
 * galt jede 11-stellige Zahl ohne fuehrende 0 als Steuer-ID.
 */
export function isValidSteuerId(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (!/^[1-9]\d{10}$/.test(digits)) return false
  let product = 10
  for (let i = 0; i < 10; i++) {
    let sum = (digits.charCodeAt(i) - 48 + product) % 10
    if (sum === 0) sum = 10
    product = (sum * 2) % 11
  }
  let check = 11 - product
  if (check === 10) check = 0
  return check === digits.charCodeAt(10) - 48
}

/** Luhn-Pruefsumme. Nicht-Ziffern werden ignoriert (Leerzeichen, Bindestriche). */
export function isValidLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 2) return false

  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let num = digits.charCodeAt(i) - 48
    if (double) {
      num *= 2
      if (num > 9) num -= 9
    }
    sum += num
    double = !double
  }
  return sum % 10 === 0
}

// ============================================================================
// Muster
// ============================================================================

/**
 * IBAN-Kandidat: Laendercode + Pruefziffern + 11-30 weitere Zeichen, optional
 * in Vierergruppen, gross oder klein. Greedy - der Treffer sammelt auch Folgewoerter ein
 * ("... 0130 00 BIC COBADEFF"), deshalb kuerzt `refineIban` von hinten.
 */
const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/gi

/** 13-19 Ziffern, optional gruppiert. Erst Luhn entscheidet. */
const CREDITCARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g

/** Sozialversicherungsnummer: 12 150380 M 123 (Bereich, Geburtsdatum, Initial, Serie). */
const SVNUMMER_RE = /\b\d{2} ?\d{6} ?[A-Z] ?\d{3}\b/g

/** Steuernummer mit Schraegstrichen: 12/345/67890 oder 123/456/78901. */
const STEUERNUMMER_RE = /\b\d{2,3}\/\d{3}\/\d{4,5}\b/g

/**
 * Steuernummer in anderen Schreibweisen ("2181508150123", "21 815 08150")
 * nur mit Schluesselwort - eine nackte 13-stellige Zahl ist genauso gut eine
 * Kunden- oder Belegnummer.
 */
const STEUERNUMMER_KEYED_RE =
  /\b(?:[Ss]teuernummer|[Ss]teuer-?[Nn]r\.?|[Ss]t\.?-?[Nn]r\.?)[ \t]*[:.]?[ \t]*(\d(?:[ /]?\d){9,12})(?!\d)/g

/** BIC nur mit Schluesselwort: "BIC: COBADEFFXXX", "BIC COBADEFF". */
const BIC_RE =
  /(?<![A-Za-z])(?:BIC|SWIFT(?:-Code)?)[ \t]*:?[ \t]*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)(?![A-Za-z0-9])/g

/**
 * Steuer-Identifikationsnummer: genau 11 Ziffern, optional mit Leerzeichen
 * gruppiert (86 095742719, 12 345 678 901). Fuehrende 0 ausgeschlossen, sonst
 * kollidiert jede Ortsvorwahl damit. Schraegstriche gehoeren zur
 * Steuernummer - hier deshalb nur Leerzeichen als Trenner.
 */
const STEUERID_RE = /\b[1-9](?: ?\d){10}\b/g

/**
 * Mit Laengengrenzen (lokaler Teil 64, Label 63, hoechstens 8 Labels): ohne sie
 * lief die Suche auf langen Zeichenketten ohne "@" quadratisch.
 */
const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}\b/g

/**
 * Deutsche Telefonnummern: +49/0049 mit optionalem "(0)", oder national mit
 * fuehrender 0 und optionaler Klammer-Vorwahl. Trenner: Leerzeichen, Punkt,
 * Schraegstrich, Bindestrich.
 */
const PHONE_RE =
  /(?<![\d/])(?:(?:\+|00)49[ ./-]?(?:\(0\)[ ./-]?)?|\(?0\d{2,5}\)?[ ./-]?)\d(?:[ ./-]?\d){4,13}(?!\d)/g

/**
 * Baustein fuer Aktenzeichen-Werte: "S 12 AS 345/26", "4 Ca 1234/24",
 * "1234/56", "2024-0815", "ab12345". Registerzeichen in gemischter Schreibweise
 * ("Ca", "Js") nur, wenn danach eine Zahl folgt - sonst frisst der Wert das
 * naechste Wort ("Az. 12/345 Bitte ...").
 */
const REF_TOKEN = '(?:[A-Z]{1,4}(?![a-z])|[A-Z][a-z]{1,3}(?=[ ./-]\\d)|[A-Za-z]{0,4}\\d+[A-Za-z]?)'
// Hoechstens 8 Bausteine: ohne Grenze lief die Suche auf langen Ketten wie
// "A1-A1-A1-..." quadratisch (20 000 Bausteine: 2 s).
const REF_VALUE = `${REF_TOKEN}(?:[ ./-]${REF_TOKEN}){0,7}`

/** Trennung zwischen Schluesselwort und Wert: "Az. ", "Nr.: ", " - ". */
const KEY_SEPARATOR = '[ \\t]*[:.-]{0,2}[ \\t]*'

/** "Kundennummer" / "Kunden-Nr" / "Kundennr" aus einem Wortstamm. */
function numberKeyword(stem: string): string {
  return `${stem}(?:nummer|-?[Nn]r)`
}

/**
 * Aktenzeichen nur MIT Schluesselwort - "12/345" allein steht in jedem
 * Behoerdenbrief und waere ein Fehlalarm-Generator. Geschwaerzt wird nur
 * Gruppe 1 (der Wert), das Schluesselwort bleibt als Kontext stehen.
 */
const AKTENZEICHEN_RE = new RegExp(
  '\\b(?:[Aa]ktenzeichen|[Aa][Zz]|[Gg]esch(?:äfts|aefts)zeichen|[Gg]esch\\.-?Z|' +
    `${numberKeyword('[Vv]organgs')})${KEY_SEPARATOR}(${REF_VALUE})`,
  'g'
)

const KUNDENNUMMER_RE = new RegExp(
  '\\b(?:' +
    [
      numberKeyword('[Kk]unden'),
      '[Kk]d\\.?-?[Nn]r',
      numberKeyword('[Rr]echnungs'),
      '[Rr]g\\.?-?[Nn]r',
      numberKeyword('[Vv]ertrags'),
      numberKeyword('[Mm]itglieds'),
      numberKeyword('[Pp]ersonal'),
      numberKeyword('[Vv]ersicherten'),
      numberKeyword('[Vv]ersicherungs')
    ].join('|') +
    `)${KEY_SEPARATOR}(${REF_VALUE})`,
  'g'
)

const DATE_VALUE =
  '(?:\\d{1,2}\\. ?\\d{1,2}\\. ?\\d{2,4}' +
  `|\\d{1,2}\\. ?(?:${MONTHS_FULL_CAPITALIZED_PATTERN}) \\d{4}` +
  '|\\d{4}-\\d{2}-\\d{2})'

/** Geburtsdatum nur mit Schluesselwort - sonst faellt jedes Bescheiddatum darunter. */
const BIRTHDATE_RE = new RegExp(
  '(?:\\b(?:[Gg]eboren|[Gg]eb\\.?-?[Dd]atum|[Gg]eburtsdat(?:um|\\.)|[Gg]eburtstag|[Gg]eb\\.?)' +
    '(?: am)?|(?<![\\w*])\\*)' +
    `[ \\t]*[:,]?[ \\t]*(${DATE_VALUE})`,
  'g'
)

/** PLZ + Ort, bis zu drei Ortsbestandteile ("Frankfurt am Main", "Bad Nauheim"). */
const PLZ_ORT_RE =
  /(?<!\d)\d{5}(?!\d) +[A-ZÄÖÜ][a-zäöüß]+(?:[ -](?:am|an|der|des|im|in|ob|vor)|[ -][A-ZÄÖÜ][a-zäöüß]+){0,3}/g

// ============================================================================
// Treffersuche
// ============================================================================

interface RawSpan {
  start: number
  end: number
  kind: RedactionKind
  priority: number
}

/**
 * Verfeinert einen Rohtreffer: liefert ein PRAEFIX davon oder null (verwerfen).
 * `before` ist der Text unmittelbar vor dem Treffer (fuer Kontextregeln).
 */
type Refine = (value: string, before: string) => string | null

/**
 * Sammelt Treffer eines Musters. Hat das Muster eine Gruppe 1, zaehlt nur
 * diese als Treffer - sie muss dann am Ende des Gesamttreffers stehen, damit
 * sich ihr Offset ohne das `d`-Flag ableiten laesst.
 */
function collect(text: string, re: RegExp, kind: RedactionKind, refine?: Refine): RawSpan[] {
  const spans: RawSpan[] = []
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex++
      continue
    }
    const raw = match[1] ?? match[0]
    const start = match.index + match[0].length - raw.length
    const refined = refine ? refine(raw, text.slice(Math.max(0, start - 24), start)) : raw
    if (refined === null || refined.length === 0) continue
    spans.push({ start, end: start + refined.length, kind, priority: PRIORITY[kind] })
  }
  return spans
}

/**
 * Kuerzt einen greedy IBAN-Kandidaten gruppenweise von hinten, bis die
 * Pruefsumme stimmt. "DE89 3704 0044 0532 0130 00 BIC XY" -> nur die IBAN.
 */
function refineIban(candidate: string): string | null {
  const groups = candidate.split(' ')
  for (let count = groups.length; count >= 1; count--) {
    const slice = groups.slice(0, count).join(' ')
    if (isValidIban(slice)) return slice
  }
  // Ohne Leerzeichen geschrieben und direkt gefolgt von Text
  // ("IBAN:DE89370400440532013000BIC:..."): zeichenweise von hinten kuerzen.
  if (groups.length === 1) {
    for (let length = Math.min(candidate.length, 34); length >= 15; length--) {
      const slice = candidate.slice(0, length)
      if (isValidIban(slice)) return slice
    }
  }
  return null
}

/** Tatsaechlich vergebene Kartenlaengen - 17 und 18 Stellen gibt es nicht. */
const CREDITCARD_LENGTHS = new Set([13, 14, 15, 16, 19])

/**
 * Herausgeber-Praefix und Laenge muessen zusammenpassen. Nur die erste Ziffer
 * zu pruefen reichte nicht: "R-2024-12345678901" (15 Stellen, beginnt mit 2,
 * Luhn zufaellig gueltig) wurde zur Kreditkarte.
 */
function isKnownCardPrefix(digits: string): boolean {
  const len = digits.length
  if (digits.startsWith('4')) return len === 13 || len === 16 || len === 19 // Visa
  const two = Number(digits.slice(0, 2))
  const four = Number(digits.slice(0, 4))
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return len === 16 // Mastercard
  if (two === 34 || two === 37) return len === 15 // American Express
  if (digits.startsWith('6011') || two === 65) return len >= 16 && len <= 19 // Discover
  return false
}

function refineCreditCard(candidate: string): string | null {
  const digits = candidate.replace(/\D/g, '')
  // Der Ziffernblock einer deutschen IBAN hat genau 18 Stellen und besteht in
  // jedem zehnten Fall die Luhn-Pruefung - ohne Laengenfilter wuerde jede
  // zweite Kontonummer als Kreditkarte durchgehen.
  if (!CREDITCARD_LENGTHS.has(digits.length)) return null
  if (!isKnownCardPrefix(digits)) return null
  return isValidLuhn(digits) ? candidate : null
}

/**
 * Laengenplausibilitaet: eine deutsche Rufnummer hat inkl. fuehrender 0
 * hoechstens 13 Ziffern (mit Laendercode 14, E.164). Alles darueber ist eine
 * Konto- oder Kundennummer, die nur zufaellig wie eine Vorwahl beginnt.
 */
function refinePhone(candidate: string, before: string): string | null {
  const digits = candidate.replace(/\D/g, '')
  const international = /^(?:\+|00)49/.test(candidate)
  const max = international ? 14 : 13
  const min = international ? 9 : 7
  if (digits.length < min || digits.length > max) return null
  // Steht eine Nummernart davor, ist es keine Rufnummer: "Bescheid-Nr.
  // 0123/456789", "Kto 012345678".
  if (NUMBER_CONTEXT_RE.test(before)) return null
  // Ohne Trenner und ohne Laendervorwahl sieht jede Ziffernfolge mit 0 vorn
  // wie eine Rufnummer aus - dann nur mit "Tel."/"Fax" usw. davor.
  const separated = /[ ./()-]/.test(candidate)
  if (!international && !separated && !PHONE_CONTEXT_RE.test(before)) return null
  return candidate
}

/** Kontext vor einem Treffer, der ihn als Konto-/Vorgangsnummer ausweist. */
const NUMBER_CONTEXT_RE =
  /(?:[Nn]r|[Nn]ummer|[Kk]to|[Kk]onto|[Aa]z|[Zz]eichen|IBAN|BLZ)\.?[ \t]*[:.]?[ \t]*$/

/** Kontext, der eine Rufnummer ankuendigt. */
const PHONE_CONTEXT_RE =
  /(?:[Tt]el(?:efon)?|[Ff]on|[Mm]obil|[Hh]andy|[Ff]ax|[Rr]uf)\.?(?:nummer|-?[Nn]r\.?)?[ \t]*[:.]?[ \t]*$/

function refineSteuerId(candidate: string): string | null {
  return isValidSteuerId(candidate) ? candidate : null
}

/** Ein Aktenzeichen ohne Ziffer ist ein Wort, kein Zeichen ("Az. Siehe Anlage"). */
function requireDigit(value: string): string | null {
  return /\d/.test(value) ? value : null
}

const DETECTORS: ReadonlyArray<{ kind: RedactionKind; re: RegExp; refine?: Refine }> = [
  { kind: 'iban', re: IBAN_RE, refine: refineIban },
  { kind: 'bic', re: BIC_RE },
  { kind: 'creditcard', re: CREDITCARD_RE, refine: refineCreditCard },
  { kind: 'svnummer', re: SVNUMMER_RE },
  { kind: 'steuernummer', re: STEUERNUMMER_RE },
  { kind: 'steuernummer', re: STEUERNUMMER_KEYED_RE },
  { kind: 'steuerid', re: STEUERID_RE, refine: refineSteuerId },
  { kind: 'email', re: EMAIL_RE },
  { kind: 'birthdate', re: BIRTHDATE_RE },
  { kind: 'aktenzeichen', re: AKTENZEICHEN_RE, refine: requireDigit },
  { kind: 'kundennummer', re: KUNDENNUMMER_RE, refine: requireDigit },
  { kind: 'phone', re: PHONE_RE, refine: refinePhone },
  { kind: 'plz-ort', re: PLZ_ORT_RE }
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectCustom(text: string, terms: string[]): RawSpan[] {
  const cleaned = terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    // Laengster Begriff zuerst - Alternation nimmt sonst "Müller" statt "Müller GmbH".
    .sort((a, b) => b.length - a.length)
  if (cleaned.length === 0) return []

  // \b scheitert an Umlauten (JS zaehlt ä/ö/ü nicht als Wortzeichen, "Öztürk"
  // haette am Wortanfang keine Grenze) -> Lookaround auf Unicode-Buchstaben.
  const alternatives = cleaned.map(escapeRegExp).join('|')
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'giu')
  return collect(text, re, 'custom')
}

/**
 * Loest Ueberlappungen auf: laengerer Treffer gewinnt, bei gleicher Laenge der
 * spezifischere (siehe PRIORITY). Ergebnis ist nach `start` sortiert.
 */
function resolveOverlaps(candidates: RawSpan[]): RawSpan[] {
  const byRelevance = [...candidates].sort((a, b) => {
    const lengthDiff = b.end - b.start - (a.end - a.start)
    if (lengthDiff !== 0) return lengthDiff
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.start - b.start
  })

  const kept: RawSpan[] = []
  for (const candidate of byRelevance) {
    const collides = kept.some((span) => candidate.start < span.end && span.start < candidate.end)
    if (!collides) kept.push(candidate)
  }
  return kept.sort((a, b) => a.start - b.start)
}

function buildReplacement(kind: RedactionKind, original: string, keepLastChars: number): string {
  const label = PLACEHOLDER_LABEL[kind]
  if (keepLastChars > 0) {
    const compact = original.replace(/\s+/g, '')
    // Nur kuerzen, wenn wirklich etwas verdeckt bleibt.
    if (compact.length > keepLastChars) {
      return `[${label} ...${compact.slice(-keepLastChars)}]`
    }
  }
  return `[${label} geschwaerzt]`
}

// ============================================================================
// Oeffentliche API
// ============================================================================

/**
 * Maskiert personenbezogene Daten. Die Offsets in `spans` beziehen sich auf
 * den EINGABETEXT (fuer eine Vorschau mit Markierungen), `text` ist das
 * fertige Ergebnis.
 */
export function redactText(text: string, options: RedactionOptions = {}): RedactionResult {
  const kinds = new Set(options.kinds ?? DEFAULT_REDACTION_KINDS)
  const keepLastChars = Math.max(0, Math.trunc(options.keepLastChars ?? 0))

  if (text.length === 0 || kinds.size === 0) {
    return { text, spans: [], countByKind: {} }
  }

  const candidates: RawSpan[] = []
  for (const detector of DETECTORS) {
    if (!kinds.has(detector.kind)) continue
    candidates.push(...collect(text, detector.re, detector.kind, detector.refine))
  }
  if (kinds.has('custom') && options.customTerms) {
    candidates.push(...collectCustom(text, options.customTerms))
  }

  const spans: RedactionSpan[] = resolveOverlaps(candidates).map((span) => {
    const original = text.slice(span.start, span.end)
    return {
      start: span.start,
      end: span.end,
      kind: span.kind,
      original,
      replacement: buildReplacement(span.kind, original, keepLastChars)
    }
  })

  const countByKind: Record<string, number> = {}
  for (const span of spans) {
    countByKind[span.kind] = (countByKind[span.kind] ?? 0) + 1
  }

  // Ein Durchlauf von hinten nach vorne - so bleiben die Offsets gueltig.
  const parts: string[] = []
  let cursor = text.length
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i]
    parts.push(text.slice(span.end, cursor))
    parts.push(span.replacement)
    cursor = span.start
  }
  parts.push(text.slice(0, cursor))

  return { text: parts.reverse().join(''), spans, countByKind }
}
