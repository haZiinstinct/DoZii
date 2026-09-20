import { logger } from './logger.service'

/**
 * Ermittelt das Kontextfenster eines Ollama-Modells (fuer die num_ctx-Automatik,
 * siehe @shared/context-window-calc).
 *
 * Die show-Funktion wird INJIZIERT statt hier einen eigenen Ollama-Client zu
 * bauen: ollama-client.service haelt bereits eine Singleton-Instanz, und eine
 * zweite waere doppelte Verbindung plus doppelter Abort-Zustand. Aufrufer
 * uebergeben schlicht `(m) => ollama.show({ model: m })`.
 */

/** Signatur von ollama.show, bewusst unknown - wir parsen defensiv. */
export type ShowFn = (model: string) => Promise<unknown>

/**
 * Cache pro Modellname. Ein Modell aendert sein Kontextfenster nicht, und
 * show() kostet bei grossen Modelfiles spuerbar Zeit. Gecacht wird nur ein
 * abgeschlossenes Ergebnis (inkl. "nichts gefunden"), nicht ein Fehler -
 * sonst haengt ein kurz nicht erreichbares Ollama dauerhaft auf null.
 */
const cache = new Map<string, number | null>()

/** Map oder Plain-Object: das SDK typisiert model_info als Map, JSON liefert ein Objekt. */
function toEntries(value: unknown): [string, unknown][] {
  if (value instanceof Map) return [...value.entries()]
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>)
  return []
}

function toPositiveInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.floor(num)
}

/**
 * Der Schluessel heisst je nach Architektur anders (llama.context_length,
 * qwen2.context_length, gemma3.context_length ...) - deshalb generisch der
 * erste Schluessel mit passender Endung.
 */
function fromModelInfo(modelInfo: unknown): number | null {
  for (const [key, value] of toEntries(modelInfo)) {
    if (!key.endsWith('.context_length')) continue
    const num = toPositiveInt(value)
    if (num !== null) return num
  }
  return null
}

/** Fallback: im parameters-Block kann ein explizit gesetztes num_ctx stehen. */
function fromParameters(parameters: unknown): number | null {
  if (typeof parameters !== 'string') return null
  const match = /^\s*num_ctx\s+(\d+)/m.exec(parameters)
  return match ? toPositiveInt(match[1]) : null
}

/**
 * Kontextfenster des Modells in Tokens, oder null wenn unbekannt/nicht
 * ermittelbar. Wirft nie - der Aufrufer faellt bei null auf MIN_NUM_CTX zurueck.
 */
export async function getModelContextLimit(model: string, show: ShowFn): Promise<number | null> {
  const cached = cache.get(model)
  if (cached !== undefined) return cached

  try {
    const response = await show(model)
    const info =
      response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
    const limit = fromModelInfo(info.model_info) ?? fromParameters(info.parameters)

    if (limit === null) {
      logger.warn('context-window', 'Kein Kontextfenster im show-Response gefunden', { model })
    } else {
      logger.info('context-window', 'Kontextfenster ermittelt', { model, limit })
    }
    cache.set(model, limit)
    return limit
  } catch (err) {
    logger.warn('context-window', 'show fehlgeschlagen - Kontextfenster unbekannt', {
      model,
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}
