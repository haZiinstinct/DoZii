/**
 * Gemeinsame Druckbarkeits-Heuristik fuer Main (Import-Validierung) und
 * Renderer (defensiver Re-Check fuer Altbestand). Vorher dupliziert als
 * checkPrintability (Main) und isLikelyGarbled (Renderer) - die
 * Zeichenklassifizierung lief getrennt und konnte auseinanderdriften.
 *
 * Keine Node-/DOM-APIs -> in beiden Prozessen nutzbar.
 */

export const PRINTABLE_RATIO_MIN = 0.8
export const CONTROL_RATIO_MAX = 0.05

export interface PrintabilityRatios {
  printableRatio: number
  controlRatio: number
}

/**
 * Klassifiziert Zeichen und liefert die Anteile druckbarer bzw. Steuerzeichen.
 * Druckbar = ASCII 32-126, Whitespace (\n\r\t), Latin-1 (Umlaute/Akzente) und
 * gaengige Symbole (€, en/em-dash, smart quotes, …, °, §).
 */
export function computePrintability(text: string): PrintabilityRatios {
  if (text.length === 0) return { printableRatio: 0, controlRatio: 0 }

  let printable = 0
  let control = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 9 || code === 10 || code === 13) {
      printable++
      continue
    }
    if (code >= 32 && code <= 126) {
      printable++
      continue
    }
    if (
      (code >= 160 && code <= 255) ||
      code === 0x20ac ||
      (code >= 0x2013 && code <= 0x2014) ||
      (code >= 0x2018 && code <= 0x201f) ||
      code === 0x2026
    ) {
      printable++
      continue
    }
    if (code < 32) {
      control++
    }
    // Sonstiges (CJK, sonstiges Unicode) zaehlt neutral.
  }

  return { printableRatio: printable / text.length, controlRatio: control / text.length }
}

export interface PrintabilityCheck extends PrintabilityRatios {
  ok: boolean
  reason?: string
}

/**
 * Vollstaendige Pruefung mit Begruendung - im Main-Prozess beim Import.
 * Liest den GESAMTEN Text (Import laeuft ohnehin einmalig).
 */
export function checkPrintability(text: string): PrintabilityCheck {
  if (text.length === 0) {
    return { printableRatio: 0, controlRatio: 0, ok: false, reason: 'Text ist leer' }
  }
  const { printableRatio, controlRatio } = computePrintability(text)
  if (controlRatio > CONTROL_RATIO_MAX) {
    return {
      printableRatio,
      controlRatio,
      ok: false,
      reason: `Zu viele Steuerzeichen (${Math.round(controlRatio * 100)}%) - Text ist wahrscheinlich binär/beschädigt`
    }
  }
  if (printableRatio < PRINTABLE_RATIO_MIN) {
    return {
      printableRatio,
      controlRatio,
      ok: false,
      reason: `Nur ${Math.round(printableRatio * 100)}% druckbare Zeichen - Datei ist möglicherweise ein gescanntes Bild, beschädigt oder in einem unbekannten Encoding`
    }
  }
  return { printableRatio, controlRatio, ok: true }
}

/**
 * Schnelle Heuristik fuer den Renderer (defensiver Banner bei Altbestand).
 * Nutzt eine Stichprobe vom Anfang - die Extraktionsqualitaet ist statistisch
 * repraesentativ ueber das Dokument; spart Arbeit bei sehr langen Texten.
 */
export function isLikelyGarbled(text: string, sampleSize = 5000): boolean {
  if (text.length === 0) return false
  const sample = text.length > sampleSize ? text.slice(0, sampleSize) : text
  const { printableRatio, controlRatio } = computePrintability(sample)
  return printableRatio < PRINTABLE_RATIO_MIN || controlRatio > CONTROL_RATIO_MAX
}
