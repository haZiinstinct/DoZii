import { Ollama, type Message } from 'ollama'
import { BrowserWindow, net } from 'electron'
import { logger } from './logger.service'
import { stripThinking } from '@shared/strip-thinking'
import { getSettings } from './settings.service'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

let client: Ollama | null = null
/** Host, mit dem `client` erzeugt wurde - aendert der Nutzer die URL, wird neu verbunden. */
let clientHost = ''

/**
 * Die in den Einstellungen hinterlegte Ollama-URL. Frueher war der Host hier
 * hart verdrahtet, waehrend `settings.ollamaUrl` ungenutzt herumlag - wer die
 * Einstellung aenderte, hat nichts gemerkt.
 */
export function getOllamaUrl(): string {
  try {
    return getSettings().ollamaUrl || DEFAULT_OLLAMA_URL
  } catch {
    // Settings noch nicht initialisiert (sehr frueher Start) - Default nehmen.
    return DEFAULT_OLLAMA_URL
  }
}

/**
 * Electrons Netzwerk-Stack statt Nodes eingebautem fetch.
 *
 * Node bricht eine Anfrage ab, wenn nach fuenf Minuten keine Antwortkopf-
 * zeilen da sind (UND_ERR_HEADERS_TIMEOUT). Ollama sendet die aber erst,
 * wenn das Modell geladen UND der Prompt verarbeitet ist - und genau das
 * dauert auf einem Rechner ohne Grafikkarte laenger: gemessen kam bei einem
 * Arbeitszeugnis (5300 Prompt-Tokens, Kontext 12288) nach 300 Sekunden noch
 * keine einzige Kopfzeile.
 *
 * Streamen allein reicht dagegen nicht, weil das Limit VOR dem ersten Token
 * greift. Der Zeugnis-Modus war damit auf reinen CPU-Rechnern nicht bloss
 * langsam, sondern unbenutzbar - auf einer Grafikkarte faellt es nie auf,
 * weil dort nach wenigen Sekunden Tokens fliessen.
 *
 * net.fetch aus Electron kennt dieses Zeitlimit nicht und braucht keine
 * zusaetzliche Abhaengigkeit. Es steht erst nach app.whenReady bereit -
 * der Client wird ohnehin erst beim ersten Gebrauch gebaut.
 *
 * Dass die ollama-Bibliothek mit net.fetch ueberhaupt zurechtkommt, laesst
 * sich aus Vitest heraus NICHT pruefen - net.fetch gibt es nur innerhalb
 * von Electron. Deshalb scripts/netfetch-probe.cjs: startet ein echtes
 * Electron ohne Fenster und macht beide Aufrufarten, die hier vorkommen.
 * Nachgewiesen fuer 1.3.8 - list() liefert, chat({stream:true}) liefert 40
 * Stuecke in 5 s. Wer an dieser Zeile etwas aendert, sollte es erneut
 * laufen lassen, denn dieser Aufruf haengt an allen elf Aufrufstellen: faellt
 * er aus, ist nicht der CPU-Pfad kaputt, sondern die ganze App.
 */
function getClient(): Ollama {
  const host = getOllamaUrl()
  if (!client || clientHost !== host) {
    client = new Ollama({ host, fetch: net.fetch as unknown as typeof fetch })
    clientHost = host
    logger.info('ollama-client', 'Ollama-Client verbunden', { host })
  }
  return client
}

/**
 * Abort all currently active Ollama streams (chat + pull).
 * Used when the user clicks "Stop" during an analysis or chat.
 */
export function abortAllStreams(): void {
  if (client) {
    logger.info('ollama-client', 'Aborting all active streams')
    client.abort()
  }
}

// ============================================================================
// Active stream counter - used by the Hardware Indicator to show "active" state
// ============================================================================

let activeStreamCount = 0

export function getActiveStreamCount(): number {
  return activeStreamCount
}

function incrementActiveStreams(): void {
  activeStreamCount++
}

function decrementActiveStreams(): void {
  activeStreamCount = Math.max(0, activeStreamCount - 1)
}

/**
 * Check whether an error is an AbortError caused by the user stopping the stream.
 * Exportiert, weil auch der Chunking-Pfad in analysis.service den Abbruch vom
 * echten Fehler unterscheiden muss.
 */
export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.name === 'AbortError' ||
    err.message.includes('abort') ||
    err.message.includes('aborted') ||
    err.message.includes('The operation was aborted')
  )
}

/**
 * Check whether an error is a transient fetch / socket failure that
 * might succeed on retry. Distinct from AbortError (user-initiated).
 */
function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return /fetch failed|socket hang up|ECONNRESET|UND_ERR_SOCKET|UND_ERR_CLOSED|network error/i.test(
    err.message
  )
}

/**
 * Extract undici's hidden cause chain for better error diagnostics.
 * Node's fetch wraps the real TCP/socket error in err.cause.
 */
function extractErrorMeta(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { error: String(err) }
  const meta: Record<string, unknown> = {
    error: err.message,
    name: err.name,
    stack: err.stack
  }
  if ('cause' in err && err.cause !== undefined) {
    const cause = (err as { cause: unknown }).cause
    if (cause instanceof Error) {
      meta.cause = {
        message: cause.message,
        name: cause.name,
        code: (cause as NodeJS.ErrnoException).code
      }
    } else {
      meta.cause = String(cause)
    }
  }
  return meta
}

export async function checkOllamaStatus(): Promise<{ connected: boolean; error?: string }> {
  try {
    const ollama = getClient()
    await ollama.list()
    return { connected: true }
  } catch (err) {
    logger.debug('ollama-client', 'Ollama unreachable', {
      error: err instanceof Error ? err.message : String(err)
    })
    return { connected: false, error: `Ollama nicht erreichbar unter ${getOllamaUrl()}` }
  }
}

/**
 * Rohes `show`-Ergebnis fuer ein Modell (Metadaten inkl. Kontextfenster).
 * Wird von context-window.service injiziert bekommen, damit dort keine
 * zweite Client-Instanz entsteht.
 */
export async function showModel(model: string): Promise<unknown> {
  const ollama = getClient()
  return ollama.show({ model })
}

/**
 * Ein Durchlauf ohne Streaming - fuer kurze Hilfs-Aufrufe (Fristen-Extraktion,
 * Chunk-Zusammenfassung), deren Zwischenergebnis der Nutzer nicht sehen soll.
 * Wirft bei Fehlern; der Aufrufer entscheidet, ob das fatal ist.
 */
export async function chatOnce(options: {
  model: string
  system: string
  prompt: string
  temperature?: number
  numCtx?: number
}): Promise<string> {
  const ollama = getClient()
  const modelOptions: Record<string, number> = {}
  if (options.temperature !== undefined) modelOptions.temperature = options.temperature
  if (options.numCtx !== undefined) modelOptions.num_ctx = options.numCtx

  incrementActiveStreams()
  try {
    /*
     * Gestreamt, obwohl der Aufrufer nur den fertigen Text will: so laeuft
     * die Antwort nicht in ein Zeitlimit zwischen zwei Datenpaketen.
     *
     * Das eigentliche Problem auf Rechnern ohne Grafikkarte loest das aber
     * NICHT - Ollama schickt die Antwortkopfzeilen erst, wenn Modell und
     * Prompt durch sind, und das dauert dort laenger als Nodes fuenf
     * Minuten. Dagegen hilft nur der Netzwerk-Stack von Electron; siehe
     * getClient().
     */
    const stream = await withTransientRetry('chatOnce', () =>
      ollama.chat({
        model: options.model,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.prompt }
        ],
        stream: true,
        think: false,
        options: modelOptions
      })
    )
    const parts: string[] = []
    for await (const chunk of stream) {
      const text = chunk.message?.content
      if (text) parts.push(text)
    }
    return stripThinking(parts.join(''))
  } finally {
    decrementActiveStreams()
  }
}

export async function listModels(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
  try {
    const ollama = getClient()
    const response = await ollama.list()
    return response.models.map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at?.toString() ?? ''
    }))
  } catch (err) {
    logger.warn('ollama-client', 'listModels failed', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

// ============================================================================
// Loaded models (runtime info for Hardware Indicator)
// ============================================================================

export interface LoadedModelRaw {
  name: string
  size: number
  sizeVram: number
  expiresAt: string
}

/**
 * Query Ollama's /api/ps endpoint for currently loaded models.
 * Returns empty array on failure (non-critical - UI just shows "waiting").
 */
export async function listLoadedModels(): Promise<LoadedModelRaw[]> {
  try {
    const ollama = getClient()
    const response = await ollama.ps()
    return response.models.map((m) => ({
      name: m.name,
      size: m.size,
      sizeVram: m.size_vram ?? 0,
      expiresAt: m.expires_at?.toString() ?? ''
    }))
  } catch (err) {
    logger.debug('ollama-client', 'listLoadedModels failed', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

/**
 * Delete an installed Ollama model. Frees disk space.
 */
export async function deleteModel(name: string): Promise<void> {
  logger.info('ollama-client', 'Deleting model', { name })
  const ollama = getClient()
  try {
    await ollama.delete({ model: name })
    logger.info('ollama-client', 'Model deleted', { name })
  } catch (err) {
    logger.error('ollama-client', 'Model delete failed', {
      name,
      ...extractErrorMeta(err)
    })
    throw err
  }
}

export async function pullModel(name: string, win: BrowserWindow): Promise<void> {
  logger.info('ollama-client', 'Pulling model', { name })
  const ollama = getClient()
  try {
    const stream = await ollama.pull({ model: name, stream: true })
    for await (const progress of stream) {
      if (!win.isDestroyed()) {
        win.webContents.send('ollama:pullProgress', {
          status: progress.status,
          completed: progress.completed,
          total: progress.total
        })
      }
    }
    logger.info('ollama-client', 'Model pulled', { name })
  } catch (err) {
    logger.error('ollama-client', 'Model pull failed', {
      name,
      ...extractErrorMeta(err)
    })
    throw err
  }
}

// ============================================================================
// Warmup - forces model load before a heavy request to avoid cold-start races
// ============================================================================

/**
 * Warm up a model by sending a tiny non-streaming generate request.
 * This forces Ollama to load the model into memory synchronously, so the
 * subsequent stream request doesn't race with the cold load. Non-fatal:
 * if warmup fails, the main request will still run (and retry if needed).
 */
export async function warmupModel(model: string): Promise<void> {
  const ollama = getClient()
  try {
    logger.info('ollama-client', 'Warming up model', { model })
    await ollama.generate({
      model,
      prompt: 'hi',
      stream: false,
      options: { num_predict: 1 }
    })
    logger.info('ollama-client', 'Model warmed up', { model })
  } catch (err) {
    logger.warn('ollama-client', 'Warmup failed (non-fatal)', {
      model,
      ...extractErrorMeta(err)
    })
    // Non-fatal: main request will retry on its own if needed
  }
}

// ============================================================================
// Stream helpers with retry on transient fetch failures
// ============================================================================

export interface StreamResult {
  text: string
  aborted: boolean
}

export interface StreamOptions {
  model: string
  prompt: string
  system: string
  win: BrowserWindow
  channel?: string
  temperature?: number
  numCtx?: number
}

/**
 * Execute a stream function with one retry on transient fetch errors.
 * The stream function receives a callback that should be invoked BEFORE any
 * partial text is emitted - this lets the retry reset any accumulated state.
 */
async function withTransientRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (isAbortError(err)) throw err
    if (!isTransientFetchError(err)) throw err
    logger.warn('ollama-client', `${label}: transient fetch failure, retrying once after 2s`, {
      ...extractErrorMeta(err)
    })
    await new Promise((r) => setTimeout(r, 2000))
    return await run()
  }
}

// IPC-Batching: statt ein webContents.send pro Token bündeln wir Chunks und
// senden hoechstens alle ~90ms bzw. ab ~1KB. Spart bei schnellen Modellen
// hunderte IPC-Events/s und ebenso viele React-Re-Renders. Der volle Text
// wird ueber ein Array gesammelt (kein O(n^2)-String-+=).
const STREAM_FLUSH_MS = 90
const STREAM_FLUSH_CHARS = 1024

async function consumeStream(
  stream: AsyncIterable<{ message?: { content?: string } }>,
  win: BrowserWindow,
  channel: string
): Promise<StreamResult> {
  const chunks: string[] = []
  let pending = ''
  let lastFlush = Date.now()

  const flush = (): void => {
    if (pending && !win.isDestroyed()) {
      win.webContents.send(channel, pending)
    }
    pending = ''
  }

  try {
    for await (const chunk of stream) {
      const text = chunk.message?.content ?? ''
      if (!text) continue
      chunks.push(text)
      pending += text
      const now = Date.now()
      if (pending.length >= STREAM_FLUSH_CHARS || now - lastFlush >= STREAM_FLUSH_MS) {
        flush()
        lastFlush = now
      }
    }
    flush()
    // Der gespeicherte Text darf keinen Gedankengang enthalten. Im Stream
    // waere er dem Nutzer schon durchgelaufen, in der Datenbank bliebe er
    // stehen - und alle Modi ausser Zeugnis und Vertrag parsen ihn ungeprueft.
    return { text: stripThinking(chunks.join('')), aborted: false }
  } catch (err) {
    if (isAbortError(err)) {
      flush() // Teiltext noch zustellen
      return { text: stripThinking(chunks.join('')), aborted: true }
    }
    throw err
  }
}

export async function streamChat(options: StreamOptions): Promise<StreamResult> {
  const { model, prompt, system, win, channel = 'analysis:chunk', temperature, numCtx } = options
  const ollama = getClient()

  logger.info('ollama-client', 'Starting chat stream', {
    model,
    promptLength: prompt.length,
    systemLength: system.length,
    channel,
    temperature,
    numCtx
  })

  const chatOptions: Record<string, number> = {}
  if (temperature !== undefined) chatOptions.temperature = temperature
  if (numCtx !== undefined) chatOptions.num_ctx = numCtx

  incrementActiveStreams()
  try {
    return await withTransientRetry('streamChat', async () => {
      try {
        const stream = await ollama.chat({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          stream: true,
          think: false,
          options: Object.keys(chatOptions).length > 0 ? chatOptions : undefined
        })

        const result = await consumeStream(stream, win, channel)
        logger.info('ollama-client', 'Chat stream completed', {
          responseLength: result.text.length,
          aborted: result.aborted
        })
        return result
      } catch (err) {
        if (isAbortError(err)) {
          logger.info('ollama-client', 'Chat stream aborted by user')
          return { text: '', aborted: true }
        }
        logger.error('ollama-client', 'Chat stream failed', {
          model,
          ...extractErrorMeta(err)
        })
        throw err
      }
    })
  } finally {
    decrementActiveStreams()
  }
}

export interface ConversationStreamOptions {
  model: string
  messages: Message[]
  win: BrowserWindow
  channel: string
  temperature?: number
  numCtx?: number
}

/**
 * Stream a multi-turn conversation. Used for follow-up chat after an analysis.
 */
export async function streamConversation(
  options: ConversationStreamOptions
): Promise<StreamResult> {
  const { model, messages, win, channel, temperature, numCtx } = options
  const ollama = getClient()

  logger.info('ollama-client', 'Starting conversation stream', {
    model,
    messageCount: messages.length,
    channel,
    temperature,
    numCtx
  })

  const chatOptions: Record<string, number> = {}
  if (temperature !== undefined) chatOptions.temperature = temperature
  if (numCtx !== undefined) chatOptions.num_ctx = numCtx

  incrementActiveStreams()
  try {
    return await withTransientRetry('streamConversation', async () => {
      try {
        const stream = await ollama.chat({
          model,
          messages,
          stream: true,
          think: false,
          options: Object.keys(chatOptions).length > 0 ? chatOptions : undefined
        })

        const result = await consumeStream(stream, win, channel)
        logger.info('ollama-client', 'Conversation stream completed', {
          responseLength: result.text.length,
          aborted: result.aborted
        })
        return result
      } catch (err) {
        if (isAbortError(err)) {
          logger.info('ollama-client', 'Conversation stream aborted by user')
          return { text: '', aborted: true }
        }
        logger.error('ollama-client', 'Conversation stream failed', {
          model,
          ...extractErrorMeta(err)
        })
        throw err
      }
    })
  } finally {
    decrementActiveStreams()
  }
}
