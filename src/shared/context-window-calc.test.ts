import { describe, it, expect } from 'vitest'
import {
  pickNumCtx,
  MIN_NUM_CTX,
  MAX_AUTO_NUM_CTX,
  NUM_CTX_LADDER,
  type NumCtxInput
} from './context-window-calc'

/** Grosszuegige Vorgabe: Modell und RAM begrenzen nicht, nur der Bedarf zaehlt. */
function input(partial: Partial<NumCtxInput>): NumCtxInput {
  return {
    modelContextLimit: 131_072,
    neededTokens: 1000,
    freeRamGb: 32,
    autoEnabled: true,
    ...partial
  }
}

describe('pickNumCtx', () => {
  it('Automatik aus -> Festwert 8192, capped wenn der Bedarf groesser ist', () => {
    const d = pickNumCtx(input({ autoEnabled: false, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('Automatik aus')
  })

  it('Automatik aus mit kleinem Bedarf ist nicht capped', () => {
    const d = pickNumCtx(input({ autoEnabled: false, neededTokens: 2000 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(false)
  })

  it('unbekanntes Modell-Limit -> Rueckfall auf 8192', () => {
    const d = pickNumCtx(input({ modelContextLimit: null, neededTokens: 20_000 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('unbekannt')
  })

  it('kleiner Bedarf bleibt auf der untersten Stufe', () => {
    const d = pickNumCtx(input({ neededTokens: 500 }))
    expect(d.numCtx).toBe(8192)
    expect(d.capped).toBe(false)
  })

  it('Bedarf exakt auf einer Stufe waehlt genau diese Stufe', () => {
    expect(pickNumCtx(input({ neededTokens: 8192 })).numCtx).toBe(8192)
    expect(pickNumCtx(input({ neededTokens: 12_288 })).numCtx).toBe(12_288)
    expect(pickNumCtx(input({ neededTokens: 32_768 })).numCtx).toBe(32_768)
  })

  it('ein Token ueber einer Stufe springt auf die naechste', () => {
    expect(pickNumCtx(input({ neededTokens: 8193 })).numCtx).toBe(12_288)
    expect(pickNumCtx(input({ neededTokens: 16_385 })).numCtx).toBe(24_576)
  })

  it('mittlerer Bedarf landet auf der naechsten Stufe darueber', () => {
    const d = pickNumCtx(input({ neededTokens: 20_000 }))
    expect(d.numCtx).toBe(24_576)
    expect(d.capped).toBe(false)
    expect(d.reason).toContain('Bedarf 20000')
  })

  it('Bedarf ueber der hoechsten Stufe -> 32768 und capped', () => {
    const d = pickNumCtx(input({ neededTokens: 90_000 }))
    expect(d.numCtx).toBe(MAX_AUTO_NUM_CTX)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('gekuerzt')
  })

  it('Modell-Limit deckelt unter den Bedarf', () => {
    const d = pickNumCtx(input({ modelContextLimit: 16_384, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(16_384)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('Modell-Limit')
  })

  it('Modell-Limit zwischen zwei Stufen wird nach unten gerundet', () => {
    const d = pickNumCtx(input({ modelContextLimit: 20_000, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(16_384)
  })

  it('Modell-Limit unter der Untergrenze -> trotzdem 8192', () => {
    const d = pickNumCtx(input({ modelContextLimit: 4096, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('Untergrenze')
  })

  it('RAM-Budget deckelt: 3 GB frei -> 12288', () => {
    const d = pickNumCtx(input({ freeRamGb: 3, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(12_288)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('RAM-Budget')
  })

  it('RAM-Budget zwischen zwei Stufen wird nach unten gerundet', () => {
    // 2,5 GB * 4096 = 10240 -> naechstkleinere Stufe ist 8192
    const d = pickNumCtx(input({ freeRamGb: 2.5, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(8192)
  })

  it('kaum freier RAM -> Untergrenze 8192 statt unbrauchbar kleiner Wert', () => {
    const d = pickNumCtx(input({ freeRamGb: 0.4, neededTokens: 30_000 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(true)
    expect(d.reason).toContain('Untergrenze')
  })

  it('unsinnige RAM-Werte (negativ, NaN) fuehren nicht unter die Untergrenze', () => {
    expect(pickNumCtx(input({ freeRamGb: -5, neededTokens: 1000 })).numCtx).toBe(MIN_NUM_CTX)
    expect(pickNumCtx(input({ freeRamGb: Number.NaN, neededTokens: 1000 })).numCtx).toBe(
      MIN_NUM_CTX
    )
  })

  it('negativer Bedarf wird als 0 behandelt', () => {
    const d = pickNumCtx(input({ neededTokens: -100 }))
    expect(d.numCtx).toBe(MIN_NUM_CTX)
    expect(d.capped).toBe(false)
  })

  it('Ergebnis ist immer eine Leiter-Stufe zwischen Unter- und Obergrenze', () => {
    for (const needed of [0, 1, 8191, 8192, 12_000, 25_000, 40_000, 500_000]) {
      for (const limit of [null, 2048, 8192, 32_768, 131_072]) {
        for (const ram of [0, 1, 2.5, 8, 64]) {
          const d = pickNumCtx({
            modelContextLimit: limit,
            neededTokens: needed,
            freeRamGb: ram,
            autoEnabled: true
          })
          expect(NUM_CTX_LADDER).toContain(d.numCtx)
          expect(d.numCtx).toBeGreaterThanOrEqual(MIN_NUM_CTX)
          expect(d.numCtx).toBeLessThanOrEqual(MAX_AUTO_NUM_CTX)
          expect(d.capped).toBe(d.numCtx < needed)
        }
      }
    }
  })
})
