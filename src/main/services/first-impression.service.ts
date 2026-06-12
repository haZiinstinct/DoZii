import { Ollama } from 'ollama'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { buildFirstImpressionPrompt } from '../prompts/first-impression.prompt'
import { extractJsonObject } from '../lib/extract-json'
import { logger } from './logger.service'
import type { FirstImpression, AnalysisMode } from '@shared/types'

const ALLOWED_MODES = new Set<AnalysisMode>([
  'grammar',
  'formulation',
  'arbeitszeugnis',
  'summary',
  'freeform'
])

let client: Ollama | null = null
function getClient(): Ollama {
  if (!client) client = new Ollama({ host: 'http://localhost:11434' })
  return client
}

/**
 * Load an existing first impression for the given document, or null.
 */
export function getFirstImpression(documentId: string): FirstImpression | null {
  const db = getDb()
  const row = db
    .select()
    .from(schema.firstImpressions)
    .where(eq(schema.firstImpressions.documentId, documentId))
    .get()
  if (!row) return null
  return {
    documentId: row.documentId,
    documentType: row.documentType,
    recommendedMode: row.recommendedMode as AnalysisMode,
    firstImpression: row.firstImpression,
    modelUsed: row.modelUsed,
    createdAt: row.createdAt
  }
}

/**
 * Generate a first impression for a document. Non-blocking, non-fatal:
 * if anything fails (no model, Ollama down, JSON parse error), we log and
 * return null - the feature is optional.
 */
export async function generateFirstImpression(
  documentId: string,
  model: string
): Promise<FirstImpression | null> {
  // Already have one? Don't re-run
  const existing = getFirstImpression(documentId)
  if (existing) return existing

  const db = getDb()
  const doc = db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).get()

  if (!doc || !doc.extractedText) {
    logger.debug('first-impression', 'No document or empty text - skipping', { documentId })
    return null
  }

  // Take only the first 800 chars as the sample - keeps the prompt tiny
  // so the model can answer in 1-3 seconds even on small hardware.
  const sample = doc.extractedText.slice(0, 800)
  const prompt = buildFirstImpressionPrompt(sample)

  const startTime = Date.now()
  logger.info('first-impression', 'Generating for document', {
    documentId,
    sampleLength: sample.length,
    model
  })

  try {
    const ollama = getClient()
    const response = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      stream: false,
      options: {
        temperature: 0.1,
        // Small context window: the entire prompt + sample fits in ~1500 tokens
        num_ctx: 2048,
        // Hard-cap output: we only need ~100 tokens of JSON
        num_predict: 200
      }
    })

    const content = response.message?.content ?? ''
    const parsed = extractJsonObject(content)
    if (!parsed) {
      // Privacy: Modell-Antwort enthaelt Dokumentinhalt - nur Laenge loggen
      logger.warn('first-impression', 'Could not parse JSON from model response', {
        documentId,
        contentLength: content.length
      })
      return null
    }

    const documentType = typeof parsed.documentType === 'string' ? parsed.documentType : 'sonstiges'
    const recommendedModeRaw =
      typeof parsed.recommendedMode === 'string' ? parsed.recommendedMode : 'freeform'
    const recommendedMode = ALLOWED_MODES.has(recommendedModeRaw as AnalysisMode)
      ? (recommendedModeRaw as AnalysisMode)
      : 'freeform'
    const firstImpression =
      typeof parsed.firstImpression === 'string' ? parsed.firstImpression.slice(0, 200) : ''

    if (!firstImpression) {
      logger.warn('first-impression', 'Empty firstImpression in model response', {
        documentId
      })
      return null
    }

    const now = new Date().toISOString()
    const row: typeof schema.firstImpressions.$inferInsert = {
      documentId,
      documentType,
      recommendedMode,
      firstImpression,
      modelUsed: model,
      createdAt: now
    }

    // Upsert: delete any stale row first, then insert
    db.delete(schema.firstImpressions)
      .where(eq(schema.firstImpressions.documentId, documentId))
      .run()
    db.insert(schema.firstImpressions).values(row).run()

    logger.info('first-impression', 'Generated successfully', {
      documentId,
      documentType,
      recommendedMode,
      durationMs: Date.now() - startTime
    })

    return {
      documentId,
      documentType,
      recommendedMode,
      firstImpression,
      modelUsed: model,
      createdAt: now
    }
  } catch (err) {
    logger.warn('first-impression', 'Generation failed - non-fatal, feature is optional', {
      documentId,
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}
