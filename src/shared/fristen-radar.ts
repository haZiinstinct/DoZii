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
import { toIsoDate } from './german-holidays'
import { sentenceAround } from './sentence'

const WS = '[\\s\\u00a0]+'
/** Optionaler Zwischenraum. `${WSO}` waere ein laessiges "ein oder mehr". */
const WSO = '(?:[\\s\\u00a0]+)?'

const UNIT_WORDS: ReadonlyArray<[RegExp, DeadlinePeriodUnit]> = [
  [/^Monat/i, 'month'],
  [/^Woche/i, 'week'],
  [/^Tag/i, 'day'],
  [/^Jahr/i, 'year']
]

const COUNT_WORDS: Readonly<Record<string, number>> = {
  einem: 1,
  eines: 1,
  einer: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  sechs: 6,
  zwoelf: 12,
  zwölf: 12
}

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
  ['zahlung', new RegExp(`(?:zu${WS}zahlen|Zahlung|zahlbar|(?:ü|ue)berweisen)`, 'iu')]
]

const KIND_LABELS: Readonly<Record<string, string>> = {
  klage: 'Klage',
  einspruch: 'Einspruch',
  widerspruch: 'Widerspruch',
  zahlung: 'Zahlung',
  sonstige: 'Frist'
}

/** "innerhalb eines Monats", "binnen zwei Wochen", "innerhalb von 14 Tagen". */
const PERIOD_RE = new RegExp(
  `(?:innerhalb|binnen)${WS}(?:von${WS})?` +
    `(${Object.keys(COUNT_WORDS).join('|')}|\\d{1,3})${WS}` +
    `(Monat(?:e|en|s)?|Woche(?:n)?|Tag(?:e|en)?|Jahr(?:e|en|es)?)`,
  'giu'
)

/** "26. Februar 2026" oder "26.02.2026" - das Datum des Schreibens. */
const DATE_RE = new RegExp(
  `(\\d{1,2})\\.${WSO}(?:(${Object.keys(MONTHS).join('|')})|(\\d{1,2})\\.)${WSO}(\\d{4})`,
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
  const word = COUNT_WORDS[raw.toLowerCase()]
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
  if (!month || day < 1 || day > 31 || year < 1900 || year > 2200) return null
  return toIsoDate(year, month, day)
}

/**
 * Das Datum des Schreibens. Gesucht wird im Kopf des Dokuments: dort steht
 * "Ort, 26. Februar 2026". Weiter hinten stehen Fristen, Geburtsdaten und
 * Aktenzeichen, die als Bezugsdatum nichts taugen.
 */
function documentDate(text: string): DatedReference | null {
  const head = text.slice(0, 1200)
  DATE_RE.lastIndex = 0
  for (const m of head.matchAll(DATE_RE)) {
    const iso = parseGermanDate(m[0])
    if (iso) return { iso, quote: m[0].trim().replace(/\s+/g, ' '), exact: false }
  }
  return null
}

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
       * ein paar Tage, und die Drei-Tage-Fiktion des Paragrafen 41 VwVfG
       * bildet DoZii bewusst nicht ab.
       */
      confidence: explicitDueDateIso || reference?.exact ? 'high' : 'medium'
    })
  }

  return anchors
}
