import { checkOllamaStatus, listModels } from './ollama-client.service'
import { logger } from './logger.service'
import { getSettings } from './settings.service'

/**
 * Resolution result for the currently active model. This lets callers
 * distinguish "Ollama is unreachable" from "no model installed" from
 * "no model selected" — all three were previously conflated and reported
 * as "Kein Modell ausgewählt" to the user.
 */
export type ModelResolution =
  | { kind: 'ok'; model: string }
  | { kind: 'no-ollama'; message: string }
  | { kind: 'no-models-installed'; message: string }

// In-memory cache (still needed because analysis.ipc owns the "selected model"
// concept before settings are available, e.g. during IPC registration).
let cachedSelectedModel = ''

export function setSelectedModel(name: string): void {
  cachedSelectedModel = name
  logger.info('model-resolver', 'Selected model changed', { model: name || '(cleared)' })
}

export function getSelectedModel(): string {
  return cachedSelectedModel
}

/**
 * Resolve the active model using this order:
 * 1. Cached in-memory selection (last explicit user choice)
 * 2. Settings store (persistent selection from previous sessions)
 * 3. First installed model from Ollama
 *
 * Returns a discriminated result so callers can show precise error messages.
 */
export async function resolveActiveModel(): Promise<ModelResolution> {
  // 1. In-memory cache
  if (cachedSelectedModel) {
    return { kind: 'ok', model: cachedSelectedModel }
  }

  // 2. Persisted setting
  try {
    const settings = getSettings()
    if (settings.selectedModel) {
      cachedSelectedModel = settings.selectedModel
      return { kind: 'ok', model: settings.selectedModel }
    }
  } catch (err) {
    logger.warn('model-resolver', 'Could not read settings for model resolution', {
      error: err instanceof Error ? err.message : String(err)
    })
  }

  // 3. Fallback: first installed model from Ollama. But first check if Ollama
  // is actually reachable so we can give a precise error.
  const status = await checkOllamaStatus()
  if (!status.connected) {
    return {
      kind: 'no-ollama',
      message:
        'Ollama ist nicht erreichbar. Bitte prüfen, ob Ollama läuft (Einstellungen > Ollama starten).'
    }
  }

  const models = await listModels()
  if (models.length === 0) {
    return {
      kind: 'no-models-installed',
      message:
        'Kein Modell installiert. Bitte in den Einstellungen ein Modell herunterladen (z.B. llama3.1:8b).'
    }
  }

  const firstModel = models[0].name
  cachedSelectedModel = firstModel
  logger.info('model-resolver', 'Using first installed model as fallback', { model: firstModel })
  return { kind: 'ok', model: firstModel }
}
