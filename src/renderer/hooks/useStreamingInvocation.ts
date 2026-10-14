import { useCallback, useEffect, useRef } from 'react'

/**
 * A tiny event-bridge abstraction. The preload API exposes `onChunk`,
 * `onComplete`, `onError` functions that register an IPC listener and return
 * an unsubscribe callback. This hook centralizes the lifecycle so:
 *
 * - Listeners are removed synchronously on complete/error (no setTimeout race)
 * - Listeners are always removed on component unmount (no leaks on navigation)
 * - Multiple streams on the same component don't stack up (previous run's
 *   listeners are removed before the next run's are registered)
 *
 * Jeder Lauf hat eine eigene ID, die der Hauptprozess an jedes Event haengt.
 * Events fremder Laeufe werden verworfen: ohne das landeten nach einem
 * Moduswechsel die Reste der alten Analyse im Text der neuen, und deren
 * "complete" beendete die neue vorzeitig.
 */

type RunListener<T> = (value: T, runId?: string) => void

export interface StreamChannel<TComplete, TPhase = never> {
  onChunk: (cb: RunListener<string>) => () => void
  onComplete: (cb: RunListener<TComplete>) => () => void
  onError: (cb: RunListener<string>) => () => void
  onPhase?: (cb: RunListener<TPhase>) => () => void
  /** Bricht den Lauf mit dieser ID im Hauptprozess ab. */
  abort: (runId?: string) => Promise<void>
}

export interface StreamHandlers<TComplete, TPhase = never> {
  onChunk: (chunk: string) => void
  onComplete: (result: TComplete) => void
  onError: (error: string) => void
  onPhase?: (phase: TPhase) => void
}

/** Fallback-Meldung, wenn der Lauf endet, ohne complete oder error zu senden. */
const NO_RESULT_MESSAGE = 'Der Lauf wurde ohne Ergebnis beendet.'

export function useStreamingInvocation<TComplete = unknown, TPhase = never>(
  channel: StreamChannel<TComplete, TPhase>
) {
  // Track removers for the currently-registered listeners
  const removersRef = useRef<Array<() => void>>([])
  /** ID des laufenden Durchgangs, null = keiner. */
  const runIdRef = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    for (const remove of removersRef.current) {
      try {
        remove()
      } catch (err) {
        // Non-fatal: unsubscribing a listener should never throw, but if it
        // does we want to know about it in the logs. Continue cleaning up the
        // others regardless.
        window.api.logs
          .write('warn', 'useStreamingInvocation', 'Failed to remove IPC listener', {
            error: err instanceof Error ? err.message : String(err)
          })
          .catch(() => {
            /* logging itself shouldn't block cleanup */
          })
      }
    }
    removersRef.current = []
  }, [])

  // Beim Unmount nicht nur die Listener entfernen, sondern auch den Lauf im
  // Hauptprozess abbrechen. Sonst laeuft die alte Analyse weiter, belegt das
  // Modell und schreibt am Ende ein Ergebnis, das niemand angefordert hat.
  useEffect(() => {
    return () => {
      cleanup()
      const running = runIdRef.current
      if (running) {
        runIdRef.current = null
        void channel.abort(running)
      }
    }
  }, [cleanup, channel])

  /** Bricht den laufenden Durchgang ab (Stopp-Knopf). */
  const abort = useCallback(async () => {
    const running = runIdRef.current
    if (running) await channel.abort(running)
  }, [channel])

  const run = useCallback(
    async (
      invoke: (runId: string) => Promise<unknown>,
      handlers: StreamHandlers<TComplete, TPhase>
    ) => {
      // Ein noch laufender Durchgang wird abgebrochen, bevor der neue startet.
      const previous = runIdRef.current
      cleanup()
      if (previous) void channel.abort(previous)

      const runId = crypto.randomUUID()
      runIdRef.current = runId
      const isOwn = (id?: string): boolean => id === runId && runIdRef.current === runId
      const finish = (): void => {
        if (runIdRef.current === runId) runIdRef.current = null
        cleanup()
      }

      const removers = [
        channel.onChunk((chunk, id) => {
          if (isOwn(id)) handlers.onChunk(chunk)
        }),
        channel.onComplete((result, id) => {
          if (!isOwn(id)) return
          finish()
          handlers.onComplete(result)
        }),
        channel.onError((err, id) => {
          if (!isOwn(id)) return
          finish()
          handlers.onError(err)
        })
      ]
      if (channel.onPhase && handlers.onPhase) {
        const onPhase = handlers.onPhase
        removers.push(
          channel.onPhase((phase, id) => {
            if (isOwn(id)) onPhase(phase)
          })
        )
      }
      removersRef.current = removers

      try {
        await invoke(runId)
        // Der Hauptprozess sendet complete/error vor der Rueckgabe. Kam keins
        // davon an, haengt die Oberflaeche sonst im Ladezustand fest.
        if (runIdRef.current === runId) {
          finish()
          handlers.onError(NO_RESULT_MESSAGE)
        }
      } catch (err) {
        // If the invoke itself rejects (IPC error), log it, surface to the
        // handlers (so UI can show the error), clean up and bubble up.
        const message = err instanceof Error ? err.message : String(err)
        window.api.logs
          .write('error', 'useStreamingInvocation', 'Invoke failed', {
            error: message,
            stack: err instanceof Error ? err.stack : undefined
          })
          .catch(() => {
            /* non-critical */
          })
        const own = runIdRef.current === runId
        finish()
        if (own) {
          try {
            handlers.onError(message)
          } catch {
            /* handler itself should not prevent cleanup */
          }
        }
        throw err
      }
    },
    [channel, cleanup]
  )

  return { run, abort, cleanup }
}
