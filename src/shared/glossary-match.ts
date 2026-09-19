/**
 * Findet Glossar-Begriffe in einem Text - rein lokal, ohne Modell.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 *
 * Regeln (bewusst eng, damit der Text nicht zur Tooltip-Wueste wird):
 * - Gross-/Kleinschreibung egal, Umlaute und ss/ß in beiden Schreibweisen
 *   ("Saeumniszuschlag" findet "Säumniszuschlag" und umgekehrt).
 * - Nur an Wortgrenzen. Ein Begriff wird NICHT innerhalb eines laengeren
 *   Wortes markiert: "Widerspruchsbehandlungsverfahren" ergibt keinen Treffer,
 *   weil weder das ganze Wort noch eine erlaubte Beugungsform davon im Glossar
 *   steht. Erlaubt ist nur eine regelmaessige Endung (-e/-en/-es/-er/-em/-n/-s),
 *   also findet "Widerspruchs" den Begriff "Widerspruch", "Widerspruchsfrist"
 *   dagegen den eigenen Eintrag "Widerspruchsfrist".
 * - Laengster Treffer gewinnt: "Widerspruch gegen den Mahnbescheid" ist EIN
 *   Treffer, nicht drei.
 * - Keine ueberlappenden Treffer, aufsteigend nach `start` sortiert.
 *
 * Performance: der Text wird EINMAL normalisiert und in Woerter zerlegt, die
 * Begriffe liegen in einem vorgebauten Index nach erstem Wort. Kein Durchlauf
 * pro Begriff - bei 100k Zeichen bleibt das im einstelligen Millisekundenbereich.
 */

import { GLOSSARY, foldChar, type GlossaryEntry } from './glossary'

export interface GlossaryMatch {
  /** Offset im ORIGINALTEXT (nicht im normalisierten Text). */
  start: number
  /** Exklusives Ende im Originaltext - text.slice(start, end) ist die Fundstelle. */
  end: number
  entry: GlossaryEntry
}

export interface FindGlossaryMatchesOptions {
  /** Obergrenze fuer die Trefferzahl. Default: unbegrenzt. */
  maxMatches?: number
  /** Jeden Begriff nur beim ERSTEN Vorkommen markieren. Default: true. */
  uniqueTerms?: boolean
}

/**
 * Regelmaessige Beugungsendungen, die ein Wort im Text zusaetzlich tragen darf.
 * Laengere zuerst ist hier egal - geprueft wird auf exakte Gleichheit des Rests.
 */
const INFLECTION_SUFFIXES = ['en', 'es', 'er', 'em', 'e', 'n', 's']

/** Ein Wort: Buchstaben, Ziffern, Unterstrich. */
const WORD_RE = /[\p{L}\p{N}_]+/gu

/**
 * Was zwischen zwei Woertern eines mehrteiligen Begriffs stehen darf.
 * Leerraum und Bindestriche - damit "Kosten der\nUnterkunft" ueber einen
 * Zeilenumbruch hinweg trifft und "P-Konto" als ein Begriff gilt.
 */
const SEPARATOR_RE = /^[\s‐-―-]+$/

interface NormalizedText {
  /** Gefalteter Text (kleingeschrieben, Umlaute aufgeloest). */
  norm: string
  /** Pro Zeichen in `norm` der Index des Quellzeichens im Originaltext. */
  origIndex: number[]
}

/**
 * Faltet den Text und merkt sich fuer jedes erzeugte Zeichen, aus welchem
 * Originalzeichen es stammt. Noetig, weil 'ä' zu zwei Zeichen wird und die
 * Offsets sonst verrutschen.
 */
function normalizeWithMap(text: string): NormalizedText {
  const parts: string[] = []
  const origIndex: number[] = []
  for (let i = 0; i < text.length; i++) {
    const folded = foldChar(text[i])
    parts.push(folded)
    for (let k = 0; k < folded.length; k++) origIndex.push(i)
  }
  return { norm: parts.join(''), origIndex }
}

interface Token {
  text: string
  /** Offsets im normalisierten Text. */
  start: number
  end: number
}

function tokenize(norm: string): Token[] {
  const tokens: Token[] = []
  WORD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_RE.exec(norm)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

/** Zerlegt einen Begriff in gefaltete Woerter ("P-Konto" -> ['p', 'konto']). */
function splitWords(value: string): string[] {
  let folded = ''
  for (const ch of value) folded += foldChar(ch)
  return folded.match(WORD_RE) ?? []
}

interface Candidate {
  words: string[]
  entry: GlossaryEntry
}

let candidateIndex: Map<string, Candidate[]> | null = null

/**
 * Index nach erstem Wort. Jeder Eimer ist nach Wortzahl absteigend sortiert,
 * damit der laengste Begriff zuerst geprueft wird.
 */
function getCandidateIndex(): Map<string, Candidate[]> {
  if (candidateIndex) return candidateIndex
  const index = new Map<string, Candidate[]>()
  for (const entry of GLOSSARY) {
    for (const variant of [entry.term, ...(entry.aliases ?? [])]) {
      const words = splitWords(variant)
      if (words.length === 0) continue
      const bucket = index.get(words[0])
      if (bucket) bucket.push({ words, entry })
      else index.set(words[0], [{ words, entry }])
    }
  }
  for (const bucket of index.values()) bucket.sort((a, b) => b.words.length - a.words.length)
  candidateIndex = index
  return index
}

/** Passt `token` auf `key` - exakt oder mit einer regelmaessigen Endung. */
function wordMatches(token: string, key: string): boolean {
  if (token === key) return true
  if (token.length <= key.length || !token.startsWith(key)) return false
  return INFLECTION_SUFFIXES.includes(token.slice(key.length))
}

/** Moegliche Grundformen eines Wortes - nur als billiger Vorfilter fuer den Index. */
function baseForms(token: string): string[] {
  const forms = [token]
  for (const suffix of INFLECTION_SUFFIXES) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      forms.push(token.slice(0, token.length - suffix.length))
    }
  }
  return forms
}

function matchesAt(tokens: Token[], i: number, norm: string, words: string[]): boolean {
  if (i + words.length > tokens.length) return false
  for (let k = 0; k < words.length; k++) {
    if (!wordMatches(tokens[i + k].text, words[k])) return false
    if (k > 0 && !SEPARATOR_RE.test(norm.slice(tokens[i + k - 1].end, tokens[i + k].start))) {
      return false
    }
  }
  return true
}

function findBestCandidate(
  tokens: Token[],
  i: number,
  norm: string,
  index: Map<string, Candidate[]>
): Candidate | undefined {
  let best: Candidate | undefined
  for (const base of baseForms(tokens[i].text)) {
    const bucket = index.get(base)
    if (!bucket) continue
    for (const candidate of bucket) {
      // Eimer ist absteigend sortiert - ab hier kann nichts mehr laenger werden.
      if (best && candidate.words.length <= best.words.length) break
      if (matchesAt(tokens, i, norm, candidate.words)) {
        best = candidate
        break
      }
    }
  }
  return best
}

/**
 * Sucht alle Glossar-Begriffe im Text. Ergebnis ist ueberschneidungsfrei und
 * nach `start` aufsteigend sortiert.
 */
export function findGlossaryMatches(
  text: string,
  options: FindGlossaryMatchesOptions = {}
): GlossaryMatch[] {
  const maxMatches = options.maxMatches ?? Number.POSITIVE_INFINITY
  const uniqueTerms = options.uniqueTerms ?? true
  if (text.length === 0 || maxMatches <= 0) return []

  const { norm, origIndex } = normalizeWithMap(text)
  const tokens = tokenize(norm)
  const index = getCandidateIndex()

  const matches: GlossaryMatch[] = []
  const seen = new Set<string>()
  let i = 0
  while (i < tokens.length && matches.length < maxMatches) {
    const best = findBestCandidate(tokens, i, norm, index)
    if (!best) {
      i++
      continue
    }
    // Auch ein uebersprungener Wiederholungstreffer verbraucht seine Woerter,
    // sonst wuerde im selben Wort ein kuerzerer Begriff nachrutschen.
    if (!uniqueTerms || !seen.has(best.entry.term)) {
      seen.add(best.entry.term)
      const last = tokens[i + best.words.length - 1]
      matches.push({
        start: origIndex[tokens[i].start],
        end: last.end < norm.length ? origIndex[last.end] : text.length,
        entry: best.entry
      })
    }
    i += best.words.length
  }
  return matches
}
