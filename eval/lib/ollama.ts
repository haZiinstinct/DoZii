/**
 * Schlanker Ollama-Client fuer die Eval-Laeufe.
 *
 * Bewusst KEIN Import aus src/main/services/ollama-client.service.ts: der haengt
 * an Electron (BrowserWindow) und am electron-store-Settings-Service und liesse
 * sich ausserhalb der App gar nicht laden. Hier reicht ein non-streaming
 * `/api/chat` per fetch.
 *
 * Alles, was schiefgehen kann, endet in einem sauberen "nicht verfuegbar" -
 * ein Eval-Lauf ohne Ollama wird uebersprungen, nicht rot.
 */

import { stripThinking } from '../../src/shared/strip-thinking'

/** Modell fuer die Evals. Ueberschreibbar, um Prompt-Aenderungen gegen mehrere Modelle zu messen. */
export const EVAL_MODEL = process.env.DOZII_EVAL_MODEL || 'qwen2.5:7b'

/** Ollama-Endpunkt ohne Slash am Ende. */
export const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '')

/** Wie lange auf `/api/tags` gewartet wird, bevor Ollama als "nicht da" gilt. */
const PROBE_TIMEOUT_MS = 3_000

/** Obergrenze fuer eine einzelne Analyse - darunter liegt das Vitest-Timeout. */
const CHAT_TIMEOUT_MS = 9 * 60 * 1000

export interface ChatOptions {
  /** Ollama-Temperatur. Die App fuehrt die Analyse-Modi mit 0.1-0.3. */
  temperature?: number
  /** num_ctx. Der Default der App (DEFAULT_NUM_CTX) ist 8192. */
  numCtx?: number
  /** Ueberschreibt EVAL_MODEL fuer einen einzelnen Aufruf. */
  model?: string
  timeoutMs?: number
}

export interface ChatResult {
  /** Antworttext des Modells (message.content), getrimmt. */
  content: string
  /** Wanduhr-Dauer des Aufrufs in Millisekunden. */
  durationMs: number
}

/** Ergebnis der Vorpruefung: laeuft Ollama und liegt das Modell vor? */
export interface EvalGate {
  ready: boolean
  /** Klartext-Begruendung, wird bei ready=false in die Konsole geschrieben. */
  reason: string
}

interface TagsResponse {
  models?: Array<{ name?: unknown; model?: unknown }>
}

interface ChatResponse {
  message?: { content?: unknown }
}

/** 'qwen2.5:7b' und 'qwen2.5:7b:latest' sollen als dasselbe Modell gelten. */
function normalizeModelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/:latest$/, '')
}

async function getJson<T>(path: string, timeoutMs: number): Promise<T | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}${path}`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // Verbindung verweigert, DNS-Fehler, Timeout - fuer uns alles dasselbe.
    return null
  }
}

/** Antwortet Ollama unter OLLAMA_URL? */
export async function isOllamaAvailable(): Promise<boolean> {
  return (await getJson<TagsResponse>('/api/tags', PROBE_TIMEOUT_MS)) !== null
}

/** Alle lokal installierten Modelle. Leere Liste, wenn Ollama nicht antwortet. */
export async function listModels(): Promise<string[]> {
  const tags = await getJson<TagsResponse>('/api/tags', PROBE_TIMEOUT_MS)
  if (!tags || !Array.isArray(tags.models)) return []
  const names: string[] = []
  for (const entry of tags.models) {
    const name = typeof entry.name === 'string' ? entry.name : entry.model
    if (typeof name === 'string' && name.trim()) names.push(name.trim())
  }
  return names
}

/** Ist das Modell lokal vorhanden? */
export async function hasModel(name: string): Promise<boolean> {
  const wanted = normalizeModelName(name)
  const installed = await listModels()
  return installed.some((entry) => normalizeModelName(entry) === wanted)
}

/**
 * Ein Analyse-Durchlauf: System- und User-Prompt rein, Antworttext raus.
 * Wirft bei HTTP-Fehlern - ein kaputter Aufruf mitten im Lauf soll auffallen,
 * die Verfuegbarkeitspruefung passiert vorher in `checkEvalPreconditions`.
 */
export async function chat(
  system: string,
  user: string,
  options: ChatOptions = {}
): Promise<ChatResult> {
  const body = {
    model: options.model ?? EVAL_MODEL,
    stream: false,
    think: false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    options: {
      temperature: options.temperature ?? 0.15,
      num_ctx: options.numCtx ?? 8192
    }
  }

  const startedAt = Date.now()
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? CHAT_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error(`Ollama antwortete mit HTTP ${response.status} auf /api/chat`)
  }

  const payload = (await response.json()) as ChatResponse
  const raw = typeof payload.message?.content === 'string' ? payload.message.content : ''
  // Denkmodell? Der Gedankengang gehoert nicht in die Auswertung.
  return { content: stripThinking(raw), durationMs: Date.now() - startedAt }
}

/**
 * Vorpruefung fuer einen ganzen Eval-Lauf. Ist etwas nicht da, wird die Suite
 * uebersprungen statt rot - ein fehlendes Ollama ist kein Prompt-Fehler.
 */
export async function checkEvalPreconditions(): Promise<EvalGate> {
  const installed = await listModels()
  if (installed.length === 0) {
    const available = await isOllamaAvailable()
    if (!available) {
      return {
        ready: false,
        reason: `Kein Ollama unter ${OLLAMA_URL} erreichbar. Starte Ollama oder setze OLLAMA_URL.`
      }
    }
    return {
      ready: false,
      reason: `Ollama laeuft unter ${OLLAMA_URL}, hat aber kein einziges Modell. Hol dir eins mit "ollama pull ${EVAL_MODEL}".`
    }
  }

  const wanted = normalizeModelName(EVAL_MODEL)
  if (!installed.some((entry) => normalizeModelName(entry) === wanted)) {
    return {
      ready: false,
      reason: `Modell "${EVAL_MODEL}" fehlt. Vorhanden: ${installed.join(', ')}. Hol es mit "ollama pull ${EVAL_MODEL}" oder setze DOZII_EVAL_MODEL.`
    }
  }

  return { ready: true, reason: '' }
}

/** Einheitliche Konsolenmeldung, wenn eine Eval-Suite uebersprungen wird. */
export function reportSkip(suite: string, reason: string): void {
  console.warn(`\n[eval] ${suite} uebersprungen: ${reason}\n`)
}
