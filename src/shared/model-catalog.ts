/**
 * Der Modellkatalog - EINE Quelle fuer alles, was DoZii ueber Modelle weiss.
 *
 * Vorher stand dieselbe Information an vier Stellen: die Auswahlliste in den
 * Einstellungen, die Empfehlung je Hardware-Stufe, die Groessen fuer die
 * VRAM-Rechnung und die Liste der Modelle, die fuer die schweren Modi zu
 * klein sind. Jede Katalog-Aenderung musste man an allen vier Stellen
 * nachziehen - und eine zu vergessen faellt erst dem Nutzer auf.
 *
 * Auswahlkriterien fuer diesen Katalog:
 * 1. Es muss auf Rechnern laufen, die Leute wirklich haben. Kein Modell, das
 *    eine Karte mit 24 GB braucht.
 * 2. Es muss DEUTSCH koennen - die Dokumente sind deutsch.
 * 3. Es muss striktes JSON liefern. Zeugnis-Decoder und Vertrags-Check
 *    stehen und fallen damit; ein Modell, das hier ausfranst, faellt in der
 *    Oberflaeche auf rohes Markdown zurueck.
 * 4. Grosser Kontext hilft: lange Vertraege muessen sonst in Abschnitte
 *    zerlegt werden, was Qualitaet kostet.
 */

import type { HardwareProfile } from './types'
import { VRAM_HEADROOM_GB, type ProfileModelSizes } from './hardware-profile'

export interface CatalogModel {
  /** Ollama-Tag, exakt so wie bei `ollama pull`. */
  name: string
  displayName: string
  /** Downloadgroesse in GB (Q4), gerundet. */
  sizeGb: number
  /** Kontextfenster in Tausend Tokens. */
  contextK: number
  /**
   * Taugt das Modell fuer die schweren Modi (Arbeitszeugnis, Vertrags-Check)?
   * Die verlangen striktes JSON nach einem sehr langen Systemprompt. Modelle
   * ohne dieses Haekchen werden nicht blockiert - der Nutzer bekommt aber
   * eine Warnung, bevor er sich auf eine Note verlaesst.
   */
  heavyModeCapable: boolean
  /** Kurzbeschreibung fuer die Auswahlliste (deutsch, eine Zeile). */
  strengths: string
  /** Fuer welche Hardware-Stufe dieses Modell die Empfehlung ist. */
  recommendedFor?: HardwareProfile
}

/**
 * Wie viel Arbeitsspeicher der reine CPU-Betrieb braucht: Modell plus
 * Kontext plus Betriebssystem. Grob Modellgroesse mal zwei, mindestens 8 GB -
 * auf weniger wird es zaeh, egal wie klein das Modell ist.
 */
export function minRamGb(model: CatalogModel): number {
  return Math.max(8, Math.ceil(model.sizeGb * 2))
}

/** Ab wie viel VRAM das Modell vollstaendig auf der Grafikkarte laeuft. */
export function minVramGb(model: CatalogModel): number {
  return Math.ceil(model.sizeGb + VRAM_HEADROOM_GB)
}

export function findModel(name: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.name === name)
}

/**
 * Ist dieses Modell fuer Zeugnis-Decoder und Vertrags-Check geeignet?
 * Unbekannte Modelle (der Nutzer darf jedes installierte waehlen) gelten als
 * geeignet - wer bewusst etwas anderes waehlt, bekommt keine Bevormundung.
 */
export function isHeavyModeCapable(name: string): boolean {
  const model = findModel(name)
  return model ? model.heavyModeCapable : true
}

/**
 * Groesse des empfohlenen Modells je Stufe - Grundlage der Hardware-Einstufung.
 *
 * Stufen ohne hinterlegtes Modell bekommen Unendlich, sind also unerreichbar.
 * Das ist wichtig: mit einem kleinen Ersatzwert wuerde eine leere Stufe jede
 * Grafikkarte abfangen, weil die Einstufung von oben nach unten prueft - und
 * dann bekaeme ein 24-GB-Rechner das kleinste Modell empfohlen. DoZii fuehrt
 * bewusst keine Stufe fuer Riesenmodelle; "power" ist deshalb leer.
 */
export function profileModelSizes(): ProfileModelSizes {
  const sizes = {} as ProfileModelSizes
  for (const profile of ['minimal', 'light', 'medium', 'strong', 'power'] as HardwareProfile[]) {
    const match = MODEL_CATALOG.find((m) => m.recommendedFor === profile)
    sizes[profile] = match ? match.sizeGb : Number.POSITIVE_INFINITY
  }
  return sizes
}

export function modelForProfile(profile: HardwareProfile): string {
  const match = MODEL_CATALOG.find((m) => m.recommendedFor === profile)
  return match ? match.name : DEFAULT_MODEL
}

/** Fallback, wenn zur Stufe nichts hinterlegt ist. */
export const DEFAULT_MODEL = 'granite4.1:3b'

export const MODEL_CATALOG: readonly CatalogModel[] = [
  {
    name: 'granite4.1:3b',
    displayName: 'Granite 4.1 (3B)',
    sizeGb: 2.1,
    contextK: 128,
    heavyModeCapable: true,
    strengths: 'Leicht, Deutsch und JSON ab Werk - laeuft auch ohne Grafikkarte',
    recommendedFor: 'light'
  },
  {
    name: 'granite4.1:8b',
    displayName: 'Granite 4.1 (8B)',
    sizeGb: 5.3,
    contextK: 128,
    heavyModeCapable: true,
    strengths: 'Der Allrounder: alle Modi zuverlaessig, passt auf 8-GB-Karten',
    recommendedFor: 'medium'
  },
  {
    name: 'gemma4:12b',
    displayName: 'Gemma 4 (12B)',
    sizeGb: 7.6,
    contextK: 256,
    heavyModeCapable: true,
    strengths: 'Beste Qualitaet fuer Zeugnis und Vertrag, passt auf 10-GB-Karten',
    recommendedFor: 'strong'
  },
  {
    name: 'qwen3:4b',
    displayName: 'Qwen 3 (4B)',
    sizeGb: 2.5,
    contextK: 256,
    heavyModeCapable: true,
    strengths: 'Sehr grosser Kontext bei kleiner Groesse - gut fuer lange Vertraege'
  },
  {
    name: 'qwen2.5:7b',
    displayName: 'Qwen 2.5 (7B)',
    sizeGb: 4.7,
    contextK: 32,
    heavyModeCapable: true,
    strengths: 'Bewaehrt bei Deutsch und JSON'
  },
  {
    name: 'llama3.2:3b',
    displayName: 'Llama 3.2 (3B)',
    sizeGb: 2.0,
    contextK: 128,
    heavyModeCapable: false,
    strengths: 'Schnell und genuegsam - fuer Zeugnis und Vertrag aber zu klein'
  },
  {
    name: 'gemma3:1b',
    displayName: 'Gemma 3 (1B)',
    sizeGb: 0.8,
    contextK: 32,
    heavyModeCapable: false,
    strengths: 'Notnagel fuer sehr alte Rechner - nur Zusammenfassung und Fragen',
    recommendedFor: 'minimal'
  }
]
