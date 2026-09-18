import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { getSettings } from './settings.service'
import { streamChat, warmupModel, chatOnce, showModel } from './ollama-client.service'
import { getModelContextLimit } from './context-window.service'
import { scanDeadlines, todayIso } from './deadline.service'
import {
  buildPrompt,
  documentTokenBudget,
  type AnalysisMode,
  type BuildPromptOptions
} from '../prompts/prompt-builder'
import { buildArbeitszeugnisVerifyPrompt } from '../prompts/arbeitszeugnis-verify.prompt'
import { buildJsonReducePrompt, buildMarkdownReducePrompt } from '../prompts/chunk-reduce.prompt'
import { PLAIN_HEADINGS_DE, PLAIN_HEADINGS_EN } from '../prompts/plain-language.prompt'
import { estimateTokens } from '../prompts/token-budget'
import { splitIntoChunks } from '@shared/chunk-text'
import { pickNumCtx } from '@shared/context-window-calc'
import { extractJsonObject } from '../lib/extract-json'
import { logger } from './logger.service'
import { CHUNK_OVERLAP_TOKENS, MAX_CHUNKS, RESPONSE_RESERVE_TOKENS } from '../config/constants'
import { freemem } from 'os'
import type { Analysis, AnalysisExtra, AnalysisPhaseEvent, AnalysisRunResult } from '@shared/types'

const TRUNCATION_NOTICE =
  '\n\n---\n*Hinweis: Das Dokument überschreitet das Kontextfenster des Modells. ' +
  'Es wurde für diese Analyse am Ende gekürzt - das Ergebnis deckt nicht das gesamte Dokument ab. ' +
  'Für eine vollständige Analyse ein Modell mit größerem Kontextfenster wählen oder das Dokument teilen.*'

/**
 * Modi, deren Ausgabe sich abschnittsweise erzeugen und danach zusammenfuehren
 * laesst. Das Arbeitszeugnis fehlt bewusst: Zeugnisse sind kurz, und die
 * Gesamtnote braucht das vollstaendige Dokument in einem Durchgang.
 * `letter` ebenfalls nicht - ein Brief wird als Ganzes geschrieben.
 */
const CHUNKABLE_MODES = new Set<AnalysisMode>(['plain', 'summary', 'contract'])

/** Modi, nach denen es sich lohnt, automatisch nach Fristen zu suchen. */
const DEADLINE_MODES = new Set<AnalysisMode>(['plain', 'summary', 'contract'])

/** Modi mit JSON-Ausgabe (fuer das Zusammenfuehren relevant). */
const JSON_MODES = new Set<AnalysisMode>(['arbeitszeugnis', 'contract'])

function sendPhase(win: BrowserWindow, phase: AnalysisPhaseEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send('analysis:phase', phase)
  }
}

/**
 * Small models that struggle with heavy analysis modes (especially Arbeitszeugnis
 * which has a ~15 KB system prompt). We log a warning but still run.
 */
const SMALL_MODELS_FOR_HEAVY_MODE = new Set([
  'gemma3:1b',
  'gemma2:2b',
  'llama3.2:1b',
  'llama3.2:3b',
  'phi3:mini',
  'phi3.5:mini',
  'qwen2.5:1.5b',
  'qwen2.5:3b'
])

function isHeavyMode(mode: AnalysisMode): boolean {
  return mode === 'arbeitszeugnis' || mode === 'contract'
}

/**
 * Ermittelt das Kontextfenster fuer diesen Lauf. Frueher fest 8192 - moderne
 * Modelle koennen ein Vielfaches, und genau davon leben lange Vertraege.
 */
async function resolveNumCtx(modelName: string, neededTokens: number): Promise<number> {
  const settings = getSettings()
  const modelContextLimit = await getModelContextLimit(modelName, showModel)
  const decision = pickNumCtx({
    modelContextLimit,
    neededTokens,
    freeRamGb: freemem() / 1024 ** 3,
    autoEnabled: settings.autoContextWindow
  })
  logger.info('analysis.service', 'Kontextfenster gewaehlt', {
    model: modelName,
    modelContextLimit,
    neededTokens,
    numCtx: decision.numCtx,
    capped: decision.capped,
    reason: decision.reason
  })
  return decision.numCtx
}

/** Ueberschriften-Geruest fuer das Zusammenfuehren von Markdown-Teilergebnissen. */
function markdownFormatReminder(mode: AnalysisMode, language: string): string {
  if (mode === 'plain') {
    const h = language === 'de' ? PLAIN_HEADINGS_DE : PLAIN_HEADINGS_EN
    return [
      h.headline,
      h.urgency,
      h.about,
      h.demand,
      h.ifNothing,
      h.actions,
      h.facts,
      h.terms,
      h.gaps
    ]
      .map((heading) => `## ${heading}`)
      .join('\n\n')
  }
  // summary
  const headings =
    language === 'de'
      ? [
          'Dokumenttyp',
          'Wichtige Fakten',
          'Kernaussagen',
          'Zusammenfassung',
          'Handlungsbedarf',
          'Auffälligkeiten'
        ]
      : ['Document Type', 'Key Facts', 'Key Points', 'Summary', 'Action Items', 'Observations']
  return headings.map((heading) => `## ${heading}`).join('\n\n')
}

/**
 * Map-Reduce: Dokument in Abschnitte teilen, jeden einzeln analysieren, dann
 * zusammenfuehren. Nur das Zusammenfuehren wird gestreamt - die Teilergebnisse
 * wuerden den Nutzer sonst mit mehrfachen, widerspruechlichen Ausgaben verwirren.
 */
async function runChunked(params: {
  mode: AnalysisMode
  text: string
  language: string
  modelName: string
  numCtx: number
  win: BrowserWindow
  options: BuildPromptOptions
}): Promise<{ text: string; aborted: boolean; chunkCount: number }> {
  const { mode, text, language, modelName, numCtx, win, options } = params

  const budget = documentTokenBudget(mode, language, numCtx, options)
  const chunks = splitIntoChunks(text, {
    budgetTokens: budget,
    overlapTokens: CHUNK_OVERLAP_TOKENS,
    maxChunks: MAX_CHUNKS
  })

  logger.info('analysis.service', 'Chunked-Analyse gestartet', {
    mode,
    chunks: chunks.length,
    budget,
    numCtx
  })

  const partials: string[] = []
  for (const chunk of chunks) {
    sendPhase(win, { kind: 'chunk', current: chunk.index + 1, total: chunks.length })
    const prompt = buildPrompt(mode, chunk.text, language, { ...options, numCtx })
    const partial = await chatOnce({
      model: modelName,
      system: prompt.system,
      prompt: prompt.user,
      temperature: prompt.temperature,
      numCtx
    })
    if (partial.trim().length > 0) partials.push(partial)
  }

  if (partials.length === 0) {
    return { text: '', aborted: false, chunkCount: chunks.length }
  }
  if (partials.length === 1) {
    return { text: partials[0], aborted: false, chunkCount: chunks.length }
  }

  sendPhase(win, { kind: 'merging' })
  const reduce = JSON_MODES.has(mode)
    ? buildJsonReducePrompt(partials, language)
    : buildMarkdownReducePrompt(partials, language, markdownFormatReminder(mode, language))

  const merged = await streamChat({
    model: modelName,
    system: reduce.system,
    prompt: reduce.user,
    win,
    temperature: 0.1,
    numCtx,
    channel: 'analysis:chunk'
  })

  // Liefert das Zusammenfuehren nichts Brauchbares, sind die Teilergebnisse
  // immer noch besser als gar nichts.
  if (merged.text.trim().length === 0) {
    logger.warn('analysis.service', 'Zusammenfuehren lieferte leeren Text, nutze Teilergebnisse')
    return {
      text: partials.join('\n\n---\n\n'),
      aborted: merged.aborted,
      chunkCount: chunks.length
    }
  }
  return { text: merged.text, aborted: merged.aborted, chunkCount: chunks.length }
}

/** Ergebnis einer frueheren Analyse als Beleg-Basis fuer den Brief. */
function loadPriorAnalysis(analysisId: string | undefined): string | undefined {
  if (!analysisId) return undefined
  const db = getDb()
  const row = db.select().from(schema.analyses).where(eq(schema.analyses.id, analysisId)).get()
  return row?.result
}

export async function runAnalysis(
  docId: string,
  mode: AnalysisMode,
  win: BrowserWindow,
  modelName: string,
  userQuestion?: string,
  extra: AnalysisExtra = {}
): Promise<AnalysisRunResult> {
  const doc = getDocumentById(docId)
  if (!doc) throw new Error(`Dokument ${docId} nicht gefunden`)
  if (!doc.extractedText) throw new Error('Dokument hat keinen extrahierten Text')

  // Ausgabesprache folgt der gewaehlten UI-Sprache (settings.language), nicht
  // der erkannten Dokumentsprache. (Arbeitszeugnis ignoriert das bewusst und
  // bleibt deutsch; der Brief ebenso - Behoerden lesen deutsch.)
  const language = getSettings().language || 'de'

  const options: BuildPromptOptions = {
    userQuestion,
    letterKind: extra.letterKind,
    userNotes: extra.userNotes,
    priorAnalysis: loadPriorAnalysis(extra.sourceAnalysisId),
    todayIso: todayIso()
  }

  // Kontextfenster bestimmen: erst den Bedarf messen, dann das Fenster waehlen.
  const probe = buildPrompt(mode, doc.extractedText, language, options)
  const neededTokens =
    estimateTokens(probe.system) + estimateTokens(probe.user) + RESPONSE_RESERVE_TOKENS
  const numCtx = await resolveNumCtx(modelName, neededTokens)

  // Small model on heavy mode: warn but don't block. User may have chosen it intentionally.
  if (isHeavyMode(mode) && SMALL_MODELS_FOR_HEAVY_MODE.has(modelName)) {
    logger.warn('analysis.service', 'Heavy mode on small model - may fail or hallucinate', {
      mode,
      model: modelName,
      recommendation: 'Für beste Ergebnisse: llama3.1:8b oder mistral-small:24b'
    })
  }

  const startTime = Date.now()

  // Warmup: force the model to load into memory BEFORE the heavy request.
  // This avoids cold-load races that surface as "fetch failed" errors.
  await warmupModel(modelName)

  const docBudget = documentTokenBudget(mode, language, numCtx, options)
  const useChunking =
    CHUNKABLE_MODES.has(mode) && estimateTokens(doc.extractedText) > docBudget && docBudget > 0

  let finalResponse: string
  let aborted: boolean
  let truncated = false
  let chunkCount = 0

  if (useChunking) {
    const chunked = await runChunked({
      mode,
      text: doc.extractedText,
      language,
      modelName,
      numCtx,
      win,
      options
    })
    finalResponse = chunked.text
    aborted = chunked.aborted
    chunkCount = chunked.chunkCount
  } else {
    const prompt = buildPrompt(mode, doc.extractedText, language, { ...options, numCtx })
    truncated = prompt.truncated
    if (truncated) {
      logger.warn('analysis.service', 'Document truncated to fit context window', {
        docId,
        mode,
        textLength: doc.extractedText.length,
        numCtx
      })
    }

    sendPhase(win, { kind: 'analyzing' })

    // -------------- PASS 1: Main analysis --------------
    const pass1 = await streamChat({
      model: modelName,
      system: prompt.system,
      prompt: prompt.user,
      win,
      temperature: prompt.temperature,
      numCtx,
      channel: 'analysis:chunk'
    })
    finalResponse = pass1.text
    aborted = pass1.aborted

    // If aborted during pass 1, save what we have and return immediately
    if (pass1.aborted) {
      return persistAnalysis(docId, mode, prompt.user, pass1.text, modelName, startTime, true)
    }

    if (pass1.text.trim().length === 0) {
      logger.warn('analysis.service', 'Empty response from model in pass 1', {
        docId,
        mode,
        modelName
      })
      throw new Error(
        `Modell "${modelName}" hat keine Antwort geliefert. Mögliche Ursachen:\n` +
          '• Modell ist nicht geladen oder abgestürzt\n' +
          '• Nicht genug RAM/VRAM für dieses Modell\n' +
          '• Ollama-Server Problem'
      )
    }

    // -------------- PASS 2: Verification (Arbeitszeugnis only) --------------
    // For Arbeitszeugnis we run a separate verification pass with fresh context
    // that strips any finding not backed by an exact quote from the original.
    if (mode === 'arbeitszeugnis') {
      finalResponse = await runVerificationPass({
        docId,
        documentText: doc.extractedText,
        pass1Response: pass1.text,
        modelName,
        numCtx,
        win
      })
    }
  }

  if (finalResponse.trim().length === 0) {
    throw new Error(
      `Modell "${modelName}" hat keine Antwort geliefert. Mögliche Ursachen:\n` +
        '• Modell ist nicht geladen oder abgestürzt\n' +
        '• Nicht genug RAM/VRAM für dieses Modell\n' +
        '• Ollama-Server Problem'
    )
  }

  // Truncation-Hinweis sichtbar ans Ergebnis hängen - ausser bei Modi, deren
  // Ergebnis als JSON geparst wird (der Hinweis würde den Parser gefährden;
  // der Marker steckt bereits im Dokumenttext).
  if (truncated && !JSON_MODES.has(mode)) {
    finalResponse += TRUNCATION_NOTICE
  }

  const result = persistAnalysis(
    docId,
    mode,
    probe.user,
    finalResponse,
    modelName,
    startTime,
    aborted,
    chunkCount
  )

  // Fristen im Hintergrund suchen - das Analyseergebnis steht schon und soll
  // nicht darauf warten. Die UI bekommt Bescheid, sobald es Ergebnisse gibt.
  if (!aborted && DEADLINE_MODES.has(mode)) {
    void scanDeadlinesInBackground(docId, modelName, win)
  }

  return result
}

async function runVerificationPass(params: {
  docId: string
  documentText: string
  pass1Response: string
  modelName: string
  numCtx: number
  win: BrowserWindow
}): Promise<string> {
  const { docId, documentText, pass1Response, modelName, numCtx, win } = params
  sendPhase(win, { kind: 'verifying' })
  logger.info('analysis.service', 'Starting verification pass', { docId })

  try {
    const verifyPrompts = buildArbeitszeugnisVerifyPrompt(documentText, pass1Response)
    const verifyResult = await streamChat({
      model: modelName,
      system: verifyPrompts.system,
      prompt: verifyPrompts.user,
      win,
      temperature: 0.1, // even lower for verification
      numCtx,
      channel: 'analysis:chunk'
    })

    // Nur übernehmen, wenn Pass 2 ein nicht-leeres, parsebares JSON-Objekt
    // liefert - sonst landet Prosa ("Here is the cleaned JSON: ...") in der DB
    // und der Renderer kann das Ergebnis nicht mehr strukturiert anzeigen.
    const verifyJson = verifyResult.aborted ? null : extractJsonObject(verifyResult.text)
    if (verifyJson !== null && Object.keys(verifyJson).length > 0) {
      logger.info('analysis.service', 'Verification pass completed', {
        docId,
        pass1Length: pass1Response.length,
        finalLength: verifyResult.text.length
      })
      return verifyResult.text
    }
    logger.warn('analysis.service', 'Verification pass returned no valid JSON, using pass 1', {
      docId,
      aborted: verifyResult.aborted
    })
  } catch (err) {
    logger.warn('analysis.service', 'Verification pass failed, using pass 1', {
      docId,
      error: err instanceof Error ? err.message : String(err)
    })
    // Non-fatal: we still have pass 1 result
  }
  return pass1Response
}

async function scanDeadlinesInBackground(
  docId: string,
  modelName: string,
  win: BrowserWindow
): Promise<void> {
  sendPhase(win, { kind: 'deadlines' })
  const deadlines = await scanDeadlines(docId, modelName)
  if (!win.isDestroyed()) {
    win.webContents.send('deadlines:updated', { documentId: docId, count: deadlines.length })
  }
}

function persistAnalysis(
  docId: string,
  mode: AnalysisMode,
  prompt: string,
  response: string,
  modelName: string,
  startTime: number,
  aborted: boolean,
  chunkCount = 0
): AnalysisRunResult {
  const durationMs = Date.now() - startTime
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()

  let finalResult = response
  if (chunkCount > 1) {
    // Ehrlichkeit gegenueber dem Nutzer: ein zusammengefuehrtes Ergebnis ist
    // nicht dasselbe wie eine Analyse in einem Durchgang.
    finalResult += `\n\n---\n*Hinweis: Das Dokument war zu lang für einen Durchgang und wurde in ${chunkCount} Abschnitten analysiert und anschließend zusammengeführt.*`
  }
  if (aborted) {
    finalResult += '\n\n[Analyse vom Nutzer abgebrochen]'
  }

  const analysisRow: typeof schema.analyses.$inferInsert = {
    id,
    documentId: docId,
    mode,
    prompt,
    result: finalResult,
    structuredResult: null,
    modelUsed: modelName,
    durationMs,
    createdAt: now
  }

  db.insert(schema.analyses).values(analysisRow).run()
  return { analysis: analysisRow as Analysis, aborted }
}

export function getAnalysisHistory(docId: string): Analysis[] {
  const db = getDb()
  return db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.documentId, docId))
    .orderBy(desc(schema.analyses.createdAt))
    .all() as Analysis[]
}

export function getAllAnalyses(): Analysis[] {
  const db = getDb()
  return db
    .select()
    .from(schema.analyses)
    .orderBy(desc(schema.analyses.createdAt))
    .all() as Analysis[]
}
