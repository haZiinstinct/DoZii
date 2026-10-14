import { useEffect, useState, useCallback } from 'react'
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

export function useOllamaStatus() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<OllamaStatus>({
    connected: false,
    model: null,
    installed: false,
    binaryPath: null,
    starting: false,
    startError: null,
    stopping: false,
    stopError: null
  })

  const check = useCallback(async () => {
    try {
      const [connection, installation] = await Promise.all([
        window.api.ollama.getStatus(),
        window.api.ollama.detectInstallation()
      ])

      // Angezeigt wird das Modell, mit dem die Analyse wirklich laeuft: das
      // gewaehlte, wenn es installiert ist - sonst nimmt die App das erste.
      // Frueher stand hier immer models[0], auch wenn ein anderes gewaehlt war.
      let model: string | null = null
      if (connection.connected) {
        const [models, settings] = await Promise.all([
          window.api.ollama.listModels(),
          window.api.settings.get()
        ])
        const selected = models.find((m) => m.name === settings.selectedModel)
        model = selected?.name ?? models[0]?.name ?? null
      }

      setStatus((prev) => ({
        ...prev,
        connected: connection.connected,
        model,
        installed: installation.installed,
        binaryPath: installation.binaryPath
      }))
    } catch {
      setStatus((prev) => ({ ...prev, connected: false, model: null }))
    }
  }, [])

  const startOllama = useCallback(async () => {
    setStatus((prev) => ({ ...prev, starting: true, startError: null }))
    const result = await window.api.ollama.start()
    if (result.started) {
      await check()
      setStatus((prev) => ({ ...prev, starting: false, startError: null }))
    } else {
      setStatus((prev) => ({
        ...prev,
        starting: false,
        startError: result.error ?? t('welcome.startFailed')
      }))
    }
  }, [check, t])

  const stopOllama = useCallback(async () => {
    setStatus((prev) => ({ ...prev, stopping: true, stopError: null }))
    const result = await window.api.ollama.stop()
    if (result.stopped) {
      await check()
      setStatus((prev) => ({ ...prev, stopping: false, stopError: null }))
    } else {
      setStatus((prev) => ({
        ...prev,
        stopping: false,
        stopError: result.error ?? t('settings.stopFailed')
      }))
    }
  }, [check, t])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [check])

  return { ...status, refresh: check, startOllama, stopOllama }
}
