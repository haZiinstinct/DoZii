import { useEffect, useState, useCallback } from 'react'
import type { SystemMetrics } from '@shared/types'

const POLL_INTERVAL_MS = 3000

/**
 * Poll the main-process for live system metrics (CPU load, RAM, loaded models,
 * active stream count). Pauses polling when the window loses focus to save
 * battery, resumes on focus.
 */
export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await window.api.system.getMetrics()
      setMetrics(result)
    } catch {
      // Silent - metrics are non-critical. If the IPC is unavailable we just
      // keep the last known value (or null).
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const start = (): void => {
      if (interval !== null) return
      void refresh()
      interval = setInterval(() => {
        if (!cancelled) void refresh()
      }, POLL_INTERVAL_MS)
    }

    const stop = (): void => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }

    // Only poll while the window is focused (pause in background)
    if (document.hasFocus()) start()

    const onBlur = (): void => stop()
    const onFocus = (): void => start()

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      stop()
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { metrics, refresh }
}
