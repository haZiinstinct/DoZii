/**
 * Einstufung der Hardware und Modellempfehlung - als reine Funktion, damit
 * sie testbar ist. Die Erkennung selbst (nvidia-smi, rocm-smi, Registry)
 * bleibt im Hauptprozess.
 */

import type { HardwareProfile } from './types'

/**
 * Wie viel VRAM ein Modell zusaetzlich zu seinen Gewichten braucht: Kontext,
 * KV-Cache und Grafikausgabe des Systems. Ohne diesen Puffer landet ein Modell
 * halb im RAM, wird um ein Vielfaches langsamer - und der Nutzer denkt, die
 * App sei kaputt.
 */
export const VRAM_HEADROOM_GB = 1.5

export interface ProfileInput {
  ramGb: number
  /** VRAM der staerksten GPU in GB. 0 = keine brauchbare GPU erkannt. */
  vramGb: number
}

/**
 * Einstufung.
 *
 * Wichtig: mit GPU entscheidet das VRAM, ohne GPU der Arbeitsspeicher - und
 * dann gedeckelt. Frueher war das ein ODER ueber beide Werte; ein Rechner mit
 * 64 GB RAM und ohne Grafikkarte landete damit auf 'power' und bekam ein
 * 70B-Modell empfohlen, das auf der CPU mit unter einem Token pro Sekunde
 * laeuft. Das ist keine Empfehlung, das ist eine Falle.
 */
export function determineProfile(input: ProfileInput): HardwareProfile {
  const { ramGb, vramGb } = input
  const usableVram = Math.max(0, vramGb - VRAM_HEADROOM_GB)

  if (usableVram >= 1) {
    if (usableVram >= 22) return 'power'
    if (usableVram >= 10) return 'strong'
    if (usableVram >= 5) return 'medium'
    if (usableVram >= 2.5) return 'light'
    return 'minimal'
  }

  // Reiner CPU-Betrieb. Mehr Arbeitsspeicher macht ein grosses Modell nicht
  // schnell, nur ladbar - deshalb hoechstens 'medium'.
  if (ramGb >= 32) return 'medium'
  if (ramGb >= 16) return 'light'
  if (ramGb >= 8) return 'light'
  return 'minimal'
}

/**
 * Passt ein Modell dieser Groesse noch vollstaendig in den Videospeicher?
 * Fuer die Warnung in der Modellauswahl.
 */
export function fitsInVram(modelSizeGb: number, vramGb: number): boolean {
  if (vramGb <= 0) return false
  return modelSizeGb + VRAM_HEADROOM_GB <= vramGb
}
