import { Ollama, type Message } from 'ollama'
import { BrowserWindow } from 'electron'
import { logger } from './logger.service'

let client: Ollama | null = null

function getClient(baseUrl = 'http://localhost:11434'): Ollama {
  if (!client) {
    client = new Ollama({ host: baseUrl })
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
 */
function isAbortError(err: unknown): boolean {
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
    return { connected: false, error: 'Ollama not reachable at localhost:11434' }
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
async function withTransientRetry<T>(
  label: string,
  run: () => Promise<T>
): Promise<T> {
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
      let fullResponse = ''

      try {
        const stream = await ollama.chat({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          stream: true,
          options: Object.keys(chatOptions).length > 0 ? chatOptions : undefined
        })

        for await (const chunk of stream) {
          const text = chunk.message?.content ?? ''
          fullResponse += text
          if (!win.isDestroyed()) {
            win.webContents.send(channel, text)
          }
        }

        logger.info('ollama-client', 'Chat stream completed', {
          responseLength: fullResponse.length
        })
        return { text: fullResponse, aborted: false }
      } catch (err) {
        if (isAbortError(err)) {
          logger.info('ollama-client', 'Chat stream aborted by user', {
            partialLength: fullResponse.length
          })
          return { text: fullResponse, aborted: true }
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
      let fullResponse = ''

      try {
        const stream = await ollama.chat({
          model,
          messages,
          stream: true,
          options: Object.keys(chatOptions).length > 0 ? chatOptions : undefined
        })

        for await (const chunk of stream) {
          const text = chunk.message?.content ?? ''
          fullResponse += text
          if (!win.isDestroyed()) {
            win.webContents.send(channel, text)
          }
        }

        logger.info('ollama-client', 'Conversation stream completed', {
          responseLength: fullResponse.length
        })
        return { text: fullResponse, aborted: false }
      } catch (err) {
        if (isAbortError(err)) {
          logger.info('ollama-client', 'Conversation stream aborted by user', {
            partialLength: fullResponse.length
          })
          return { text: fullResponse, aborted: true }
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
