import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { streamChat, warmupModel } from './ollama-client.service'
import { buildPrompt, type AnalysisMode } from '../prompts/prompt-builder'
import { buildArbeitszeugnisVerifyPrompt } from '../prompts/arbeitszeugnis-verify.prompt'
import { extractJsonObject } from '../lib/extract-json'
import { logger } from './logger.service'
import type { Analysis, AnalysisRunResult } from '@shared/types'

const TRUNCATION_NOTICE =
  '\n\n---\n*Hinweis: Das Dokument überschreitet das Kontextfenster des Modells. ' +
  'Es wurde für diese Analyse am Ende gekürzt - das Ergebnis deckt nicht das gesamte Dokument ab. ' +
  'Für eine vollständige Analyse ein Modell mit größerem Kontextfenster wählen oder das Dokument teilen.*'

/**
 * Send an analysis:phase event to the renderer so the UI can show
 * "Analysiere..." vs "Verifiziere..." for two-pass modes.
 */
function sendPhase(win: BrowserWindow, phase: 'analyzing' | 'verifying'): void {
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
  return mode === 'arbeitszeugnis'
}

export async function runAnalysis(
  docId: string,
  mode: AnalysisMode,
  win: BrowserWindow,
  modelName: string,
  userQuestion?: string
): Promise<AnalysisRunResult> {
  const doc = getDocumentById(docId)
  if (!doc) throw new Error(`Dokument ${docId} nicht gefunden`)
  if (!doc.extractedText) throw new Error('Dokument hat keinen extrahierten Text')

  const language = doc.detectedLanguage || 'de'
  const { system, user, temperature, numCtx, truncated } = buildPrompt(
    mode,
    doc.extractedText,
    language,
    userQuestion
  )

  if (truncated) {
    logger.warn('analysis.service', 'Document truncated to fit context window', {
      docId,
      mode,
      textLength: doc.extractedText.length,
      numCtx
    })
  }

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

  sendPhase(win, 'analyzing')

  // -------------- PASS 1: Main analysis --------------
  const { text: pass1Response, aborted: pass1Aborted } = await streamChat({
    model: modelName,
    system,
    prompt: user,
    win,
    temperature,
    numCtx,
    channel: 'analysis:chunk'
  })

  // If aborted during pass 1, save what we have and return immediately
  if (pass1Aborted) {
    return persistAnalysis(docId, mode, user, pass1Response, modelName, startTime, true)
  }

  if (pass1Response.trim().length === 0) {
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
  let finalResponse = pass1Response
  let verifyAborted = false

  if (mode === 'arbeitszeugnis') {
    sendPhase(win, 'verifying')
    logger.info('analysis.service', 'Starting verification pass', { docId })

    try {
      const verifyPrompts = buildArbeitszeugnisVerifyPrompt(doc.extractedText, pass1Response)
      const verifyResult = await streamChat({
        model: modelName,
        system: verifyPrompts.system,
        prompt: verifyPrompts.user,
        win,
        temperature: 0.1, // even lower for verification
        numCtx,
        channel: 'analysis:chunk'
      })

      verifyAborted = verifyResult.aborted

      // Nur übernehmen, wenn Pass 2 ein nicht-leeres, parsebares JSON-Objekt
      // liefert - sonst landet Prosa ("Here is the cleaned JSON: ...") in der DB
      // und der Renderer kann das Ergebnis nicht mehr strukturiert anzeigen.
      // (Frueher zusaetzlich willkuerliche Laengenschwelle >100 - entfernt,
      // ein gueltiges JSON-Objekt ist das richtige Kriterium.)
      const verifyJson = verifyAborted ? null : extractJsonObject(verifyResult.text)
      if (verifyJson !== null && Object.keys(verifyJson).length > 0) {
        finalResponse = verifyResult.text
        logger.info('analysis.service', 'Verification pass completed', {
          docId,
          pass1Length: pass1Response.length,
          finalLength: finalResponse.length
        })
      } else if (!verifyAborted) {
        logger.warn('analysis.service', 'Verification pass returned no valid JSON, using pass 1', {
          docId,
          verifyLength: verifyResult.text.length
        })
      } else {
        logger.info('analysis.service', 'Verification pass aborted, using pass 1', { docId })
      }
    } catch (err) {
      logger.warn('analysis.service', 'Verification pass failed, using pass 1', {
        docId,
        error: err instanceof Error ? err.message : String(err)
      })
      // Non-fatal: we still have pass 1 result
    }
  }

  // Truncation-Hinweis sichtbar ans Ergebnis hängen - ausser bei
  // Arbeitszeugnis, dessen Ergebnis als JSON geparst wird (Hinweis dort
  // würde den Parser gefährden; der Marker steckt bereits im Dokumenttext).
  if (truncated && mode !== 'arbeitszeugnis') {
    finalResponse += TRUNCATION_NOTICE
  }

  return persistAnalysis(docId, mode, user, finalResponse, modelName, startTime, verifyAborted)
}

function persistAnalysis(
  docId: string,
  mode: AnalysisMode,
  prompt: string,
  response: string,
  modelName: string,
  startTime: number,
  aborted: boolean
): AnalysisRunResult {
  const durationMs = Date.now() - startTime
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()

  const finalResult = aborted ? `${response}\n\n[Analyse vom Nutzer abgebrochen]` : response

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
