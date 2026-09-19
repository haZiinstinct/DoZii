/**
 * Erkennt gescannte PDFs ohne (brauchbare) Textebene. Ein eingescannter
 * Behoerdenbescheid liefert bei der reinen Textextraktion entweder gar nichts
 * oder eine Mini-Textebene aus Seitenzahlen und Kopfzeilen - beides muss den
 * OCR-Fallback ausloesen, statt das Dokument mit leerem Text zu speichern.
 *
 * Keine Node-/DOM-APIs und kein Import aus src/main -> in beiden Prozessen
 * nutzbar (genau wie text-validators).
 */

import { isLikelyGarbled } from './text-validators'

/**
 * Unter so vielen Zeichen pro Seite gilt ein PDF als Scan ohne Textebene.
 * Reine Textseiten liegen bei 1500-3000 Zeichen.
 *
 * ACHTUNG: src/main/config/constants.ts fuehrt denselben Wert unter demselben
 * Namen (src/shared darf nicht aus src/main importieren). Beide Stellen muessen
 * zusammen geaendert werden, bis der Wert vereinheitlicht ist.
 */
export const SCANNED_PDF_MIN_CHARS_PER_PAGE = 120

/**
 * Anteil Wort-Zeichen (Buchstaben/Ziffern) an allen Nicht-Whitespace-Zeichen,
 * ab dem ein Text noch als lesbar gilt. Sauberer deutscher Text liegt bei
 * 0,85-0,95; kaputte Font-Encodings und OCR-Muell deutlich darunter.
 */
export const WORD_CHAR_RATIO_MIN = 0.6

/** Unter so vielen Nicht-Whitespace-Zeichen ist die Stichprobe zu klein fuer ein Urteil. */
const MIN_CHARS_FOR_VERDICT = 20

const WORD_CHAR = /[\p{L}\p{N}]/u

/**
 * Ergaenzt die Druckbarkeits-Heuristik aus text-validators um die
 * Wort-Zeichen-Dimension: "l1|!¦~^" ist druckbares ASCII, aber kein Text.
 * Die Binaer-/Steuerzeichen-Erkennung wird NICHT nachgebaut, sondern
 * wiederverwendet.
 */
export function isMostlyGibberish(text: string, sampleSize = 5000): boolean {
  const sample = text.length > sampleSize ? text.slice(0, sampleSize) : text
  const compact = sample.replace(/\s+/g, '')
  if (compact.length < MIN_CHARS_FOR_VERDICT) return false
  if (isLikelyGarbled(sample, sampleSize)) return true

  let wordChars = 0
  for (const ch of compact) {
    if (WORD_CHAR.test(ch)) wordChars++
  }
  return wordChars / compact.length < WORD_CHAR_RATIO_MIN
}

/**
 * Warum ein PDF als Scan gilt. Der Aufrufer braucht die Unterscheidung:
 * bei 'gibberish' ist die vorhandene Textebene MUELL, also darf sie nicht
 * gegen ein kuerzeres, aber lesbares OCR-Ergebnis gewinnen.
 */
export type ScanReasonKind = 'empty' | 'sparse' | 'gibberish' | 'readable'

export interface ScanVerdict {
  isScanned: boolean
  kind: ScanReasonKind
  reason: string
  charsPerPage: number
}

/**
 * Entscheidet, ob fuer ein PDF der OCR-Fallback laufen muss.
 * `pageCount` null (unbekannte Seitenzahl) wird wie eine Seite behandelt.
 */
export function detectScannedPdf(text: string, pageCount: number | null): ScanVerdict {
  const trimmed = text.trim()
  // 0 oder negativ waere eine kaputte Seitenzahl - dann lieber wie ein Einseiter rechnen.
  const pages = pageCount !== null && pageCount > 0 ? pageCount : 1
  const charsPerPage = Math.round(trimmed.length / pages)

  if (trimmed.length === 0) {
    return {
      isScanned: true,
      kind: 'empty',
      reason: 'Keine Textebene im PDF - reiner Scan',
      charsPerPage: 0
    }
  }

  if (charsPerPage < SCANNED_PDF_MIN_CHARS_PER_PAGE) {
    return {
      isScanned: true,
      kind: 'sparse',
      reason:
        `Nur ${charsPerPage} Zeichen pro Seite (Mindestwert ${SCANNED_PDF_MIN_CHARS_PER_PAGE}) - ` +
        'vermutlich ein Scan mit Mini-Textebene aus Seitenzahlen/Kopfzeilen',
      charsPerPage
    }
  }

  // Genug Zeichen, aber unlesbar: kaputtes Font-Encoding oder eine bereits
  // misslungene Fremd-OCR. Auch dafür ist unsere OCR die bessere Quelle.
  if (isMostlyGibberish(trimmed)) {
    return {
      isScanned: true,
      kind: 'gibberish',
      reason: `Textebene ist unlesbar (${charsPerPage} Zeichen/Seite, kaum Wort-Zeichen)`,
      charsPerPage
    }
  }

  return {
    isScanned: false,
    kind: 'readable',
    reason: `Verwertbare Textebene vorhanden (${charsPerPage} Zeichen/Seite)`,
    charsPerPage
  }
}
