/**
 * Extrahiert ein JSON-Objekt aus einer Modell-Antwort. Reihenfolge:
 *  1. direkter Parse (reines JSON)
 *  2. ```json ... ``` bzw. ``` ... ```-Codefences (so geben es unsere Prompts vor)
 *  3. balancierter Klammern-Scan: erstes '{', dessen passendes '}' ein valides
 *     Objekt ergibt (String-/Escape-aware)
 *
 * Frueher: greedy /\{[\s\S]*\}/ - matchte vom ERSTEN '{' bis zum LETZTEN '}'.
 * Enthielt die Antwort Beispiel-JSON ("z.B. {"x":1}") VOR dem echten Block,
 * wurde alles dazwischen mitgefressen und der Parse schlug fehl.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()

  const direct = tryParseObject(trimmed)
  if (direct) return direct

  // Codefences zuerst (von hinten - die echte Antwort steht meist am Ende)
  const fences = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (let i = fences.length - 1; i >= 0; i--) {
    const obj = tryParseObject(fences[i][1].trim())
    if (obj) return obj
  }

  // Balancierter Scan ueber alle '{'-Startpositionen; das LETZTE gueltige
  // Top-Level-Objekt gewinnt (die echte Antwort steht meist am Ende, davor
  // koennen Beispiel-Objekte in der Prosa stehen).
  let last: Record<string, unknown> | null = null
  let pos = trimmed.indexOf('{')
  while (pos !== -1) {
    const candidate = sliceBalancedObject(trimmed, pos)
    if (candidate) {
      const obj = tryParseObject(candidate)
      if (obj) {
        last = obj
        // Hinter dem gefundenen Objekt weitersuchen, nicht mitten hinein
        pos = trimmed.indexOf('{', pos + candidate.length)
        continue
      }
    }
    pos = trimmed.indexOf('{', pos + 1)
  }

  return last
}

function tryParseObject(text: string): Record<string, unknown> | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Liefert den Teilstring vom '{' bei `start` bis zur passenden schliessenden
 * Klammer (gleiche Verschachtelungstiefe), String-Literale und Escapes
 * korrekt ueberspringend. Null, wenn keine Balance gefunden wird.
 */
function sliceBalancedObject(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
