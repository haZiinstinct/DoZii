export type AnalysisMode = 'grammar' | 'formulation' | 'arbeitszeugnis' | 'summary' | 'freeform'

export interface PromptPair {
  system: string
  user: string
}

export interface PromptConfig extends PromptPair {
  temperature: number
  numCtx: number
}

import { buildGrammarPrompt } from './grammar-check.prompt'
import { buildFormulationPrompt } from './formulation.prompt'
import { buildArbeitszeugnisPrompt } from './arbeitszeugnis.prompt'
import { buildSummaryPrompt } from './summary.prompt'
import { buildFreeformPrompt } from './freeform.prompt'

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

export function buildPrompt(
  mode: AnalysisMode,
  text: string,
  language: string,
  userQuestion?: string
): PromptConfig {
  const params = MODE_PARAMS[mode] || MODE_PARAMS.freeform

  let pair: PromptPair
  switch (mode) {
    case 'grammar':
      pair = buildGrammarPrompt(text, language)
      break
    case 'formulation':
      pair = buildFormulationPrompt(text, language)
      break
    case 'arbeitszeugnis':
      pair = buildArbeitszeugnisPrompt(text)
      break
    case 'summary':
      pair = buildSummaryPrompt(text, language)
      break
    case 'freeform':
      pair = buildFreeformPrompt(text, language, userQuestion)
      break
    default:
      pair = { system: 'Du bist ein Dokumentenassistent.', user: text }
  }

  return { ...pair, ...params }
}
