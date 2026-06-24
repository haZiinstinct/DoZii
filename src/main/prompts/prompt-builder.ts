export type AnalysisMode = 'grammar' | 'formulation' | 'arbeitszeugnis' | 'summary' | 'freeform'

export interface PromptPair {
  system: string
  user: string
}

export interface PromptConfig extends PromptPair {
  temperature: number
  numCtx: number
  /** true wenn das Dokument fuers Kontextfenster gekuerzt werden musste */
  truncated: boolean
}

import { buildGrammarPrompt } from './grammar-check.prompt'
import { buildFormulationPrompt } from './formulation.prompt'
import { buildArbeitszeugnisPrompt } from './arbeitszeugnis.prompt'
import { buildSummaryPrompt } from './summary.prompt'
import { buildFreeformPrompt } from './freeform.prompt'
import { estimateTokens, fitTextToTokenBudget } from './token-budget'
import { DEFAULT_NUM_CTX, RESPONSE_RESERVE_TOKENS } from '../config/constants'

// Per-mode Ollama parameters. num_ctx (DEFAULT_NUM_CTX) ist kritisch: Ollama-Default
// (2048) wuerde lange Dokumente still abschneiden. temperature ist modus-spezifisch
// (niedrig = deterministisch/treu).
const MODE_PARAMS: Record<AnalysisMode, { temperature: number; numCtx: number }> = {
  grammar: { temperature: 0.1, numCtx: DEFAULT_NUM_CTX },
  formulation: { temperature: 0.3, numCtx: DEFAULT_NUM_CTX },
  arbeitszeugnis: { temperature: 0.15, numCtx: DEFAULT_NUM_CTX },
  summary: { temperature: 0.15, numCtx: DEFAULT_NUM_CTX },
  freeform: { temperature: 0.2, numCtx: DEFAULT_NUM_CTX }
}

function buildPair(
  mode: AnalysisMode,
  text: string,
  language: string,
  userQuestion?: string
): PromptPair {
  switch (mode) {
    case 'grammar':
      return buildGrammarPrompt(text, language)
    case 'formulation':
      return buildFormulationPrompt(text, language)
    case 'arbeitszeugnis':
      return buildArbeitszeugnisPrompt(text)
    case 'summary':
      return buildSummaryPrompt(text, language)
    case 'freeform':
      return buildFreeformPrompt(text, language, userQuestion)
    default:
      return { system: 'Du bist ein Dokumentenassistent.', user: text }
  }
}

export function buildPrompt(
  mode: AnalysisMode,
  text: string,
  language: string,
  userQuestion?: string
): PromptConfig {
  const params = MODE_PARAMS[mode] || MODE_PARAMS.freeform

  let pair = buildPair(mode, text, language, userQuestion)
  let truncated = false

  // Passt System + User + Antwort-Reserve nicht in num_ctx, wird das Dokument
  // kontrolliert gekuerzt und der Prompt neu gebaut (statt dass Ollama still
  // den Anfang - sprich System-Prompt + Dokumentkopf - verwirft).
  const totalTokens =
    estimateTokens(pair.system) + estimateTokens(pair.user) + RESPONSE_RESERVE_TOKENS
  if (totalTokens > params.numCtx) {
    const templateOverhead =
      estimateTokens(pair.system) + estimateTokens(pair.user) - estimateTokens(text)
    const textBudget = params.numCtx - RESPONSE_RESERVE_TOKENS - templateOverhead
    const fitted = fitTextToTokenBudget(text, textBudget)
    pair = buildPair(mode, fitted.text, language, userQuestion)
    truncated = fitted.truncated
  }

  return { ...pair, ...params, truncated }
}
