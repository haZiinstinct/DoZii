import { app } from 'electron'
import { randomUUID } from 'crypto'
import { join, extname, basename } from 'path'
import { copyFile, mkdir, stat, unlink, writeFile } from 'fs/promises'
import { eq, desc, or, sql } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { extractPdf } from './pdf-extractor.service'
import { extractDocx } from './docx-extractor.service'
import { extractXlsx } from './xlsx-extractor.service'
import { recognizeImage } from './ocr.service'
import { ocrPdf } from './pdf-ocr.service'
import { extractEml, extractPlainText } from './text-extractor.service'
import { getSettings } from './settings.service'
import { logger } from './logger.service'
import { MAX_SEARCH_RESULTS, SNIPPET_CHARS } from '../config/constants'
import {
  SUPPORTED_EXTENSION_SET,
  LEGACY_OFFICE_HINTS,
  getMimeType,
  isEmailExtension,
  isImageExtension,
  isPlainTextExtension
} from '@shared/file-types'
import { checkPrintability } from '@shared/text-validators'
import { detectScannedPdf } from '@shared/scan-detect'
import type { DocumentSummary, DoziiDocument } from '@shared/types'

function getDocumentsDir(): string {
  return join(app.getPath('userData'), 'documents')
}

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB

function detectLanguage(text: string): string {
  const germanWords = [
    'und',
    'der',
    'die',
    'das',
    'ist',
    'ein',
    'eine',
    'nicht',
    'mit',
    'auf',
    'den',
    'dem',
    'sich',
    'von',
    'zu',
    'fuer', // ASCII-Schreibweise absichtlich: erkennt umlaut-frei extrahierte Dokumente
    'für',
    'haben',
    'werden',
    'hat',
    'war',
    'bei',
    'Herr',
    'Frau',
    'sehr',
    'geehrte'
  ]
  const words = text.toLowerCase().split(/\s+/)
  const germanCount = words.filter((w) => germanWords.includes(w)).length
  const ratio = germanCount / Math.max(words.length, 1)
  return ratio > 0.02 ? 'de' : 'en'
}

/**
 * SQLite kennt kein boolean - `ocr_used` liegt als 0/1 vor. Der Mapper ist die
 * einzige Stelle, an der das umgerechnet wird, damit die Domaenentypen sauber
 * bleiben.
 */
type DocumentRow = typeof schema.documents.$inferSelect

function rowToDocument(row: DocumentRow): DoziiDocument {
  return { ...row, ocrUsed: row.ocrUsed === 1 }
}

/**
 * Fortschritt der Texterkennung. 40 Seiten OCR dauern Minuten - ohne Rueckmeldung
 * wirkt der Import wie ein Haenger.
 */
export type OcrProgress = (page: number, total: number) => void

interface ExtractionResult {
  text: string
  pageCount: number | null
  /** true, wenn der Text per Texterkennung entstanden ist (Scan/Foto). */
  ocrUsed: boolean
  /** Hinweis, wenn nicht alle Seiten gelesen werden konnten. */
  ocrWarning?: string
}

/**
 * Gescannte PDFs waren bisher der haeufigste Totalausfall: `extractPdf` liest
 * nur die Textebene, und ein eingescannter Bescheid hat keine. Ergebnis war
 * ein leeres Dokument und die Fehlermeldung "keine Textinhalte". Jetzt wird
 * erkannt, dass es ein Scan ist, und die Seiten werden per OCR nachgezogen.
 */
async function extractPdfWithOcrFallback(
  destPath: string,
  onProgress?: OcrProgress
): Promise<ExtractionResult> {
  const settings = getSettings()
  let text = ''
  let pageCount: number | null = null

  try {
    const result = await extractPdf(destPath)
    text = result.text
    pageCount = result.pageCount
  } catch (err) {
    // Passwortschutz und kaputte Dateien sind echte Fehler - durchreichen.
    // Alles andere kann ein PDF sein, dessen Textebene pdf.js nicht mag; dann
    // lohnt der OCR-Versuch trotzdem.
    const message = err instanceof Error ? err.message : String(err)
    if (/passwort|password|beschädigt|kein gültiges/i.test(message)) throw err
    logger.warn('document-store', 'PDF-Textextraktion fehlgeschlagen, versuche OCR', {
      error: message
    })
  }

  const verdict = detectScannedPdf(text, pageCount)
  if (!verdict.isScanned) {
    return { text, pageCount, ocrUsed: false }
  }

  logger.info('document-store', 'Scan erkannt, starte OCR-Fallback', {
    reason: verdict.reason,
    charsPerPage: Math.round(verdict.charsPerPage),
    pageCount
  })

  const ocr = await ocrPdf(destPath, settings.ocrLanguages, settings.ocrQuality, onProgress)
  // Falls die Textebene doch mehr hergab als das OCR (seltener Grenzfall),
  // gewinnt der laengere Text - er enthaelt mit hoher Wahrscheinlichkeit mehr Inhalt.
  if (ocr.text.trim().length <= text.trim().length) {
    return { text, pageCount, ocrUsed: false, ocrWarning: ocr.warning }
  }
  return {
    text: ocr.text,
    pageCount: pageCount ?? ocr.pagesProcessed,
    ocrUsed: true,
    ocrWarning: ocr.warning
  }
}

async function extractTextByType(
  destPath: string,
  ext: string,
  onProgress?: OcrProgress
): Promise<ExtractionResult> {
  if (ext === '.pdf') {
    return extractPdfWithOcrFallback(destPath, onProgress)
  }
  if (ext === '.docx') {
    const result = await extractDocx(destPath)
    return { text: result.text, pageCount: null, ocrUsed: false }
  }
  if (ext === '.xlsx') {
    const result = extractXlsx(destPath)
    return { text: result.text, pageCount: result.sheetCount, ocrUsed: false }
  }
  if (isPlainTextExtension(ext)) {
    const result = await extractPlainText(destPath)
    return { text: result.text, pageCount: result.pageCount, ocrUsed: false }
  }
  if (isEmailExtension(ext)) {
    const result = await extractEml(destPath)
    return { text: result.text, pageCount: result.pageCount, ocrUsed: false }
  }
  if (isImageExtension(ext)) {
    const settings = getSettings()
    const result = await recognizeImage(destPath, settings.ocrLanguages, settings.ocrQuality)
    return { text: result.text, pageCount: 1, ocrUsed: true }
  }
  throw new Error(`Nicht unterstützter Dateityp: ${ext}`)
}

export async function importDocument(
  filePath: string,
  onProgress?: OcrProgress
): Promise<DoziiDocument> {
  const ext = extname(filePath).toLowerCase()
  const filename = basename(filePath)

  // Validate extension against allow-list
  if (!SUPPORTED_EXTENSION_SET.has(ext)) {
    const legacyHint = LEGACY_OFFICE_HINTS[ext]
    if (legacyHint) {
      throw new Error(`Das alte Office-Format "${ext}" wird nicht unterstützt. ${legacyHint}`)
    }
    throw new Error(
      `Dateityp "${ext}" wird nicht unterstützt. Erlaubt: ${[...SUPPORTED_EXTENSION_SET].join(', ')}`
    )
  }

  // Validate source file exists and is regular + size limit
  const sourceStat = await stat(filePath).catch(() => null)
  if (!sourceStat || !sourceStat.isFile()) {
    throw new Error(`Datei "${filename}" nicht gefunden oder nicht lesbar`)
  }
  if (sourceStat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Datei "${filename}" ist zu gross (${Math.round(sourceStat.size / (1024 * 1024))} MB). Max: 200 MB.`
    )
  }
  if (sourceStat.size === 0) {
    throw new Error(`Datei "${filename}" ist leer`)
  }

  const db = getDb()
  const docsDir = getDocumentsDir()
  await mkdir(docsDir, { recursive: true })

  const id = randomUUID()
  const mimeType = getMimeType(ext)
  const destPath = join(docsDir, `${id}${ext}`)

  // Copy file to managed storage
  await copyFile(filePath, destPath)
  logger.debug('document-store', 'File copied to managed storage', { id, destPath })

  // Extract text - if this fails, we must clean up the copied file
  let extractedText: string
  let pageCount: number | null
  let ocrUsed: boolean

  try {
    const extracted = await extractTextByType(destPath, ext, onProgress)
    extractedText = extracted.text.trim()
    pageCount = extracted.pageCount
    ocrUsed = extracted.ocrUsed
    if (extracted.ocrWarning) {
      logger.warn('document-store', 'Texterkennung unvollstaendig', {
        filename,
        warning: extracted.ocrWarning
      })
    }
  } catch (err) {
    // Rollback: remove the copied file
    await unlink(destPath).catch((unlinkErr) => {
      logger.warn('document-store', 'Failed to rollback copied file after extraction error', {
        destPath,
        unlinkError: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr)
      })
    })
    logger.error('document-store', 'Extraction failed', {
      ext,
      filename,
      error: err instanceof Error ? err.message : String(err)
    })
    throw new Error(
      `Text konnte nicht aus "${filename}" extrahiert werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      { cause: err }
    )
  }

  // Reject empty extractions - user needs to know the doc is unusable
  if (extractedText.length === 0) {
    await unlink(destPath).catch(() => {
      /* best effort */
    })
    throw new Error(
      `Keine Textinhalte in "${filename}" gefunden. Mögliche Ursachen:\n` +
        '• PDF ist passwortgeschützt\n' +
        '• PDF ist ein Scan ohne OCR - bitte als Bild importieren\n' +
        '• Dokument ist beschädigt\n' +
        '• Datei enthält nur Bilder'
    )
  }

  // Reject garbled/binary extractions - would make the model hallucinate
  const printCheck = checkPrintability(extractedText)
  if (!printCheck.ok) {
    await unlink(destPath).catch(() => {
      /* best effort */
    })
    // Privacy: niemals Dokumentinhalt loggen, nur Metriken
    logger.warn('document-store', 'Rejected document due to low printability', {
      filename,
      printableRatio: printCheck.printableRatio,
      controlRatio: printCheck.controlRatio,
      reason: printCheck.reason
    })
    throw new Error(
      `Text-Extraktion fehlgeschlagen in "${filename}":\n${printCheck.reason}\n\n` +
        'Mögliche Lösungen:\n' +
        '• PDF ist ein gescannter Scan - als JPG/PNG exportieren und importieren (OCR)\n' +
        '• PDF ist beschädigt - bitte neu erstellen\n' +
        '• Dokument verwendet ein unbekanntes Encoding'
    )
  }

  logger.info('document-store', 'Extraction quality OK', {
    filename,
    printableRatio: Math.round(printCheck.printableRatio * 100) / 100,
    textLength: extractedText.length
  })

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length
  const detectedLanguage = extractedText.length > 50 ? detectLanguage(extractedText) : null
  const now = new Date().toISOString()

  const doc: typeof schema.documents.$inferInsert = {
    id,
    filename,
    originalPath: destPath,
    mimeType,
    fileSize: sourceStat.size,
    pageCount,
    wordCount,
    detectedLanguage,
    extractedText,
    thumbnailPath: null,
    ocrUsed: ocrUsed ? 1 : 0,
    createdAt: now,
    updatedAt: now
  }

  db.insert(schema.documents).values(doc).run()
  logger.info('document-store', 'Document imported', {
    id,
    filename,
    wordCount,
    pageCount,
    detectedLanguage
  })
  return rowToDocument(doc as DocumentRow)
}

export function getAllDocuments(): DoziiDocument[] {
  const db = getDb()
  return db
    .select()
    .from(schema.documents)
    .orderBy(desc(schema.documents.createdAt))
    .all()
    .map(rowToDocument)
}

export function getDocumentById(id: string): DoziiDocument | undefined {
  const db = getDb()
  const row = db.select().from(schema.documents).where(eq(schema.documents.id, id)).get()
  return row ? rowToDocument(row) : undefined
}

/**
 * Re-extract text for an already-imported document. Used when the original
 * extraction was corrupted (e.g. documents imported before the Buffer->Uint8Array
 * fix). The file itself stays; only extractedText/wordCount/language/updatedAt
 * are refreshed. Runs through the same printability validation as fresh imports.
 */
export async function reImportDocument(id: string): Promise<DoziiDocument> {
  const db = getDb()
  const doc = getDocumentById(id)
  if (!doc) {
    throw new Error(`Dokument ${id} nicht gefunden`)
  }

  const ext = extname(doc.originalPath).toLowerCase()
  logger.info('document-store', 'Re-importing document', {
    id,
    filename: doc.filename,
    originalPath: doc.originalPath
  })

  // Check the file still exists on disk
  const fileStat = await stat(doc.originalPath).catch(() => null)
  if (!fileStat || !fileStat.isFile()) {
    throw new Error(
      `Original-Datei nicht mehr vorhanden: "${doc.filename}" - bitte das Dokument neu importieren`
    )
  }

  // Re-run extraction (same pipeline as fresh import)
  let extractedText: string
  let pageCount: number | null
  let ocrUsed: boolean
  try {
    const extracted = await extractTextByType(doc.originalPath, ext)
    extractedText = extracted.text.trim()
    pageCount = extracted.pageCount
    ocrUsed = extracted.ocrUsed
  } catch (err) {
    logger.error('document-store', 'Re-import extraction failed', {
      id,
      filename: doc.filename,
      error: err instanceof Error ? err.message : String(err)
    })
    throw new Error(
      `Text konnte nicht erneut aus "${doc.filename}" extrahiert werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      { cause: err }
    )
  }

  if (extractedText.length === 0) {
    throw new Error(
      `Keine Textinhalte in "${doc.filename}" gefunden.\n` +
        'Das PDF ist vermutlich ein Scan oder beschädigt.'
    )
  }

  // Printability validation
  const printCheck = checkPrintability(extractedText)
  if (!printCheck.ok) {
    logger.warn('document-store', 'Re-import produced low-quality text', {
      id,
      printableRatio: printCheck.printableRatio,
      reason: printCheck.reason
    })
    throw new Error(
      `Neu-Extraktion fehlgeschlagen: ${printCheck.reason}\n` +
        'Das PDF lässt sich mit unpdf nicht sauber lesen.'
    )
  }

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length
  const detectedLanguage = extractedText.length > 50 ? detectLanguage(extractedText) : null
  const now = new Date().toISOString()

  db.update(schema.documents)
    .set({
      extractedText,
      ocrUsed: ocrUsed ? 1 : 0,
      wordCount,
      detectedLanguage,
      pageCount,
      updatedAt: now
    })
    .where(eq(schema.documents.id, id))
    .run()

  logger.info('document-store', 'Document re-imported successfully', {
    id,
    filename: doc.filename,
    wordCount,
    pageCount,
    printableRatio: Math.round(printCheck.printableRatio * 100) / 100
  })

  const updated = getDocumentById(id)
  if (!updated) {
    throw new Error('Interner Fehler: Dokument nach Update nicht lesbar')
  }
  return updated
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb()
  const doc = getDocumentById(id)
  if (!doc) return

  // Safety: only unlink files that live inside our managed documents dir
  const docsDir = getDocumentsDir()
  if (!doc.originalPath.startsWith(docsDir)) {
    logger.warn('document-store', 'Refusing to unlink file outside managed dir', {
      id,
      originalPath: doc.originalPath
    })
  } else {
    try {
      await unlink(doc.originalPath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== 'ENOENT') {
        logger.warn('document-store', 'Could not unlink document file', {
          id,
          path: doc.originalPath,
          code,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }

  db.delete(schema.documents).where(eq(schema.documents.id, id)).run()
  logger.info('document-store', 'Document deleted', { id })
}

// ============================================================================
// Listen und Suche (ohne Volltext ueber IPC)
// ============================================================================

/**
 * Spaltenauswahl fuer Listenansichten. `extractedText` bleibt bewusst draussen:
 * die Historie hat frueher jedes Dokument samt Volltext in den Renderer geladen
 * und dort gefiltert - bei ein paar hundert Dokumenten sind das zweistellige
 * Megabyte pro Seitenaufruf.
 */
const SUMMARY_COLUMNS = {
  id: schema.documents.id,
  filename: schema.documents.filename,
  mimeType: schema.documents.mimeType,
  fileSize: schema.documents.fileSize,
  pageCount: schema.documents.pageCount,
  wordCount: schema.documents.wordCount,
  detectedLanguage: schema.documents.detectedLanguage,
  ocrUsed: schema.documents.ocrUsed,
  createdAt: schema.documents.createdAt,
  updatedAt: schema.documents.updatedAt,
  snippet: sql<string>`substr(${schema.documents.extractedText}, 1, ${SNIPPET_CHARS})`
}

type SummaryRow = Omit<DocumentSummary, 'ocrUsed'> & { ocrUsed: number }

function toSummary(row: SummaryRow): DocumentSummary {
  return { ...row, ocrUsed: row.ocrUsed === 1 }
}

export function listDocumentSummaries(): DocumentSummary[] {
  const db = getDb()
  return db
    .select(SUMMARY_COLUMNS)
    .from(schema.documents)
    .orderBy(desc(schema.documents.createdAt))
    .all()
    .map(toSummary)
}

/**
 * Volltextsuche ueber Dateiname und Inhalt - laeuft in SQLite, nicht im
 * Renderer. LIKE ist bei SQLite nur fuer ASCII case-insensitiv, deshalb
 * vergleichen wir beide Seiten in Kleinschreibung.
 */
export function searchDocuments(query: string): DocumentSummary[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return listDocumentSummaries()

  const db = getDb()
  // LIKE-Sonderzeichen entschaerfen, damit eine Suche nach "50%" nicht alles trifft.
  const pattern = `%${needle.replace(/[%_\\]/g, (match) => `\\${match}`)}%`
  return db
    .select(SUMMARY_COLUMNS)
    .from(schema.documents)
    .where(
      or(
        sql`lower(${schema.documents.filename}) LIKE ${pattern} ESCAPE '\'`,
        sql`lower(${schema.documents.extractedText}) LIKE ${pattern} ESCAPE '\'`
      )
    )
    .orderBy(desc(schema.documents.createdAt))
    .limit(MAX_SEARCH_RESULTS)
    .all()
    .map(toSummary)
}

// ============================================================================
// Text-Import (Zwischenablage)
// ============================================================================

/**
 * Leitet einen Dateinamen aus der ersten sinnvollen Zeile des Textes ab.
 * "Bescheid ueber Arbeitslosengeld II" -> "Bescheid ueber Arbeitslosengeld II.txt"
 */
/** Zeichen, die Windows in Dateinamen nicht erlaubt (Backslash ueber den Code, um Escaping zu sparen). */
const FORBIDDEN_FILENAME_CHARS = new Set([
  '<',
  '>',
  ':',
  '"',
  '/',
  '|',
  '?',
  '*',
  String.fromCharCode(92)
])

function deriveTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 3)
  const base = (firstLine ?? 'Eingefuegter Text').slice(0, 60)
  // Fuer Dateisysteme unzulaessige Zeichen ersetzen. Steuerzeichen sind
  // bewusst dabei - die kommen aus kaputtem Copy-Paste oder PDF-Extraktion.
  const cleaned = [...base]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < 0x20 || FORBIDDEN_FILENAME_CHARS.has(char) ? ' ' : char
    })
    .join('')
  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * Importiert direkt eingefuegten Text. Die Zielgruppe kopiert Behoerdenpost
 * oft aus einem Portal oder einer Mail - dann gibt es gar keine Datei.
 * Der Text wird trotzdem als .txt in der verwalteten Ablage gespeichert,
 * damit Re-Import, Export und Loeschen identisch funktionieren.
 */
export async function importTextDocument(payload: {
  text: string
  title?: string
}): Promise<DoziiDocument> {
  const extractedText = payload.text.trim()
  if (extractedText.length === 0) {
    throw new Error('Der eingefuegte Text ist leer.')
  }

  const db = getDb()
  const docsDir = getDocumentsDir()
  await mkdir(docsDir, { recursive: true })

  const id = randomUUID()
  const destPath = join(docsDir, `${id}.txt`)
  const title = (payload.title?.trim() || deriveTitle(extractedText)) + '.txt'

  await writeFile(destPath, extractedText, 'utf-8')

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length
  const detectedLanguage = extractedText.length > 50 ? detectLanguage(extractedText) : null
  const now = new Date().toISOString()

  const doc: typeof schema.documents.$inferInsert = {
    id,
    filename: title,
    originalPath: destPath,
    mimeType: 'text/plain',
    fileSize: Buffer.byteLength(extractedText, 'utf-8'),
    pageCount: null,
    wordCount,
    detectedLanguage,
    extractedText,
    thumbnailPath: null,
    ocrUsed: 0,
    createdAt: now,
    updatedAt: now
  }

  db.insert(schema.documents).values(doc).run()
  logger.info('document-store', 'Text document imported', { id, wordCount, detectedLanguage })
  return rowToDocument(doc as DocumentRow)
}
