/**
 * Satzgrenzen in deutschen Behoerdentexten.
 *
 * Klingt trivial, ist es nicht: ein Punkt steht in "30.03.2026", in "§ 551
 * Abs. 1 BGB", in "z.B." und in "Nr. 9". Wer stumpf am naechsten Punkt
 * trennt, schneidet dem Nutzer den Beleg mitten im Datum ab - genau das ist
 * beim Fristen-Radar passiert: aus "spaetestens am 30.03.2026" wurde
 * "spaetestens am 30." und das Enddatum war weg.
 *
 * Deshalb gilt ein Punkt nur dann als Satzende, wenn danach Zwischenraum und
 * ein Grossbuchstabe folgen und davor keine Ziffer und keine gaengige
 * Abkuerzung steht. Ein Zeilenumbruch beendet den Satz ebenfalls - Bescheide
 * sind voller Absaetze ohne Schlusspunkt.
 */

/** Abkuerzungen, nach denen kein Satz endet. */
const ABBREVIATIONS = [
  'abs',
  'art',
  'nr',
  'ziff',
  'bzw',
  'ca',
  'evtl',
  'ggf',
  'inkl',
  'lt',
  'max',
  'min',
  'sog',
  'usw',
  'vgl',
  'z',
  'b',
  'd',
  'h',
  'dr',
  'str',
  'tel',
  'ggfs'
]

/** Endet an dieser Stelle wirklich ein Satz? */
function isSentenceEnd(text: string, pos: number): boolean {
  const char = text[pos]
  if (char === '\n') {
    // Nur eine LEERZEILE trennt. Aus einem PDF kommt der Text mit Umbruch
    // mitten im Satz - wer daran trennt, schneidet jeden zweiten Beleg ab.
    return /^\n[ \t\u00a0]*\n/.test(text.slice(pos, pos + 32))
  }
  if (char !== '.' && char !== '!' && char !== '?') return false

  if (char === '.') {
    // "30.03.2026" - eine Ziffer davor und danach.
    if (/\d/.test(text[pos - 1] ?? '') && /\d/.test(text[pos + 1] ?? '')) return false
    // "am 30. Maerz" - Ziffer davor, Zwischenraum, dann weiter im Satz.
    if (/\d/.test(text[pos - 1] ?? '')) return false
    // "Abs. 1", "Nr. 9", "z. B."
    const word = /([A-Za-zÄÖÜäöüß]+)$/.exec(text.slice(Math.max(0, pos - 12), pos))?.[1]
    if (word && ABBREVIATIONS.includes(word.toLowerCase())) return false
  }

  // Danach Zwischenraum und ein Grossbuchstabe - oder Textende.
  const rest = text.slice(pos + 1, pos + 4)
  if (rest.trim() === '') return true
  return /^[\s\u00a0]+["„'(]?[A-ZÄÖÜ0-9]/.test(rest) || /^[\s\u00a0]*$/.test(rest)
}

/**
 * Liefert den Satz, in dem eine Fundstelle liegt.
 *
 * Ein nackter Treffer wie "vier Nettokaltmieten" ist als Beleg zu duenn -
 * man muss sehen, worauf er sich bezieht.
 */
export function sentenceAround(text: string, index: number, length: number): string {
  let start = 0
  for (let i = index - 1; i >= 0; i--) {
    if (isSentenceEnd(text, i)) {
      start = i + 1
      break
    }
  }

  let end = text.length
  for (let i = index + length; i < text.length; i++) {
    if (isSentenceEnd(text, i)) {
      end = text[i] === '\n' ? i : i + 1
      break
    }
  }

  return text
    .slice(start, end)
    .trim()
    .replace(/[\s\u00a0]+/g, ' ')
}
