import { describe, it, expect } from 'vitest'
import { determineProfile, fitsInVram, usableVramGb, VRAM_HEADROOM_GB } from './hardware-profile'
import { modelForProfile, profileModelSizes } from './model-catalog'

// Die echten Groessen aus dem Katalog - geprueft wird das, was die App
// benutzt, nicht erfundene Zahlen.
const SIZES = profileModelSizes()

describe('determineProfile mit GPU', () => {
  it('nimmt die hoechste Stufe, deren Modell noch in den Speicher passt', () => {
    expect(determineProfile({ ramGb: 32, vramGb: 10 }, SIZES)).toBe('strong')
    expect(determineProfile({ ramGb: 32, vramGb: 8 }, SIZES)).toBe('medium')
    expect(determineProfile({ ramGb: 32, vramGb: 4 }, SIZES)).toBe('light')
  })

  it('eine Karte, die kein Modell traegt, faellt auf den RAM zurueck', () => {
    // 2,5 GB VRAM reichen samt Puffer fuer kein einziges Modell.
    expect(determineProfile({ ramGb: 32, vramGb: 2.5 }, SIZES)).toBe('light')
    expect(determineProfile({ ramGb: 6, vramGb: 2.5 }, SIZES)).toBe('minimal')
  })

  it('auch die unterste Stufe bekommt ein Modell, das alles kann', () => {
    // Der Boden ist bewusst nicht das kleinste Modell: granite4.1:3b ist
    // 0,4 GB kleiner und gleich schnell, fand aber bei zwei von sechs
    // Bescheiden gar keine Frist. Langsamer ja, schlechter nein.
    expect(modelForProfile('minimal')).toBe('qwen3:4b')
  })

  it('eine leere Stufe faengt nicht alles ab', () => {
    // DoZii fuehrt bewusst kein Riesenmodell. Bekaeme die leere Stufe "power"
    // einen kleinen Ersatzwert, wuerde sie jede Karte abfangen - und ein
    // 24-GB-Rechner bekaeme das KLEINSTE Modell empfohlen.
    expect(SIZES.power).toBe(Number.POSITIVE_INFINITY)
    expect(determineProfile({ ramGb: 64, vramGb: 24 }, SIZES)).toBe('strong')
    expect(modelForProfile(determineProfile({ ramGb: 64, vramGb: 24 }, SIZES))).toBe('gemma4:12b')
  })

  it('das VRAM schlaegt den Arbeitsspeicher', () => {
    // 8 GB RAM, aber eine grosse Karte: das Modell laeuft auf der Karte.
    expect(determineProfile({ ramGb: 8, vramGb: 16 }, SIZES)).toBe('strong')
  })

  it('rechnet den Puffer fuer Kontext und Bildausgabe ab', () => {
    const needed = SIZES.medium + VRAM_HEADROOM_GB
    expect(determineProfile({ ramGb: 4, vramGb: needed }, SIZES)).toBe('medium')
    expect(determineProfile({ ramGb: 4, vramGb: needed - 0.1 }, SIZES)).toBe('light')
  })

  it('eine zu kleine GPU faellt auf die RAM-Einstufung zurueck', () => {
    // 1 GB VRAM traegt nicht einmal das kleinste Modell samt Puffer.
    expect(determineProfile({ ramGb: 32, vramGb: 1 }, SIZES)).toBe('light')
    expect(determineProfile({ ramGb: 8, vramGb: 1 }, SIZES)).toBe('light')
  })
})

describe('determineProfile ohne GPU', () => {
  it('empfiehlt auch bei viel RAM hoechstens die leichte Stufe', () => {
    // Gemessen auf derselben Maschine: das 8B schafft auf der CPU 5,1 Token
    // pro Sekunde, das 3B 11,9. Ein Arbeitszeugnis dauert damit neunzehn
    // Minuten statt einer. Viel RAM macht ein grosses Modell ladbar, nicht
    // benutzbar - vorher bekam genau dieser Rechner das 8B empfohlen.
    expect(determineProfile({ ramGb: 64, vramGb: 0 }, SIZES)).toBe('light')
    expect(determineProfile({ ramGb: 128, vramGb: 0 }, SIZES)).toBe('light')
  })

  it('stuft kleinere Rechner nach RAM ein', () => {
    expect(determineProfile({ ramGb: 16, vramGb: 0 }, SIZES)).toBe('light')
    expect(determineProfile({ ramGb: 8, vramGb: 0 }, SIZES)).toBe('light')
    expect(determineProfile({ ramGb: 4, vramGb: 0 }, SIZES)).toBe('minimal')
  })
})

describe('jede erreichbare Stufe hat ein Modell', () => {
  it('liefert fuer jede Stufe einen Ollama-Tag', () => {
    for (const profile of ['minimal', 'light', 'medium', 'strong'] as const) {
      expect(modelForProfile(profile)).toMatch(/^[a-z0-9.]+:[a-z0-9.]+$/)
    }
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

describe('usableVramGb', () => {
  it('zaehlt NVIDIA und AMD', () => {
    expect(usableVramGb({ name: 'RTX 4070', vramMb: 12288, vendor: 'nvidia' })).toBeCloseTo(12)
    expect(usableVramGb({ name: 'RX 7800', vramMb: 16384, vendor: 'amd' })).toBeCloseTo(16)
  })

  it('zaehlt eine Intel-iGPU nicht mit', () => {
    // Der eigentliche Grund fuer diese Funktion: die Windows-Registry meldet
    // fuer Intel-Grafik den geteilten Arbeitsspeicher. Aus 32 GB RAM wurden so
    // "16 GB VRAM" - und der Buero-Laptop bekam das groesste Modell empfohlen.
    const igpu = { name: 'Intel(R) Iris(R) Xe Graphics', vramMb: 16384, vendor: 'intel' } as const
    expect(usableVramGb(igpu)).toBe(0)
    expect(determineProfile({ ramGb: 32, vramGb: usableVramGb(igpu) }, SIZES)).toBe('light')
  })

  it('zaehlt unerkannte Adapter nicht mit', () => {
    expect(usableVramGb({ name: 'Microsoft Basic Display', vramMb: 8192, vendor: 'unknown' })).toBe(
      0
    )
  })

  it('haelt kaputten Werkzeugausgaben stand', () => {
    expect(usableVramGb(null)).toBe(0)
    expect(usableVramGb({ name: 'x', vramMb: Number.NaN, vendor: 'nvidia' })).toBe(0)
    expect(usableVramGb({ name: 'x', vramMb: -1, vendor: 'nvidia' })).toBe(0)
  })
})
