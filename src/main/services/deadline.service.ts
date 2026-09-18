import { randomUUID } from 'crypto'
import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { chatOnce } from './ollama-client.service'
import { buildDeadlineExtractPrompt } from '../prompts/deadline-extract.prompt'
import { parseDeadlineAnchors } from '../lib/parse-deadline-anchors'
import { computeDeadline } from '@shared/deadline-calc'
import { logger } from './logger.service'
import { DEFAULT_NUM_CTX } from '../config/constants'
import type { Deadline, DeadlineAnchor, DeadlineWithDocument } from '@shared/types'

const SOURCE = 'deadline.service'

/**
 * Wie viel Text der Fristen-Extraktion vorgelegt wird. Fristen stehen fast
 * immer im Kopf (Bescheiddatum) und am Ende (Rechtsbehelfsbelehrung) - bei
 * langen Dokumenten schicken wir deshalb Anfang UND Ende statt nur den Anfang.
 */
const HEAD_CHARS = 4000
const TAIL_CHARS = 5000

function focusOnDeadlineParts(text: string): string {
  if (text.length <= HEAD_CHARS + TAIL_CHARS) return text
  const head = text.slice(0, HEAD_CHARS)
  const tail = text.slice(-TAIL_CHARS)
  return `${head}\n\n[... Mittelteil ausgelassen ...]\n\n${tail}`
}

/** Heutiges Datum als ISO-Tag in lokaler Zeit (nicht UTC - Fristen sind lokal). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function rowToDeadline(row: typeof schema.deadlines.$inferSelect): Deadline {
  return {
    id: row.id,
    documentId: row.documentId,
    kind: row.kind as Deadline['kind'],
    label: row.label,
    dueDateIso: row.dueDate,
    startDateIso: row.startDate,
    periodText: row.periodText,
    quote: row.quote,
    confidence: row.confidence as Deadline['confidence'],
    source: row.source as Deadline['source'],
    note: row.note,
    createdAt: row.createdAt
  }
}

export function getDeadlinesForDocument(documentId: string): Deadline[] {
  const db = getDb()
  return db
    .select()
    .from(schema.deadlines)
    .where(eq(schema.deadlines.documentId, documentId))
    .orderBy(asc(schema.deadlines.dueDate))
    .all()
    .map(rowToDeadline)
}

/**
 * Alle Fristen aller Dokumente, faelligste zuerst. Fuer die Sidebar - wer drei
 * Bescheide importiert hat, soll nicht jeden einzeln oeffnen muessen, um zu
 * sehen, was zuerst ablaeuft.
 */
export function getUpcomingDeadlines(): DeadlineWithDocument[] {
  const db = getDb()
  return db
    .select({ deadline: schema.deadlines, filename: schema.documents.filename })
    .from(schema.deadlines)
    .innerJoin(schema.documents, eq(schema.deadlines.documentId, schema.documents.id))
    .orderBy(asc(schema.deadlines.dueDate))
    .all()
    .map((row) => ({ ...rowToDeadline(row.deadline), filename: row.filename }))
}

function persist(documentId: string, deadlines: Deadline[]): void {
  const db = getDb()
  // Ein Scan ersetzt das vorherige Ergebnis komplett - sonst sammeln sich bei
  // jedem erneuten Durchlauf Dubletten an.
  db.delete(schema.deadlines).where(eq(schema.deadlines.documentId, documentId)).run()
  for (const d of deadlines) {
    db.insert(schema.deadlines)
      .values({
        id: d.id,
        documentId: d.documentId,
        kind: d.kind,
        label: d.label,
        dueDate: d.dueDateIso,
        startDate: d.startDateIso,
        periodText: d.periodText,
        quote: d.quote,
        confidence: d.confidence,
        source: d.source,
        note: d.note,
        createdAt: d.createdAt
      })
      .run()
  }
}

/**
 * Rechnet die Anker in Fristen um. Reine Funktion ausser der ID-Vergabe -
 * die eigentliche Datumsmathematik steckt in @shared/deadline-calc und ist
 * dort ausfuehrlich getestet.
 */
export function anchorsToDeadlines(
  documentId: string,
  anchors: DeadlineAnchor[],
  today: string,
  documentText: string,
  createdAt: string
): Deadline[] {
  const result: Deadline[] = []
  const seen = new Set<string>()

  for (const anchor of anchors) {
    // Der Hinweis hilft dem Regelkatalog, Bussgeld (2 Wochen) von
    // Steuerbescheid (1 Monat) zu unterscheiden.
    const computed = computeDeadline({ anchor, todayIso: today, hint: documentText })
    if (!computed) {
      logger.debug(SOURCE, 'Anker ohne berechenbares Datum verworfen', { kind: anchor.kind })
      continue
    }
    // Dubletten (gleiche Art, gleiches Datum) zusammenfassen.
    const key = `${anchor.kind}|${computed.dueDateIso}`
    if (seen.has(key)) continue
    seen.add(key)

    result.push({
      id: randomUUID(),
      documentId,
      kind: anchor.kind,
      label: anchor.label || anchor.kind,
      dueDateIso: computed.dueDateIso,
      startDateIso: anchor.startDateIso,
      periodText: anchor.periodText,
      quote: anchor.quote,
      confidence: computed.confidence,
      source: computed.source,
      note: computed.note,
      createdAt
    })
  }
  return result
}

/**
 * Durchsucht ein Dokument nach Fristen: ein kleiner Modell-Durchlauf liest die
 * Anker (Startdatum, Fristtext, Zitat), gerechnet wird anschliessend
 * deterministisch in TypeScript.
 *
 * Wirft nicht - eine fehlgeschlagene Fristensuche darf nie die Analyse kippen.
 */
export async function scanDeadlines(documentId: string, modelName: string): Promise<Deadline[]> {
  const doc = getDocumentById(documentId)
  if (!doc || !doc.extractedText) return []

  try {
    const { system, user } = buildDeadlineExtractPrompt(focusOnDeadlineParts(doc.extractedText))
    const raw = await chatOnce({
      model: modelName,
      system,
      prompt: user,
      temperature: 0.1,
      numCtx: DEFAULT_NUM_CTX
    })

    const anchors = parseDeadlineAnchors(raw)
    const deadlines = anchorsToDeadlines(
      documentId,
      anchors,
      todayIso(),
      doc.extractedText,
      new Date().toISOString()
    )
    persist(documentId, deadlines)

    logger.info(SOURCE, 'Fristen erkannt', {
      documentId,
      anchors: anchors.length,
      deadlines: deadlines.length
    })
    return deadlines
  } catch (err) {
    logger.warn(SOURCE, 'Fristensuche fehlgeschlagen', {
      documentId,
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}
