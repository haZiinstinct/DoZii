/**
 * Findet die JSON-Kandidaten in einer Modellantwort.
 *
 * Die Prompts verlangen einen ```json-Block, und die meisten Modelle liefern
 * ihn auch. qwen3:4b nicht: es schreibt das JSON nackt hin. Ergebnis war ein
 * Totalausfall bei allen sieben Zeugnissen - das Modell hatte gut 5000 Token
 * lang die richtige Antwort geschrieben, und der Parser hat sie weggeworfen,
 * weil die drei Backticks fehlten.
 *
 * Reihenfolge: eingezaeunte Bloecke zuerst, von hinten nach vorne, weil die
 * echte Antwort am Ende steht und weiter oben Beispiele im Prompt-Echo
 * stehen koennen. Erst danach der nackte Fall.
 */

/** Die aeusserste geklammerte Struktur ab `start`, oder null. */
function balancedObjectAt(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      // Nur innerhalb einer Zeichenkette hat der Backslash Bedeutung.
      if (inString) escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Alle plausiblen JSON-Objekte aus einer Antwort, in der Reihenfolge, in der
 * sie geprueft werden sollen.
 */
export function jsonCandidates(text: string): string[] {
  const candidates: string[] = []

  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (let i = fenced.length - 1; i >= 0; i--) {
    const body = fenced[i][1].trim()
    if (body.startsWith('{')) candidates.push(body)
  }

  // Nackte Objekte - von hinten, aus demselben Grund.
  const starts: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') starts.push(i)
  }
  for (let i = starts.length - 1; i >= 0; i--) {
    const body = balancedObjectAt(text, starts[i])
    if (body && body.length > 2 && !candidates.includes(body)) candidates.push(body)
  }

  return candidates
}

/**
 * Erstes JSON-Objekt, das sich parsen laesst UND die Pruefung besteht.
 *
 * Die Pruefung ist noetig, weil Modelle gern Beispiel-JSON aus dem Prompt
 * mitzitieren - ohne sie nimmt der Parser das Beispiel statt der Antwort.
 */
export function findJson<T extends Record<string, unknown>>(
  text: string,
  isValid: (candidate: Record<string, unknown>) => boolean
): T | null {
  for (const raw of jsonCandidates(text)) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && isValid(parsed)) return parsed as T
    } catch {
      // Kein gueltiges JSON - naechster Kandidat.
    }
  }
  return null
}
