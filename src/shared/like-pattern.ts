/**
 * Escaping fuer SQL-LIKE-Muster.
 *
 * Eigenes Modul, weil der Backslash hier gleich dreimal durch eine
 * Escaping-Ebene muss (TypeScript-Stringliteral -> SQL-Stringliteral ->
 * LIKE-Muster). Genau dort ist schon einmal ein `ESCAPE ''` entstanden, das
 * SQLite mit "ESCAPE expression must be a single character" quittiert - also
 * lag die gesamte Suche still. Deshalb wird das Zeichen ueber seinen Code
 * gebildet und die Regel hier getestet, statt sie in einem Template-String zu
 * verstecken.
 */

/** Der Backslash als LIKE-Escape-Zeichen. Wird als Parameter gebunden, nicht interpoliert. */
export const LIKE_ESCAPE_CHAR = String.fromCharCode(92)

/**
 * Entschaerft `%`, `_` und den Escape-Backslash selbst, damit eine Suche nach
 * "50%" nicht jedes Dokument trifft. Der Aufrufer setzt die umschliessenden
 * Prozentzeichen selbst.
 */
export function escapeLikePattern(value: string): string {
  let out = ''
  for (const char of value) {
    if (char === '%' || char === '_' || char === LIKE_ESCAPE_CHAR) {
      out += LIKE_ESCAPE_CHAR
    }
    out += char
  }
  return out
}
