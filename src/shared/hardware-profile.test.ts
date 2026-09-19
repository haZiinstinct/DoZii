import { describe, it, expect } from 'vitest'
import {
  determineProfile,
  fitsInVram,
  PROFILE_MODEL_SIZE_GB,
  VRAM_HEADROOM_GB
} from './hardware-profile'

describe('determineProfile mit GPU', () => {
  it('nimmt die hoechste Stufe, deren Modell noch in den Speicher passt', () => {
    expect(determineProfile({ ramGb: 32, vramGb: 48 })).toBe('power') // 70B passt
    expect(determineProfile({ ramGb: 32, vramGb: 16 })).toBe('strong') // 24B passt
    expect(determineProfile({ ramGb: 32, vramGb: 8 })).toBe('medium') // 7B passt
    expect(determineProfile({ ramGb: 32, vramGb: 4 })).toBe('light') // 3B passt
  })

  it('eine 12-GB-Karte bekommt 7B, nicht 24B', () => {
    // Der eigentliche Punkt: ein 24B-Modell braucht rund 14 GB und passt hier
    // nicht. Frueher landete diese Karte trotzdem auf "strong".
    expect(determineProfile({ ramGb: 32, vramGb: 12 })).toBe('medium')
    expect(fitsInVram(PROFILE_MODEL_SIZE_GB.strong, 12)).toBe(false)
  })

  it('das VRAM schlaegt den Arbeitsspeicher', () => {
    // 8 GB RAM, aber eine 24-GB-Karte: das Modell laeuft auf der Karte.
    expect(determineProfile({ ramGb: 8, vramGb: 24 })).toBe('strong')
  })

  it('rechnet den Puffer fuer Kontext und Bildausgabe ab', () => {
    const needed = PROFILE_MODEL_SIZE_GB.medium + VRAM_HEADROOM_GB
    expect(determineProfile({ ramGb: 4, vramGb: needed })).toBe('medium')
    expect(determineProfile({ ramGb: 4, vramGb: needed - 0.1 })).toBe('light')
  })

  it('eine zu kleine GPU faellt auf die RAM-Einstufung zurueck', () => {
    // 1 GB VRAM traegt nicht einmal das kleinste Modell samt Puffer.
    expect(determineProfile({ ramGb: 32, vramGb: 1 })).toBe('medium')
    expect(determineProfile({ ramGb: 8, vramGb: 1 })).toBe('light')
  })
})

describe('determineProfile ohne GPU', () => {
  it('empfiehlt auch bei viel RAM hoechstens die mittlere Stufe', () => {
    // 64 GB RAM ohne Grafikkarte ergaben frueher "power" und damit ein
    // 70B-Modell, das auf der CPU unbenutzbar ist.
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
    expect(fitsInVram(4.7, 8)).toBe(true)
    expect(fitsInVram(14, 12)).toBe(false)
    expect(fitsInVram(4.7, 4.7 + VRAM_HEADROOM_GB)).toBe(true)
  })

  it('ohne GPU passt nichts', () => {
    expect(fitsInVram(1, 0)).toBe(false)
  })
})
