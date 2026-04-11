import { useEffect, useState, useCallback } from 'react'

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

      let model: string | null = null
      if (connection.connected) {
        const models = await window.api.ollama.listModels()
        model = models?.[0]?.name ?? null
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
        startError: result.error ?? 'Ollama konnte nicht gestartet werden'
      }))
    }
  }, [check])

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
        stopError: result.error ?? 'Ollama konnte nicht gestoppt werden'
      }))
    }
  }, [check])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [check])

  return { ...status, refresh: check, startOllama, stopOllama }
}
