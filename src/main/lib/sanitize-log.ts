/**
 * Begrenzt, was der Renderer ueber logs:write ins Logfile schreiben darf.
 *
 * Das Privacy-Versprechen lautet "keine Dokumentinhalte in Logs". Der
 * Renderer schickt aber Fehlertexte und Stacks - und ein Fehlertext kann ein
 * Stueck Dokument enthalten. Ganz verhindern laesst sich das nicht, also wird
 * begrenzt: kurze Texte, flache Objekte, nur Zahlen/Wahrheitswerte/Texte.
 * Lange Zeichenketten (der typische Fall, wenn doch Inhalt hineinrutscht)
 * werden abgeschnitten.
 */

const MAX_KEYS = 12
const MAX_STRING = 300
/** Stacks sind laenger, enthalten aber nur Code-Positionen. */
const MAX_STACK = 2000
const MAX_DEPTH = 2

export const MAX_LOG_MESSAGE = 300
const SOURCE_RE = /^[\w.:-]{1,60}$/

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… [+${value.length - max}]` : value
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (typeof value === 'string') return clip(value, key === 'stack' ? MAX_STACK : MAX_STRING)
  if (typeof value === 'object' && !Array.isArray(value) && depth < MAX_DEPTH) {
    return sanitizeObject(value as Record<string, unknown>, depth + 1)
  }
  // Arrays, Funktionen, tiefe Objekte: weglassen statt ungeprueft schreiben.
  return undefined
}

function sanitizeObject(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).slice(0, MAX_KEYS)) {
    const value = sanitizeValue(key, obj[key], depth)
    if (value !== undefined) out[clip(key, 40)] = value
  }
  return out
}

/** Meta aus dem Renderer: nur ein flaches Objekt, sonst nichts. */
export function sanitizeLogMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  return sanitizeObject(meta as Record<string, unknown>, 1)
}

export function sanitizeLogMessage(message: string): string {
  return clip(message, MAX_LOG_MESSAGE)
}

export function sanitizeLogSource(source: string): string {
  return SOURCE_RE.test(source) ? source : 'renderer'
}
