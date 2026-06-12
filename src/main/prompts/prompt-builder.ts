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

// Reserve fuer die Modell-Antwort innerhalb von num_ctx
const RESPONSE_RESERVE_TOKENS = 1500

// Per-mode Ollama parameters. num_ctx=8192 is critical: the default is often
// 2048 which silently truncates long documents.
// num_ctx=8192 is critical: Ollama default is 2048 which silently truncates
// long documents. temperature is mode-specific: low = deterministic/faithful.
const MODE_PARAMS: Record<AnalysisMode, { temperature: number; numCtx: number }> = {
  grammar: { temperature: 0.1, numCtx: 8192 },
  formulation: { temperature: 0.3, numCtx: 8192 },
  arbeitszeugnis: { temperature: 0.15, numCtx: 8192 },
  summary: { temperature: 0.15, numCtx: 8192 },
  freeform: { temperature: 0.2, numCtx: 8192 }
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
