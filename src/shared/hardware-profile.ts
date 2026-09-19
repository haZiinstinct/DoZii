/**
 * Einstufung der Hardware und Modellempfehlung - als reine Funktion, damit
 * sie testbar ist. Die Erkennung selbst (nvidia-smi, rocm-smi, Registry)
 * bleibt im Hauptprozess.
 */

import type { HardwareProfile } from './types'

/**
 * Wie viel VRAM zusaetzlich zu den Modellgewichten gebraucht wird: Kontext,
 * KV-Cache und die Bildausgabe des Systems. Ohne diesen Puffer landet ein
 * Modell halb im RAM, wird um ein Vielfaches langsamer - und der Nutzer
 * denkt, die App sei kaputt.
 */
export const VRAM_HEADROOM_GB = 1.5

/**
 * Ungefaehre Groesse der empfohlenen Modelle auf der Platte (Q4-Quantisierung),
 * in GB. Die Schwellen der Einstufung leiten sich DARAUS ab - sonst empfiehlt
 * die App ein Modell, das auf der erkannten Karte gar nicht laeuft.
 *
 * Aendert sich der Modellkatalog, gehoeren diese Zahlen mit angepasst.
 */
export const PROFILE_MODEL_SIZE_GB: Record<HardwareProfile, number> = {
  minimal: 0.8, // ~1B
  light: 1.9, // ~3B
  medium: 4.7, // ~7B
  strong: 14, // ~24B
  power: 40 // ~70B
}

export interface ProfileInput {
  ramGb: number
  /** VRAM der staerksten GPU in GB. 0 = keine brauchbare GPU erkannt. */
  vramGb: number
}

/** Passt ein Modell dieser Groesse vollstaendig in den Videospeicher? */
export function fitsInVram(modelSizeGb: number, vramGb: number): boolean {
  if (vramGb <= 0) return false
  return modelSizeGb + VRAM_HEADROOM_GB <= vramGb
}

/**
 * Einstufung.
 *
 * Mit GPU entscheidet das VRAM: es wird die hoechste Stufe genommen, deren
 * Modell noch vollstaendig in den Videospeicher passt. Frueher waren die
 * Schwellen frei gegriffen und passten nicht zu den Modellgroessen - eine
 * 12-GB-Karte landete auf "strong" und bekam ein 24B-Modell empfohlen, das
 * rund 14 GB braucht und damit gar nicht hineinpasst.
 *
 * Ohne GPU entscheidet der Arbeitsspeicher, und dann gedeckelt: auch das war
 * vorher ein ODER ueber beide Werte, sodass ein Rechner mit 64 GB RAM und
 * ohne Grafikkarte ein 70B-Modell empfohlen bekam - auf der CPU unter einem
 * Token pro Sekunde.
 */
export function determineProfile(input: ProfileInput): HardwareProfile {
  const { ramGb, vramGb } = input

  if (vramGb > 0) {
    const byVram: HardwareProfile[] = ['power', 'strong', 'medium', 'light', 'minimal']
    for (const profile of byVram) {
      if (fitsInVram(PROFILE_MODEL_SIZE_GB[profile], vramGb)) return profile
    }
    // Die Karte ist zu klein fuer jedes Modell - dann entscheidet der RAM.
  }

  // Reiner CPU-Betrieb. Mehr Arbeitsspeicher macht ein grosses Modell nicht
  // schnell, nur ladbar - deshalb hoechstens 'medium'.
  if (ramGb >= 32) return 'medium'
  if (ramGb >= 8) return 'light'
  return 'minimal'
}
