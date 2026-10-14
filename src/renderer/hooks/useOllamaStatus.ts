import { useState, useCallback, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

export interface OllamaStatus {
  connected: boolean
  model: string | null
  installed: boolean
  binaryPath: string | null
  starting: boolean
  startError: string | null
  stopping: boolean
  stopError: string | null
}

type ConnectionState = Pick<OllamaStatus, 'connected' | 'model' | 'installed' | 'binaryPath'>

/*
 * Ein gemeinsamer Poller fuer die ganze App. Frueher fragte jede Komponente
 * mit dem Hook (Sidebar und Einstellungen) selbst alle 30 s ab - doppelt, und
 * auch dann, wenn das Fenster gar nicht sichtbar war.
 */
const POLL_MS = 30_000
let connection: ConnectionState = {
  connected: false,
  model: null,
  installed: false,
  binaryPath: null
}
const listeners = new Set<() => void>()
let timer: number | undefined
let inflight: Promise<void> | null = null

async function fetchConnection(): Promise<ConnectionState> {
  try {
    const [status, installation] = await Promise.all([
      window.api.ollama.getStatus(),
      window.api.ollama.detectInstallation()
    ])

    // Angezeigt wird das Modell, mit dem die Analyse wirklich laeuft: das
    // gewaehlte, wenn es installiert ist - sonst nimmt die App das erste.
    // Frueher stand hier immer models[0], auch wenn ein anderes gewaehlt war.
    let model: string | null = null
    if (status.connected) {
      const [models, settings] = await Promise.all([
        window.api.ollama.listModels(),
        window.api.settings.get()
      ])
      const selected = models.find((m) => m.name === settings.selectedModel)
      model = selected?.name ?? models[0]?.name ?? null
    }
    return {
      connected: status.connected,
      model,
      installed: installation.installed,
      binaryPath: installation.binaryPath
    }
  } catch {
    return { ...connection, connected: false, model: null }
  }
}

/** Eine Abfrage fuer alle - laeuft schon eine, warten alle auf dieselbe. */
function refreshConnection(): Promise<void> {
  inflight ??= fetchConnection()
    .then((next) => {
      connection = next
      for (const listener of listeners) listener()
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function onVisibilityChange(): void {
  if (!document.hidden) void refreshConnection()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    void refreshConnection()
    timer = window.setInterval(() => {
      if (!document.hidden) void refreshConnection()
    }, POLL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

const getSnapshot = (): ConnectionState => connection

export function useOllamaStatus() {
  const { t } = useTranslation()
  const shared = useSyncExternalStore(subscribe, getSnapshot)
  // Start/Stopp-Zustand gehoert zur Komponente, die den Knopf zeigt.
  const [status, setStatus] = useState({
    starting: false,
    startError: null as string | null,
    stopping: false,
    stopError: null as string | null
  })
  const startOllama = useCallback(async () => {
    setStatus((prev) => ({ ...prev, starting: true, startError: null }))
    const result = await window.api.ollama.start()
    if (result.started) {
      await refreshConnection()
      setStatus((prev) => ({ ...prev, starting: false, startError: null }))
    } else {
      setStatus((prev) => ({
        ...prev,
        starting: false,
        startError: result.error ?? t('welcome.startFailed')
      }))
    }
  }, [t])

  const stopOllama = useCallback(async () => {
    setStatus((prev) => ({ ...prev, stopping: true, stopError: null }))
    const result = await window.api.ollama.stop()
    if (result.stopped) {
      await refreshConnection()
      setStatus((prev) => ({ ...prev, stopping: false, stopError: null }))
    } else {
      setStatus((prev) => ({
        ...prev,
        stopping: false,
        stopError: result.error ?? t('settings.stopFailed')
      }))
    }
  }, [t])

  return { ...shared, ...status, refresh: refreshConnection, startOllama, stopOllama }
}
