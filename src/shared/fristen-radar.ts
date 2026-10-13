/**
 * Fristen-Radar - die Rechtsbehelfsbelehrung ohne Modell lesen.
 *
 * Die Fristberechnung war schon immer deterministisch: das Modell liefert nur
 * den Anker, die Dauer kommt aus dem Regelkatalog. Gescheitert ist in der
 * Messung genau dieser Anker - granite4.1:3b fand bei zwei von sechs
 * Bescheiden ueberhaupt keine Frist ("gefunden wurden: keine") und kam auf
 * 42,9 % Trefferquote. Wer sich darauf verlaesst, verpasst seine Klagefrist,
 * und das laesst sich nicht nachholen.
 *
 * Rechtsbehelfsbelehrungen sind stark standardisiert - "innerhalb eines
 * Monats nach Bekanntgabe dieses Bescheides" steht so in unzaehligen
 * Schreiben. Was sich so sicher lesen laesst, gehoert nicht in ein Modell.
 *
 * Die Funde ERSETZEN das Modell nicht, sie ergaenzen es: der Aufrufer fuehrt
 * beide Listen zusammen, Dubletten fallen ueber Art und Enddatum heraus.
 *
 * Grundsatz bleibt: eine erfundene Frist ist schlimmer als eine fehlende.
 * Deshalb wird ein Anker nur gemeldet, wenn Fristdauer UND Fristart UND ein
 * Bezugsdatum zusammenkommen.
 */

import type { DeadlineAnchor, DeadlineKind, DeadlinePeriodUnit } from './types'
import { daysInMonth, toIsoDate } from './german-holidays'
import { sentenceAround } from './sentence'
import { NUMBER_WORD_PATTERN, numberWordValue } from './number-words'

const WS = '[\\s\\u00a0]+'
/** Optionaler Zwischenraum. `${WSO}` waere ein laessiges "ein oder mehr". */
const WSO = '(?:[\\s\\u00a0]+)?'

const UNIT_WORDS: ReadonlyArray<[RegExp, DeadlinePeriodUnit]> = [
  [/^Monat/i, 'month'],
  [/^Woche/i, 'week'],
  [/^Tag/i, 'day'],
  [/^Jahr/i, 'year']
]

const MONTHS: Readonly<Record<string, number>> = {
  januar: 1,
  februar: 2,
  maerz: 3,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12
}

/**
 * Stichwoerter je Fristart. Die Reihenfolge entscheidet: "Klage" steht vor
 * "Widerspruch", weil ein Widerspruchsbescheid beide Woerter enthaelt - dort
 * laeuft aber die Klagefrist.
 */
const KIND_HINTS: ReadonlyArray<[DeadlineKind, RegExp]> = [
  ['klage', /\bKlage\b/i],
  ['einspruch', /\bEinspruch\b/i],
  ['widerspruch', /\bWiderspruch\b/i],
  ['widerruf', /\bWiderruf/i],
  ['kuendigung', /\bK(?:ü|ue)ndig/iu],
  ['zahlung', new RegExp(`(?:zu${WS}zahlen|Zahlung|zahlbar|(?:ü|ue)berweisen)`, 'iu')]
]

const KIND_LABELS: Readonly<Record<string, string>> = {
  klage: 'Klage',
  einspruch: 'Einspruch',
  widerspruch: 'Widerspruch',
  widerruf: 'Widerruf',
  kuendigung: 'Kündigung',
  zahlung: 'Zahlung',
  sonstige: 'Frist'
}

/** "innerhalb eines Monats", "binnen vierzehn Tagen", "innerhalb von 14 Tagen". */
const PERIOD_RE = new RegExp(
  `(?:innerhalb|binnen)${WS}(?:von${WS})?` +
    `(${NUMBER_WORD_PATTERN}|\\d{1,3})${WS}` +
    `(Monat(?:e|en|s)?|Woche(?:n)?|Tag(?:e|en)?|Jahr(?:e|en|es)?)`,
  'giu'
)

/**
 * "26. Februar 2026" oder "26.02.2026" - das Datum des Schreibens. Verankert
 * an Ziffern und Punkten davor/danach, sonst wird aus "Az 126.02.2026" ein
 * 26. Februar.
 */
const DATE_RE = new RegExp(
  `(?<![\\d.])(\\d{1,2})\\.${WSO}(?:(${Object.keys(MONTHS).join('|')})|(\\d{1,2})\\.)${WSO}(\\d{4})(?!\\d)`,
  'giu'
)

/** "bis zum 30. April 2026", "spaetestens am 15.05.2026". */
const EXPLICIT_RE = new RegExp(
  `(?:bis${WS}(?:zum|spätestens|spaetestens)?|sp(?:ä|ae)testens${WS}(?:am|bis${WS}zum))${WSO}` +
    `(\\d{1,2}\\.${WSO}(?:${Object.keys(MONTHS).join('|')}|\\d{1,2}\\.)${WSO}\\d{4})`,
  'giu'
)

function parseUnit(raw: string): DeadlinePeriodUnit | null {
  for (const [re, unit] of UNIT_WORDS) if (re.test(raw)) return unit
  return null
}

function parseCount(raw: string): number | null {
  const word = numberWordValue(raw)
  if (word !== undefined) return word
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Wandelt eine deutsche Datumsangabe in ein ISO-Datum. */
export function parseGermanDate(raw: string): string | null {
  DATE_RE.lastIndex = 0
  const m = DATE_RE.exec(raw)
  if (!m) return null
  const day = Number.parseInt(m[1], 10)
  const month = m[2] ? MONTHS[m[2].toLowerCase()] : Number.parseInt(m[3], 10)
  const year = Number.parseInt(m[4], 10)
  if (!month || month > 12 || year < 1900 || year > 2200) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return toIsoDate(year, month, day)
}

/**
 * Das Datum des Schreibens. Gesucht wird im Kopf des Dokuments: dort steht
 * "Ort, 26. Februar 2026". Weiter hinten stehen Fristen, Geburtsdaten und
 * Aktenzeichen, die als Bezugsdatum nichts taugen.
 */
function documentDate(text: string): DatedReference | null {
  const head = text.slice(0, 1200)
  let fallback: DatedReference | null = null
  DATE_RE.lastIndex = 0
  for (const m of head.matchAll(DATE_RE)) {
    const iso = parseGermanDate(m[0])
    if (!iso) continue
    const index = m.index ?? 0
    const lineStart = head.lastIndexOf('\n', index - 1) + 1
    const lineEnd = head.indexOf('\n', index)
    const before = head.slice(lineStart, index)
    const after = head.slice(index + m[0].length, lineEnd === -1 ? undefined : lineEnd)

    // Geburtsdaten im Briefkopf ("Geburtsdatum: 05.06.1985", "geb. am",
    // "* 05.06.1985") sind kein Fristbeginn - mit ihnen stand eine Frist
    // von 1985 als "abgelaufen" in der Liste.
    if (BIRTH_HINT.test(before.slice(-25))) continue

    const ref = { iso, quote: m[0].trim().replace(/\s+/g, ' '), exact: false }
    // Eindeutig das Datum des Schreibens: eigene Zeile ("Hagen, 26. Februar
    // 2026") oder beschriftet ("Bescheiddatum:", "Datum:"). Nicht "vom" -
    // "Ihr Schreiben vom ..." ist gerade NICHT das Datum dieses Schreibens.
    if (DATE_LINE_PREFIX.test(before) && after.trim() === '') return ref
    if (DATE_LABEL.test(before.slice(-30))) return ref
    fallback ??= ref
  }
  return fallback
}

/** "geb.", "Geburtsdatum", "geboren am" kurz davor - oder ein "*" direkt vor dem Datum. */
const BIRTH_HINT = /(?:\bgeb\b\.?|geburt|geboren)[^\n]*$|\*[\s\u00a0]*$/iu

/** Zeilenanfang vor dem Datum: nichts, "Ort," oder "Ort, den". */
const DATE_LINE_PREFIX = /^[\s\u00a0]*(?:[\p{L} .()/-]{1,40},[\s\u00a0]*)?(?:den[\s\u00a0]+)?$/iu

const DATE_LABEL = /datum[\s\u00a0]*:?[\s\u00a0]*$/iu

interface DatedReference {
  iso: string
  quote: string
  /** Stand das Datum ausdruecklich beim gesuchten Ereignis? */
  exact: boolean
}

/**
 * Worauf sich die Frist bezieht. Steht so in der Rechtsbehelfsbelehrung:
 * "innerhalb eines Monats nach Zustellung".
 */
const REFERENCE_LABELS: ReadonlyArray<[RegExp, string[]]> = [
  [/nach\s+Zustellung|ab\s+Zustellung/iu, ['zugestellt am', 'zustellung am', 'zustellung']],
  [
    /nach\s+Bekanntgabe|ab\s+Bekanntgabe/iu,
    ['bekannt gegeben am', 'bekanntgabe am', 'bekanntgegeben am', 'bekanntgabe']
  ],
  [/nach\s+(?:Zugang|Erhalt)/iu, ['zugegangen am', 'zugang am', 'erhalten am', 'zugang']]
]

/**
 * Sucht ein ausdruecklich beschriftetes Datum, etwa "Zugestellt am:
 * 05.02.2026".
 *
 * Ohne das griff frueher das Bescheiddatum - und das ist regelmaessig zwei
 * bis vier Tage frueher als die Zustellung. Bei einer Zwei-Wochen-Frist
 * haette DoZii damit zwei Tage zu frueh Entwarnung gegeben, und eine falsch
 * berechnete Frist ist schlimmer als gar keine.
 */
function labelledDate(text: string, labels: string[]): DatedReference | null {
  const lower = text.toLowerCase()
  for (const label of labels) {
    let from = 0
    for (;;) {
      const at = lower.indexOf(label, from)
      if (at === -1) break
      const window = text.slice(at, at + label.length + 40)
      const iso = parseGermanDate(window)
      if (iso) {
        return { iso, quote: window.split('\n')[0].trim().replace(/\s+/g, ' '), exact: true }
      }
      from = at + label.length
    }
  }
  return null
}

/**
 * Bezugspunkte, die sich nicht auf ein Datum im Dokument zurueckfuehren
 * lassen, weil sie erst in der Zukunft eintreten.
 *
 * Der Anlass steckte im Bussgeldbescheid: "Der Gesamtbetrag ist innerhalb
 * von zwei Wochen nach Rechtskraft dieses Bescheides zu ueberweisen."
 * Rechtskraft tritt erst ein, wenn die Einspruchsfrist abgelaufen ist -
 * gerechnet ab Bescheiddatum kam eine Zahlungsfrist heraus, die zwei Wochen
 * zu frueh lag. Sie sah voellig plausibel aus, und das macht sie gefaehrlich.
 */
const UNRESOLVABLE_REFERENCE =
  /nach\s+(?:Rechtskraft|Bestandskraft|Eintritt|Ablauf|Beendigung|Abschluss|Erlass|Wirksamwerden)/iu

/** Das Bezugsdatum, das die Fristklausel meint. */
function referenceDate(text: string, sentence: string, fallback: DatedReference | null) {
  for (const [re, labels] of REFERENCE_LABELS) {
    if (!re.test(sentence)) continue
    const found = labelledDate(text, labels)
    if (found) return found
  }
  return fallback
}

function kindOf(sentence: string): DeadlineKind {
  for (const [kind, re] of KIND_HINTS) if (re.test(sentence)) return kind
  return 'sonstige'
}

/**
 * Liest Fristanker aus einem Bescheid.
 *
 * Es wird bewusst nichts geraten: ohne Bezugsdatum und ohne erkennbare
 * Fristart bleibt der Fund liegen, damit das Modell keine erfundene Frist
 * bestaetigt bekommt.
 */
export function findDeadlineAnchors(text: string): DeadlineAnchor[] {
  const anchors: DeadlineAnchor[] = []
  const docDate = documentDate(text)
  const seen = new Set<string>()

  PERIOD_RE.lastIndex = 0
  for (const m of text.matchAll(PERIOD_RE)) {
    const value = parseCount(m[1])
    const unit = parseUnit(m[2])
    if (value === null || unit === null) continue

    const index = m.index ?? 0
    const sentence = sentenceAround(text, index, m[0].length)
    const kind = kindOf(sentence)
    const reference = referenceDate(text, sentence, docDate)

    // Ohne erkennbare Fristart ist der Fund wertlos: "innerhalb von drei
    // Tagen arbeitsuchend melden" ist keine Rechtsbehelfsfrist.
    if (kind === 'sonstige') continue

    // Bezugspunkt liegt in der Zukunft -> nicht berechenbar, also nichts
    // melden. Ein Enddatum im Text bleibt davon unberuehrt.
    const unresolvable = UNRESOLVABLE_REFERENCE.test(sentence)

    EXPLICIT_RE.lastIndex = 0
    const explicitMatch = EXPLICIT_RE.exec(sentence)
    const explicitDueDateIso = explicitMatch ? parseGermanDate(explicitMatch[1]) : null

    // Weder ein Enddatum im Text noch ein brauchbares Bezugsdatum -> nichts
    // zu rechnen.
    if (!explicitDueDateIso && (unresolvable || !reference)) continue

    const key = `${kind}|${value}|${unit}`
    if (seen.has(key)) continue
    seen.add(key)

    anchors.push({
      kind,
      label: KIND_LABELS[kind] ?? KIND_LABELS.sonstige,
      startDateIso: reference?.iso ?? null,
      startDateQuote: reference?.quote ?? null,
      periodText: m[0].trim().replace(/\s+/g, ' '),
      periodValue: value,
      periodUnit: unit,
      explicitDueDateIso,
      quote: sentence,
      /*
       * Hoch nur, wenn das Enddatum im Text steht oder das Bezugsdatum
       * ausdruecklich beim gemeinten Ereignis stand ("Zugestellt am:
       * 05.02.2026"). Musste das Datum des Schreibens herhalten, bleibt es
       * bei mittel: zwischen Bescheiddatum und Zustellung liegen regelmaessig
       * ein paar Tage. Das spaeteste Ende mit Bekanntgabefiktion (+4 Tage)
       * rechnet deadline-calc zusaetzlich aus.
       */
      confidence: explicitDueDateIso || reference?.exact ? 'high' : 'medium'
    })
  }

  for (const anchor of findFixedDateAnchors(text)) {
    if (!anchors.some((a) => a.kind === anchor.kind)) anchors.push(anchor)
  }

  const kschg = findDismissalAnchor(text, docDate)
  if (kschg && !anchors.some((a) => a.kind === 'klage')) anchors.push(kschg)

  return anchors
}

/**
 * Feste Termine ohne Fristdauer: "Der Betrag ist bis zum 30.04.2026 zu
 * ueberweisen." Nur mit "bis zum" / "spaetestens" - ein nacktes "bis" steht
 * auch in "bewilligt vom 01.01. bis 30.06.", und das ist keine Frist fuer
 * den Nutzer. Zahlungen zaehlen nur, wenn der Satz eine Zahlungspflicht
 * ausdrueckt; "Die Zahlung erfolgt bis ..." kuendigt Geld AN den Nutzer an.
 */
const FIXED_DATE_RE = new RegExp(
  `(?:bis${WS}(?:zum|sp(?:ä|ae)testens)|sp(?:ä|ae)testens(?:${WS}(?:am|bis${WS}zum))?)${WS}` +
    `(\\d{1,2}\\.${WSO}(?:${Object.keys(MONTHS).join('|')}|\\d{1,2}\\.)${WSO}\\d{4})`,
  'giu'
)

const PAYMENT_DUTY =
  /zu[\s\u00a0]+(?:zahlen|(?:ü|ue)berweisen|entrichten|begleichen)|zahlbar|(?:ü|ue)berweisen[\s\u00a0]+Sie|begleichen[\s\u00a0]+Sie/iu

function findFixedDateAnchors(text: string): DeadlineAnchor[] {
  const found: DeadlineAnchor[] = []
  FIXED_DATE_RE.lastIndex = 0
  for (const m of text.matchAll(FIXED_DATE_RE)) {
    const due = parseGermanDate(m[1])
    if (!due) continue
    const sentence = sentenceAround(text, m.index ?? 0, m[0].length)
    const kind = kindOf(sentence)
    if (kind === 'sonstige') continue
    if (kind === 'zahlung' && !PAYMENT_DUTY.test(sentence)) continue
    if (found.some((a) => a.kind === kind)) continue
    found.push({
      kind,
      label: KIND_LABELS[kind] ?? KIND_LABELS.sonstige,
      startDateIso: null,
      startDateQuote: null,
      periodText: null,
      periodValue: null,
      periodUnit: null,
      explicitDueDateIso: due,
      quote: sentence,
      confidence: 'high'
    })
  }
  return found
}

/**
 * Kuendigung durch den Arbeitgeber: "hiermit kuendigen wir das mit Ihnen
 * bestehende Arbeitsverhaeltnis ...". Die Frist steht in so einem Schreiben
 * nie - die drei Wochen fuer die Kuendigungsschutzklage (§ 4 KSchG) kommen aus
 * dem Regelkatalog. Gemeldet wird nur, wenn Verb und Arbeitsverhaeltnis im
 * selben Satz stehen.
 */
const DISMISSAL_RE =
  /k(?:ü|ue)ndigen\s+(?:wir|hiermit|Ihnen)\b|wird\s+(?:hiermit\s+)?(?:fristgerecht\s+|fristlos\s+|ordentlich\s+|au(?:ß|ss)erordentlich\s+)*gek(?:ü|ue)ndigt|sprechen\s+(?:wir\s+)?(?:hiermit\s+)?die\s+(?:\S+\s+){0,2}K(?:ü|ue)ndigung/iu
const EMPLOYMENT_RE =
  /Arbeitsverh(?:ä|ae)ltnis|Arbeitsvertrag|Besch(?:ä|ae)ftigungsverh(?:ä|ae)ltnis/iu

function findDismissalAnchor(text: string, docDate: DatedReference | null): DeadlineAnchor | null {
  if (!docDate) return null
  DISMISSAL_RE.lastIndex = 0
  const m = DISMISSAL_RE.exec(text)
  if (!m) return null
  const sentence = sentenceAround(text, m.index, m[0].length)
  if (!EMPLOYMENT_RE.test(sentence)) return null
  const reference = referenceDate(text, 'nach Zugang', docDate)
  return {
    kind: 'klage',
    label: 'Kündigungsschutzklage',
    startDateIso: reference?.iso ?? null,
    startDateQuote: reference?.quote ?? null,
    periodText: null,
    // Bewusst leer: die Dauer steht nicht im Schreiben, der Regelkatalog
    // liefert sie samt Fundstelle und Hinweis.
    periodValue: null,
    periodUnit: null,
    explicitDueDateIso: null,
    quote: sentence,
    confidence: 'medium'
  }
}
