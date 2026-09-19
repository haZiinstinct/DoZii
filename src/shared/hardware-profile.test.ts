import { describe, it, expect } from 'vitest'
import { determineProfile, fitsInVram, VRAM_HEADROOM_GB } from './hardware-profile'

describe('determineProfile mit GPU', () => {
  it('stuft nach VRAM ein, nicht nach RAM', () => {
    // 8 GB RAM, aber eine 24-GB-Karte: das Modell laeuft auf der Karte.
    expect(determineProfile({ ramGb: 8, vramGb: 24 })).toBe('power')
  })

  it('typische Karten landen in der erwarteten Stufe', () => {
    expect(determineProfile({ ramGb: 32, vramGb: 24 })).toBe('power') // 4090 / 3090
    expect(determineProfile({ ramGb: 32, vramGb: 12 })).toBe('strong') // 6750 XT / 3060 12G
    expect(determineProfile({ ramGb: 16, vramGb: 8 })).toBe('medium') // 3070 / 6600
    expect(determineProfile({ ramGb: 16, vramGb: 4 })).toBe('light') // aeltere Karten
  })

  it('rechnet den Puffer fuer Kontext und Bildausgabe ab', () => {
    // Knapp unter der Schwelle: 11 GB minus Puffer sind 9,5 -> noch nicht 'strong'.
    expect(determineProfile({ ramGb: 32, vramGb: 11 })).toBe('medium')
    expect(determineProfile({ ramGb: 32, vramGb: 11.5 })).toBe('strong')
  })

  it('eine winzige GPU zaehlt nicht als GPU-Betrieb', () => {
    // 1 GB VRAM ist nach Abzug des Puffers nichts - dann entscheidet der RAM.
    expect(determineProfile({ ramGb: 32, vramGb: 1 })).toBe('medium')
  })
})

describe('determineProfile ohne GPU', () => {
  it('empfiehlt auch bei viel RAM hoechstens die mittlere Stufe', () => {
    // Der eigentliche Punkt: 64 GB RAM ohne Grafikkarte ergaben frueher
    // 'power' und damit die Empfehlung eines 70B-Modells, das auf der CPU
    // unbenutzbar ist.
    expect(determineProfile({ ramGb: 64, vramGb: 0 })).toBe('medium')
    expect(determineProfile({ ramGb: 128, vramGb: 0 })).toBe('medium')
  })

  it('stuft kleinere Rechner nach RAM ein', () => {
    expect(determineProfile({ ramGb: 16, vramGb: 0 })).toBe('light')
    expect(determineProfile({ ramGb: 8, vramGb: 0 })).toBe('light')
    expect(determineProfile({ ramGb: 4, vramGb: 0 })).toBe('minimal')
  })
})

describe('fitsInVram', () => {
  it('beruecksichtigt den Puffer', () => {
    expect(fitsInVram(4.7, 8)).toBe(true) // qwen2.5:7b auf 8 GB
    expect(fitsInVram(14, 12)).toBe(false) // 24B-Modell auf 12 GB: nein
    expect(fitsInVram(4.7, 4.7 + VRAM_HEADROOM_GB)).toBe(true)
  })

  it('ohne GPU passt nichts', () => {
    expect(fitsInVram(1, 0)).toBe(false)
  })
})
