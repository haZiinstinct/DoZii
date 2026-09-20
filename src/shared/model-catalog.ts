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
 *
 * Die mittlere Stufe ist bewusst LEER. Sie war mit granite4.1:8b besetzt,
 * bis alle drei Suiten mit korrektem Kontextfenster neu gemessen wurden:
 *
 *                   Zeugnis       Vertraege        Fristen
 *   qwen3:4b        0,33 - 6/6    57,1 % - 3/4     100 %
 *   granite4.1:8b   0,83 - 5/6    42,9 % - 2/4     85,7 % + Erfindung
 *   gemma4:12b      0,00 - 6/6    100 %  - 4/4     100 %
 *
 * Das 8B verliert auf jeder Suite gegen ein Modell von weniger als halber
 * Groesse und benotet zusaetzlich ein Kuendigungsschreiben als Zeugnis. Eine
 * Stufe, die 2,8 GB mehr kostet und nichts besser macht, ist keine Stufe -
 * deshalb geht es von der leichten direkt zur starken.
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
  /**
   * Laeuft das Modell in vertretbarer Zeit auch ohne Grafikkarte? Entscheidet
   * ueber die Einordnung in der Auswahlliste (Reiter CPU / GPU).
   */
  cpuFriendly: boolean
  /** Fuer welche Hardware-Stufe dieses Modell die Empfehlung ist. */
  recommendedFor?: HardwareProfile
}

/**
 * Die Beschreibungstexte stehen bewusst NICHT hier, sondern unter
 * `settings.strengths.<tag>` in den Uebersetzungen - sie muessen in neun
 * Sprachen vorliegen. Hier stehen nur Fakten.
 */

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

/**
 * Der Boden des Katalogs, und zugleich der Rueckfall, wenn zu einer Stufe
 * nichts hinterlegt ist.
 *
 * Bewusst ein Modell, das ALLE Modi kann: ein schwacher Rechner soll
 * langsamer sein, nicht schlechter. Gemessen an denselben Zeugnissen,
 * Vertraegen und Bescheiden:
 *
 *                   Note        Vertragsrisiko   Fristen
 *   granite4.1:3b   1,17 · 4/6  1 von 4          42,9 %
 *   qwen3:4b        0,33 · 6/6  4 von 4          100 %
 *
 * qwen3:4b ist 0,4 GB groesser und auf der CPU gleich schnell (10,6 gegen
 * 11,9 Token/s) - es gibt also keinen Grund, das schwaechere zu empfehlen.
 * Es erkennt ausserdem, wie sonst nur gemma4:12b, ein Kuendigungsschreiben
 * als Nicht-Zeugnis, statt ihm eine Note zu geben.
 */
export const DEFAULT_MODEL = 'qwen3:4b'

export const MODEL_CATALOG: readonly CatalogModel[] = [
  {
    name: 'gemma4:12b',
    displayName: 'Gemma 4 (12B)',
    sizeGb: 7.6,
    contextK: 256,
    heavyModeCapable: true,
    cpuFriendly: false,
    recommendedFor: 'strong'
  },
  {
    // Der Boden. Bestes kleines Modell im Test und bei den Fristen sogar das
    // beste ueberhaupt (100 % Precision und Recall).
    name: 'qwen3:4b',
    displayName: 'Qwen 3 (4B)',
    sizeGb: 2.5,
    contextK: 256,
    heavyModeCapable: true,
    cpuFriendly: true,
    recommendedFor: 'light'
  },
  {
    /*
     * Waehlbar, aber bewusst NICHT empfohlen.
     *
     * Bei Noten und Klauseln ist es das zweitbeste Modell im Feld - bei den
     * Fristen faellt es dagegen ab:
     *
     *              Zeugnis       Vertraege      Fristen (Recall)
     *   qwen3:4b   0,33 - 6/6    57,1 % - 3/4   100 %
     *   qwen3:8b   0,17 - 6/6    85,7 % - 4/4   71,4 %
     *
     * Zwei von sieben Fristen nicht zu finden waere als Voreinstellung nicht
     * zu verantworten: eine verpasste Klagefrist laesst sich nicht
     * nachholen, eine uebersehene Vertragsklausel dagegen meist noch
     * verhandeln oder anfechten. Es benotet ausserdem ein
     * Kuendigungsschreiben als Zeugnis, was qwen3:4b korrekt ablehnt.
     *
     * Wer weiss, dass er vor allem Vertraege prueft, kann es bewusst
     * waehlen - deshalb steht es in der Liste.
     */
    name: 'qwen3:8b',
    displayName: 'Qwen 3 (8B)',
    sizeGb: 4.9,
    contextK: 256,
    heavyModeCapable: true,
    cpuFriendly: false
  },
  {
    // Der kleinste Download, der noch alle Modi bedient - bleibt waehlbar,
    // wird aber nicht empfohlen: Note im Schnitt gut eine Stufe daneben und
    // knapp ein Drittel der Belegzitate erfunden.
    //
    // Darunter gibt es nichts Brauchbares. Gemessen: qwen3:1.7b erfindet
    // 40 % seiner Zitate, llama3.2:3b sogar 50 % und dichtet dem Bescheid
    // ohne Rechtsbehelfsbelehrung eine Frist an. Beide deshalb nicht im
    // Katalog.
    name: 'granite4.1:3b',
    displayName: 'Granite 4.1 (3B)',
    sizeGb: 2.1,
    contextK: 128,
    heavyModeCapable: true,
    cpuFriendly: true
  }
]
