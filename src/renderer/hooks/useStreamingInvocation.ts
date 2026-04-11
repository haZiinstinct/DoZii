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
 */

export interface StreamChannel<TComplete> {
  onChunk: (cb: (chunk: string) => void) => () => void
  onComplete: (cb: (result: TComplete) => void) => () => void
  onError: (cb: (error: string) => void) => () => void
}

export interface StreamHandlers<TComplete> {
  onChunk: (chunk: string) => void
  onComplete: (result: TComplete) => void
  onError: (error: string) => void
}

export function useStreamingInvocation<TComplete = unknown>(channel: StreamChannel<TComplete>) {
  // Track removers for the currently-registered listener trio
  const removersRef = useRef<Array<() => void>>([])

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

  // Always clean up listeners on unmount
  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const run = useCallback(
    async (invoke: () => Promise<unknown>, handlers: StreamHandlers<TComplete>) => {
      // Remove any previous listeners before registering new ones
      cleanup()

      const chunkRemover = channel.onChunk(handlers.onChunk)
      const completeRemover = channel.onComplete((result) => {
        handlers.onComplete(result)
        cleanup()
      })
      const errorRemover = channel.onError((err) => {
        handlers.onError(err)
        cleanup()
      })
      removersRef.current = [chunkRemover, completeRemover, errorRemover]

      try {
        await invoke()
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
        try {
          handlers.onError(message)
        } catch {
          /* handler itself should not prevent cleanup */
        }
        cleanup()
        throw err
      }
    },
    [channel, cleanup]
  )

  return { run, cleanup }
}
