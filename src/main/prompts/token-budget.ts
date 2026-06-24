/**
 * Token-Budget-Schaetzung fuer Ollama-Prompts.
 *
 * Hintergrund: Ollama schneidet bei Ueberschreitung von num_ctx die AELTESTEN
 * Tokens ab - also den Anfang des System-Prompts samt Dokument. Das fuehrt zu
 * stillen, voellig falschen Analysen. Besser: wir kuerzen das Dokument selbst
 * kontrolliert am Ende und sagen es dem Nutzer.
 *
 * ~3.5 Zeichen pro Token ist eine konservative Schaetzung fuer deutschen Text
 * (englisch ~4). Lieber etwas zu frueh kuerzen als still Kontext verlieren.
 */

import { CHARS_PER_TOKEN } from '../config/constants'

export const TRUNCATION_MARKER =
  '\n\n[... Dokument fuer die Analyse gekuerzt - der restliche Text passte nicht in das Kontextfenster des Modells ...]'

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export interface FitResult {
  text: string
  truncated: boolean
}

/**
 * Kuerzt Text auf maxTokens (geschaetzt). Schneidet bevorzugt an einer
 * Absatz- oder Satzgrenze nahe dem Limit, damit das Modell keinen
 * abgehackten Halbsatz als letzten Kontext bekommt.
 */
export function fitTextToTokenBudget(text: string, maxTokens: number): FitResult {
  if (estimateTokens(text) <= maxTokens) {
    return { text, truncated: false }
  }

  const maxChars = Math.max(0, Math.floor(maxTokens * CHARS_PER_TOKEN) - TRUNCATION_MARKER.length)
  let cut = text.slice(0, maxChars)
  const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '))
  if (lastBreak > maxChars - 500) {
    cut = cut.slice(0, lastBreak + 1)
  }
  return { text: cut + TRUNCATION_MARKER, truncated: true }
}
