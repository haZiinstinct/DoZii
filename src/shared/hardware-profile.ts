/**
 * Einstufung der Hardware und Modellempfehlung - als reine Funktion, damit
 * sie testbar ist. Die Erkennung selbst (nvidia-smi, rocm-smi, Registry)
 * bleibt im Hauptprozess.
 */

import type { GpuInfo, GpuVendor } from './types'
import type { HardwareProfile } from './types'

/**
 * Wie viel VRAM zusaetzlich zu den Modellgewichten gebraucht wird: Kontext,
 * KV-Cache und die Bildausgabe des Systems. Ohne diesen Puffer landet ein
 * Modell halb im RAM, wird um ein Vielfaches langsamer - und der Nutzer
 * denkt, die App sei kaputt.
 */
export const VRAM_HEADROOM_GB = 1.5

/**
 * Groesse des Modells je Stufe, in GB. Die Schwellen der Einstufung leiten
 * sich DARAUS ab - sonst empfiehlt die App ein Modell, das auf der erkannten
 * Karte gar nicht laeuft.
 *
 * Wird als Parameter hereingereicht, damit der Modellkatalog die einzige
 * Quelle bleibt und dieses Modul rein und ohne Importzirkel testbar ist.
 */
export type ProfileModelSizes = Record<HardwareProfile, number>

/**
 * Nur diese Hersteller beschleunigt Ollama wirklich: NVIDIA ueber CUDA, AMD
 * ueber ROCm. Intel-Karten und unerkannte Adapter laufen auf der CPU.
 */
const ACCELERATED_VENDORS: ReadonlySet<GpuVendor> = new Set<GpuVendor>(['nvidia', 'amd'])

/**
 * Wie viel Videospeicher fuer die Einstufung tatsaechlich zaehlt.
 *
 * Eine Intel-iGPU meldet ueber die Windows-Registry haeufig den GETEILTEN
 * Arbeitsspeicher als eigenen: auf einem Buero-Laptop mit 32 GB RAM stehen da
 * schnell 16 "GB VRAM". Gezaehlt haette das die hoechste Stufe ergeben - und
 * genau der Laptop, der die Masse der Nutzer abbildet, bekaeme das groesste
 * Modell empfohlen und liefe damit auf der CPU im Schneckentempo.
 */
export function usableVramGb(gpu: GpuInfo | null): number {
  if (!gpu || !ACCELERATED_VENDORS.has(gpu.vendor)) return 0
  if (!Number.isFinite(gpu.vramMb) || gpu.vramMb <= 0) return 0
  return gpu.vramMb / 1024
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
export function determineProfile(input: ProfileInput, sizes: ProfileModelSizes): HardwareProfile {
  const { ramGb, vramGb } = input

  if (vramGb > 0) {
    const byVram: HardwareProfile[] = ['power', 'strong', 'medium', 'light', 'minimal']
    for (const profile of byVram) {
      if (fitsInVram(sizes[profile], vramGb)) return profile
    }
    // Die Karte ist zu klein fuer jedes Modell - dann entscheidet der RAM.
  }

  /*
   * Reiner CPU-Betrieb. Mehr Arbeitsspeicher macht ein grosses Modell nicht
   * schnell, nur ladbar - deshalb ist hier bei 'light' Schluss.
   *
   * Die Grenze ist gemessen, nicht geschaetzt. Ein echtes Arbeitszeugnis
   * durch qwen3:4b, num_gpu 0, num_ctx 12288:
   *
   *   Prompt   5216 Token in   72 s  (72 Token/s)
   *   Ausgabe  7220 Token in 1338 s  (5,4 Token/s)
   *   Gesamt              rund 24 Minuten
   *
   * Das 8B ist im Kurztest halb so schnell wie das 4B (5,1 gegen 10,6
   * Token/s), also ueber eine Dreiviertelstunde pro Zeugnis - hochgerechnet,
   * nicht gemessen, aber die Richtung reicht. Vorher bekam ein Rechner mit
   * 32 GB RAM und ohne Grafikkarte genau dieses 8B empfohlen.
   *
   * Auch die leichte Stufe ist auf der CPU keine Freude; sie ist nur das
   * Einzige, was ueberhaupt in vertretbarer Zeit fertig wird.
   */
  if (ramGb >= 8) return 'light'
  return 'minimal'
}
