import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { getSettings } from './settings.service'
import { streamChat, warmupModel, chatOnce, showModel, isAbortError } from './ollama-client.service'
import { getModelContextLimit } from './context-window.service'
import { scanDeadlines, todayIso } from './deadline.service'
import {
  buildPrompt,
  documentTokenBudget,
  promptOverheadTokens,
  responseReserveTokens,
  type AnalysisMode,
  type BuildPromptOptions
} from '../prompts/prompt-builder'
import { buildArbeitszeugnisVerifyPrompt } from '../prompts/arbeitszeugnis-verify.prompt'
import { buildJsonReducePrompt, buildMarkdownReducePrompt } from '../prompts/chunk-reduce.prompt'
import { PLAIN_HEADINGS_DE, PLAIN_HEADINGS_EN } from '../prompts/plain-language.prompt'
import { estimateTokens } from '../prompts/token-budget'
import { splitIntoChunks } from '@shared/chunk-text'
import { pickNumCtx } from '@shared/context-window-calc'
import { isHeavyModeCapable } from '@shared/model-catalog'
import { extractJsonObject } from '../lib/extract-json'
import { logger } from './logger.service'
import {
  CHARS_PER_TOKEN,
  CHUNK_OVERLAP_TOKENS,
  MAX_CHUNKS,
  RESPONSE_RESERVE_TOKENS
} from '../config/constants'
import { freemem } from 'os'
import type {
  Analysis,
  AnalysisExtra,
  AnalysisNotice,
  AnalysisPhaseEvent,
  AnalysisRunResult
} from '@shared/types'

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

/** Trenner zwischen Teilergebnissen, wenn das Zusammenfuehren nicht zustande kam. */
const CHUNK_SEPARATOR = ['', '', '---', '', ''].join('\n')

/** Modi, nach denen es sich lohnt, automatisch nach Fristen zu suchen. */
const DEADLINE_MODES = new Set<AnalysisMode>(['plain', 'summary', 'contract'])

/** Modi mit JSON-Ausgabe (fuer das Zusammenfuehren relevant). */
const JSON_MODES = new Set<AnalysisMode>(['arbeitszeugnis', 'contract'])

function sendPhase(win: BrowserWindow, phase: AnalysisPhaseEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send('analysis:phase', phase)
  }
}

function isHeavyMode(mode: AnalysisMode): boolean {
  return mode === 'arbeitszeugnis' || mode === 'contract'
}

/**
 * Ermittelt das Kontextfenster fuer diesen Lauf. Frueher fest 8192 - moderne
 * Modelle koennen ein Vielfaches, und genau davon leben lange Vertraege.
 */
async function resolveNumCtx(
  modelName: string,
  neededTokens: number,
  minimumTokens: number
): Promise<number> {
  const settings = getSettings()
  const modelContextLimit = await getModelContextLimit(modelName, showModel)
  const decision = pickNumCtx({
    modelContextLimit,
    neededTokens,
    minimumTokens,
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

/**
 * Wie viel Dokument mindestens ins Fenster passen muss, damit eine Analyse
 * sinnvoll ist. Rund zwei Seiten - darunter bewertet das Modell einen
 * Ausschnitt und nennt das Ergebnis trotzdem eine Note.
 */
const MIN_DOCUMENT_TOKENS_FOR_MODE = 1500

/** Grober Aufschlag fuer das Geruest des Zusammenfuehren-Prompts. */
const REDUCE_OVERHEAD_TOKENS = 900

/**
 * Nimmt so viele Teilergebnisse, wie ins Budget passen - von vorne, damit der
 * Anfang des Dokuments erhalten bleibt. Passt nicht einmal das erste hinein,
 * wird es gekuerzt: ein gekuerztes erstes Teilergebnis ist immer noch besser
 * als eine Antwort, aus der Ollama den halben Prompt geworfen hat.
 */
function fitPartialsToBudget(partials: string[], budgetTokens: number): string[] {
  if (budgetTokens <= 0) return partials.slice(0, 1)
  const kept: string[] = []
  let used = 0
  for (const partial of partials) {
    const cost = estimateTokens(partial)
    if (used + cost > budgetTokens) break
    kept.push(partial)
    used += cost
  }
  if (kept.length === 0) {
    const maxChars = Math.floor(budgetTokens * CHARS_PER_TOKEN)
    return [partials[0].slice(0, Math.max(0, maxChars))]
  }
  return kept
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
}): Promise<{ text: string; aborted: boolean; chunkCount: number; truncatedChunks: number }> {
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
  // splitIntoChunks haelt MAX_CHUNKS ein, indem es die Abschnitte VERGROESSERT.
  // Bei sehr langen Dokumenten sind sie danach groesser als das Token-Budget
  // und buildPrompt kuerzt sie erneut. Das wurde frueher verschluckt - das
  // Ergebnis behauptete Vollstaendigkeit, obwohl mehr als die Haelfte des
  // Vertrags nie beim Modell ankam.
  let truncatedChunks = 0
  for (const chunk of chunks) {
    sendPhase(win, { kind: 'chunk', current: chunk.index + 1, total: chunks.length })
    const prompt = buildPrompt(mode, chunk.text, language, { ...options, numCtx })
    if (prompt.truncated) truncatedChunks++
    try {
      const partial = await chatOnce({
        model: modelName,
        system: prompt.system,
        prompt: prompt.user,
        temperature: prompt.temperature,
        numCtx
      })
      if (partial.trim().length > 0) partials.push(partial)
    } catch (err) {
      // Stopp-Knopf waehrend der Abschnitts-Analyse: das ist kein Fehler.
      // Ohne diese Unterscheidung bekaeme der Nutzer eine rote Fehlermeldung,
      // obwohl er selbst abgebrochen hat - und die bereits fertigen Abschnitte
      // waeren verloren.
      if (isAbortError(err)) {
        logger.info('analysis.service', 'Chunked-Analyse abgebrochen', {
          fertigeAbschnitte: partials.length,
          gesamt: chunks.length
        })
        return {
          text: partials.join(CHUNK_SEPARATOR),
          aborted: true,
          chunkCount: chunks.length,
          truncatedChunks
        }
      }
      throw err
    }
  }

  if (partials.length === 0) {
    return { text: '', aborted: false, chunkCount: chunks.length, truncatedChunks }
  }
  if (partials.length === 1) {
    return { text: partials[0], aborted: false, chunkCount: chunks.length, truncatedChunks }
  }

  sendPhase(win, { kind: 'merging' })
  // Auch das Zusammenfuehren muss ins Kontextfenster passen. Zwoelf
  // Teilergebnisse koennen zusammen groesser sein als das Fenster - Ollama
  // wuerde dann die ERSTEN stillschweigend verwerfen, also ausgerechnet den
  // Anfang des Dokuments. Lieber vorher kuerzen und es sagen.
  const reduceBudget = numCtx - RESPONSE_RESERVE_TOKENS - REDUCE_OVERHEAD_TOKENS
  const fittedPartials = fitPartialsToBudget(partials, reduceBudget)
  if (fittedPartials.length < partials.length) {
    logger.warn('analysis.service', 'Teilergebnisse fuers Zusammenfuehren gekuerzt', {
      von: partials.length,
      auf: fittedPartials.length,
      reduceBudget
    })
  }
  const reduce = JSON_MODES.has(mode)
    ? buildJsonReducePrompt(fittedPartials, language)
    : buildMarkdownReducePrompt(fittedPartials, language, markdownFormatReminder(mode, language))

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
      text: partials.join(CHUNK_SEPARATOR),
      aborted: merged.aborted,
      chunkCount: chunks.length,
      truncatedChunks
    }
  }
  return {
    text: merged.text,
    aborted: merged.aborted,
    chunkCount: chunks.length,
    truncatedChunks
  }
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
  //
  // Wichtig: der Bedarf wird am UNGEKUERZTEN Dokument gemessen. Frueher lief
  // dafuer buildPrompt() - das kuerzt aber bereits auf den Default von 8192,
  // sodass der gemessene Bedarf nie darueber lag und die Automatik das Fenster
  // nie vergroessert hat. Die Funktion war damit wirkungslos.
  const promptOverhead = promptOverheadTokens(mode, language, options)
  const neededTokens =
    promptOverhead + estimateTokens(doc.extractedText) + responseReserveTokens(mode)
  // Ohne dieses Minimum bleibt beim Zeugnis-Modus kein Platz fuer das
  // Dokument - das Modell benotet dann einen Dreizeiler.
  const minimumTokens = promptOverhead + responseReserveTokens(mode) + MIN_DOCUMENT_TOKENS_FOR_MODE
  const numCtx = await resolveNumCtx(modelName, neededTokens, minimumTokens)

  // Small model on heavy mode: warn but don't block. User may have chosen it intentionally.
  if (isHeavyMode(mode) && !isHeavyModeCapable(modelName)) {
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
  let truncatedChunks = 0
  // Der tatsaechlich benutzte User-Prompt - wird zur Nachvollziehbarkeit
  // mitgespeichert. Im Chunk-Pfad steht dort nur eine Notiz statt zwoelf
  // vollstaendiger Prompts.
  let promptForRecord: string

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
    truncatedChunks = chunked.truncatedChunks
    promptForRecord = `[${chunked.chunkCount} Abschnitte, Modus ${mode}]`
    if (truncatedChunks > 0) {
      logger.warn('analysis.service', 'Abschnitte mussten zusaetzlich gekuerzt werden', {
        docId,
        mode,
        truncatedChunks,
        chunkCount
      })
    }
  } else {
    const prompt = buildPrompt(mode, doc.extractedText, language, { ...options, numCtx })
    truncated = prompt.truncated
    promptForRecord = prompt.user
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
      return persistAnalysis({
        docId,
        mode,
        prompt: prompt.user,
        response: pass1.text,
        modelName,
        startTime,
        aborted: true
      })
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

  const result = persistAnalysis({
    docId,
    mode,
    prompt: promptForRecord,
    response: finalResponse,
    modelName,
    startTime,
    aborted,
    notice: { truncated, chunks: chunkCount, truncatedChunks }
  })

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
  const result = await scanDeadlines(docId, modelName)
  if (!win.isDestroyed()) {
    win.webContents.send('deadlines:updated', {
      documentId: docId,
      count: result.deadlines.length,
      ok: result.ok
    })
  }
}

function persistAnalysis(params: {
  docId: string
  mode: AnalysisMode
  prompt: string
  response: string
  modelName: string
  startTime: number
  aborted: boolean
  notice?: AnalysisNotice
}): AnalysisRunResult {
  const { docId, mode, prompt, response, modelName, startTime, aborted, notice } = params
  const durationMs = Date.now() - startTime
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()

  let finalResult = response
  if (notice && notice.chunks > 1) {
    // Der Vorbehalt steht zusaetzlich im Text, damit er auch im Export
    // (PDF, RTF, Markdown) mitgeht - die Oberflaeche zeigt ihn uebersetzt
    // aus dem `notice`-Feld.
    finalResult += `

---
*Hinweis: Das Dokument war zu lang für einen Durchgang und wurde in ${notice.chunks} Abschnitten analysiert und anschließend zusammengeführt.*`
    if (notice.truncatedChunks > 0) {
      finalResult += `
*${notice.truncatedChunks} dieser Abschnitte mussten zusätzlich gekürzt werden - dieser Teil des Dokuments wurde nicht gelesen.*`
    }
  }
  if (aborted) {
    finalResult += `

[Analyse vom Nutzer abgebrochen]`
  }

  // Nur speichern, wenn es wirklich etwas anzumerken gibt.
  const hasNotice =
    notice !== undefined && (notice.truncated || notice.chunks > 1 || notice.truncatedChunks > 0)

  const analysisRow: typeof schema.analyses.$inferInsert = {
    id,
    documentId: docId,
    mode,
    prompt,
    result: finalResult,
    structuredResult: null,
    modelUsed: modelName,
    durationMs,
    notice: hasNotice ? JSON.stringify(notice) : null,
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
