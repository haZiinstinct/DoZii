import { describe, it, expect } from 'vitest'
import { abortAllRuns, abortRun, currentRun, withRun } from './stream-run'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

/** Haelt einen Lauf offen, bis `release` gerufen wird. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

describe('stream-run', () => {
  it('stellt den Lauf ueber await hinweg bereit', async () => {
    await withRun('analysis', ID_A, async () => {
      await Promise.resolve()
      expect(currentRun()?.id).toBe(ID_A)
    })
    expect(currentRun()).toBeUndefined()
  })

  it('bricht nur den Lauf mit passender ID ab', async () => {
    const gate = deferred()
    let signal: AbortSignal | undefined
    const running = withRun('analysis', ID_A, async () => {
      signal = currentRun()!.controller.signal
      await gate.promise
    })
    expect(abortRun('analysis', ID_B)).toBe(false)
    expect(signal?.aborted).toBe(false)
    expect(abortRun('analysis', ID_A)).toBe(true)
    expect(signal?.aborted).toBe(true)
    gate.release()
    await running
  })

  it('bricht den alten Lauf ab, wenn im selben Bereich ein neuer startet', async () => {
    const gate = deferred()
    let first: AbortSignal | undefined
    const running = withRun('analysis', ID_A, async () => {
      first = currentRun()!.controller.signal
      await gate.promise
    })
    await withRun('analysis', ID_B, async () => {
      expect(first?.aborted).toBe(true)
    })
    gate.release()
    await running
  })

  it('laesst andere Bereiche in Ruhe', async () => {
    const gate = deferred()
    let chat: AbortSignal | undefined
    const running = withRun('chat', ID_A, async () => {
      chat = currentRun()!.controller.signal
      await gate.promise
    })
    abortRun('analysis')
    expect(chat?.aborted).toBe(false)
    abortAllRuns()
    expect(chat?.aborted).toBe(true)
    gate.release()
    await running
  })
})
