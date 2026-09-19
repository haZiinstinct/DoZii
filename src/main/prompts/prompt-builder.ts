import type { AnalysisMode, LetterKind } from '@shared/types'

export type { AnalysisMode }

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
import { buildPlainLanguagePrompt } from './plain-language.prompt'
import { buildContractCheckPrompt } from './contract-check.prompt'
import { buildLetterPrompt } from './letter.prompt'
import { estimateTokens, fitTextToTokenBudget } from './token-budget'
import {
  DEFAULT_NUM_CTX,
  JSON_RESPONSE_RESERVE_TOKENS,
  RESPONSE_RESERVE_TOKENS
} from '../config/constants'

// Per-mode Ollama parameters. temperature ist modus-spezifisch
// (niedrig = deterministisch/treu). num_ctx kommt seit v1.3 aus dem Modell
// (context-window.service) und wird hier nur als Default gehalten - Ollamas
// eigener Default (2048) wuerde lange Dokumente still abschneiden.
const MODE_PARAMS: Record<AnalysisMode, { temperature: number; numCtx: number }> = {
  plain: { temperature: 0.2, numCtx: DEFAULT_NUM_CTX },
  grammar: { temperature: 0.1, numCtx: DEFAULT_NUM_CTX },
  formulation: { temperature: 0.3, numCtx: DEFAULT_NUM_CTX },
  arbeitszeugnis: { temperature: 0.15, numCtx: DEFAULT_NUM_CTX },
  contract: { temperature: 0.15, numCtx: DEFAULT_NUM_CTX },
  summary: { temperature: 0.15, numCtx: DEFAULT_NUM_CTX },
  freeform: { temperature: 0.2, numCtx: DEFAULT_NUM_CTX },
  // Briefe duerfen etwas freier formulieren, aber keine Fakten erfinden.
  letter: { temperature: 0.35, numCtx: DEFAULT_NUM_CTX }
}

/**
 * So viel Dokument bekommt das Modell mindestens zu sehen, auch wenn das
 * Prompt-Geruest rechnerisch schon das ganze Fenster fuellt. ~1750 Zeichen.
 */
const MIN_DOCUMENT_TOKENS = 500

/** Zusatzinformationen, die nur einzelne Modi brauchen. */
export interface BuildPromptOptions {
  userQuestion?: string
  /** Nur mode 'letter'. */
  letterKind?: LetterKind
  /** Nur mode 'letter': Ergebnis einer vorherigen Analyse als Beleg-Basis. */
  priorAnalysis?: string
  /** Nur mode 'letter': Freitext des Nutzers. */
  userNotes?: string
  /** Heutiges Datum (YYYY-MM-DD). Wird hereingereicht, nie im Prompt-Modul gebildet. */
  todayIso?: string
  /** Aus dem Modell ermitteltes Kontextfenster; ueberschreibt den Default. */
  numCtx?: number
}

function buildPair(
  mode: AnalysisMode,
  text: string,
  language: string,
  options: BuildPromptOptions
): PromptPair {
  switch (mode) {
    case 'plain':
      return buildPlainLanguagePrompt(text, language)
    case 'grammar':
      return buildGrammarPrompt(text, language)
    case 'formulation':
      return buildFormulationPrompt(text, language)
    case 'arbeitszeugnis':
      return buildArbeitszeugnisPrompt(text)
    case 'contract':
      return buildContractCheckPrompt(text, language)
    case 'summary':
      return buildSummaryPrompt(text, language)
    case 'letter':
      return buildLetterPrompt({
        documentText: text,
        kind: options.letterKind ?? 'allgemein',
        language,
        priorAnalysis: options.priorAnalysis,
        userNotes: options.userNotes,
        todayIso: options.todayIso ?? '1970-01-01'
      })
    case 'freeform':
      return buildFreeformPrompt(text, language, options.userQuestion)
    default:
      return { system: 'Du bist ein Dokumentenassistent.', user: text }
  }
}

export function buildPrompt(
  mode: AnalysisMode,
  text: string,
  language: string,
  options: BuildPromptOptions = {}
): PromptConfig {
  const params = MODE_PARAMS[mode] || MODE_PARAMS.freeform
  const numCtx = options.numCtx ?? params.numCtx

  let pair = buildPair(mode, text, language, options)
  let truncated = false

  // Passt System + User + Antwort-Reserve nicht in num_ctx, wird das Dokument
  // kontrolliert gekuerzt und der Prompt neu gebaut (statt dass Ollama still
  // den Anfang - sprich System-Prompt + Dokumentkopf - verwirft).
  // Der Aufrufer (analysis.service) prueft vorher, ob stattdessen Chunking
  // sinnvoller ist; hier bleibt das Kuerzen als letzte Absicherung.
  const reserve = responseReserveTokens(mode)
  const totalTokens = estimateTokens(pair.system) + estimateTokens(pair.user) + reserve
  if (totalTokens > numCtx) {
    // Untergrenze: ohne sie kann das Budget bei grossem Prompt-Geruest null
    // oder negativ werden - das Modell bekaeme dann NUR die Anweisungen und
    // gar kein Dokument und wuerde munter etwas erfinden. Lieber ein kurzer
    // Ausschnitt plus der sichtbare Kuerzungs-Hinweis.
    const rawBudget = numCtx - reserve - templateOverheadTokens(pair, text)
    const textBudget = Math.max(MIN_DOCUMENT_TOKENS, rawBudget)
    const fitted = fitTextToTokenBudget(text, textBudget)
    pair = buildPair(mode, fitted.text, language, options)
    truncated = fitted.truncated
  }

  return { ...pair, temperature: params.temperature, numCtx, truncated }
}

/**
 * Wie viel Platz die Antwort dieses Modus braucht.
 *
 * Zeugnis-Decoder und Vertrags-Check bauen ein vollstaendiges JSON-Objekt mit
 * Abschnitten, Zitaten und Begruendungen - gemessen 5000 bis 6000 Tokens. Die
 * uebrigen Modi liefern Fliesstext und kommen mit deutlich weniger aus.
 */
export function responseReserveTokens(mode: AnalysisMode): number {
  return mode === 'arbeitszeugnis' || mode === 'contract'
    ? JSON_RESPONSE_RESERVE_TOKENS
    : RESPONSE_RESERVE_TOKENS
}

/** Tokens, die Prompt-Geruest und Zusatzangaben belegen - also alles ausser dem Dokument. */
function templateOverheadTokens(pair: PromptPair, text: string): number {
  return estimateTokens(pair.system) + estimateTokens(pair.user) - estimateTokens(text)
}

/**
 * Tokens, die Prompt-Geruest und Zusatzangaben belegen - gemessen an einem
 * Prompt mit LEEREM Dokument, also ohne die Kuerzungs-Nebenwirkung von
 * buildPrompt().
 */
export function promptOverheadTokens(
  mode: AnalysisMode,
  language: string,
  options: BuildPromptOptions = {}
): number {
  const skeleton = buildPair(mode, '', language, options)
  return estimateTokens(skeleton.system) + estimateTokens(skeleton.user)
}

/**
 * Wie viele Tokens das Dokument bei diesem Modus hoechstens belegen darf.
 * Der Aufrufer entscheidet damit, ob gechunkt werden muss.
 *
 * Kann 0 werden, wenn das Prompt-Geruest allein schon groesser ist als das
 * Kontextfenster (der Arbeitszeugnis-Prompt misst rund 4300 Tokens). Der
 * Aufrufer muss das abfangen - ein Budget von 0 hiesse, dass das Modell das
 * Dokument gar nicht zu sehen bekommt.
 */
export function documentTokenBudget(
  mode: AnalysisMode,
  language: string,
  numCtx: number,
  options: BuildPromptOptions = {}
): number {
  return Math.max(
    0,
    numCtx - responseReserveTokens(mode) - promptOverheadTokens(mode, language, options)
  )
}
