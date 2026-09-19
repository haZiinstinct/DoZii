/**
 * Dasselbe Kontextfenster wie in der App.
 *
 * Die Suiten fuhren bisher mit festen 8192 Tokens. Das war dieselbe Zahl, die
 * die App als Untergrenze benutzt - aber eben nur die Untergrenze: die App
 * hebt das Fenster an, wenn Prompt-Geruest, Dokument und Antwort-Reserve
 * nicht hineinpassen. Beim Zeugnis-Modus ist das immer der Fall.
 *
 * Gemessen wurde damit ein Zustand, den kein Nutzer hat: das Geruest belegt
 * rund 4300 Tokens, die Antwort braucht 5000 bis 6000 - bei 8192 blieb fuer
 * das Zeugnis nichts uebrig, und Ollama schob beim Schreiben den Anfang des
 * Prompts hinaus. Die Ausfaelle der kleinen Modelle waren deshalb zum Teil
 * keine Modellschwaeche, sondern diese Fehlkonfiguration.
 */

import {
  promptOverheadTokens,
  responseReserveTokens,
  type AnalysisMode,
  type BuildPromptOptions
} from '../../src/main/prompts/prompt-builder'
import { estimateTokens } from '../../src/main/prompts/token-budget'
import { pickNumCtx } from '../../src/shared/context-window-calc'

/**
 * Was die App als Mindest-Dokumentmenge ansetzt, bevor ein Modus arbeiten
 * kann. Muss zu MIN_DOCUMENT_TOKENS_FOR_MODE in analysis.service.ts passen.
 */
const MIN_DOCUMENT_TOKENS = 1500

/**
 * Grosszuegiges Modell-Limit: alle Modelle im Katalog koennen mindestens
 * 32k, und MAX_AUTO_NUM_CTX deckelt ohnehin bei 32768.
 */
const ASSUMED_MODEL_LIMIT = 131_072

export function evalNumCtx(
  mode: AnalysisMode,
  text: string,
  language = 'de',
  options: BuildPromptOptions = {}
): number {
  const overhead = promptOverheadTokens(mode, language, options)
  const reserve = responseReserveTokens(mode)
  return pickNumCtx({
    modelContextLimit: ASSUMED_MODEL_LIMIT,
    neededTokens: overhead + estimateTokens(text) + reserve,
    minimumTokens: overhead + reserve + MIN_DOCUMENT_TOKENS,
    freeRamGb: 32,
    autoEnabled: true
  }).numCtx
}
