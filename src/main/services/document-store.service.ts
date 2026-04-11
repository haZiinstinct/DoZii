import { app } from 'electron'
import { join, extname, basename } from 'path'
import { copyFile, mkdir, stat, unlink } from 'fs/promises'
import { v4 as uuid } from 'uuid'
import { eq, desc } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { extractPdf } from './pdf-extractor.service'
import { extractDocx } from './docx-extractor.service'
import { extractXlsx } from './xlsx-extractor.service'
import { recognizeImage } from './ocr.service'
import { logger } from './logger.service'
import type { DoziiDocument } from '@shared/types'

function getDocumentsDir(): string {
  return join(app.getPath('userData'), 'documents')
}

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.bmp',
  '.webp'
])

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB

function detectLanguage(text: string): string {
  const germanWords = [
    'und', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'nicht', 'mit', 'auf',
    'den', 'dem', 'sich', 'von', 'zu', 'fuer', 'für', 'haben', 'werden',
    'hat', 'war', 'bei', 'Herr', 'Frau', 'sehr', 'geehrte'
  ]
  const words = text.toLowerCase().split(/\s+/)
  const germanCount = words.filter((w) => germanWords.includes(w)).length
  const ratio = germanCount / Math.max(words.length, 1)
  return ratio > 0.02 ? 'de' : 'en'
}

export interface PrintabilityCheck {
  printableRatio: number
  controlRatio: number
  ok: boolean
  reason?: string
}

/**
 * Validate that extracted text is actually human-readable.
 * Rejects binary/garbled extractions that would make the model hallucinate.
 *
 * Printable = ASCII 32-126, common whitespace (\n\r\t), and Latin-1 extended
 * letters (umlauts, accented characters, €, §, °, etc.).
 */
export function checkPrintability(text: string): PrintabilityCheck {
  if (text.length === 0) {
    return { printableRatio: 0, controlRatio: 0, ok: false, reason: 'Text ist leer' }
  }

  let printable = 0
  let control = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // Whitespace we always accept
    if (code === 9 || code === 10 || code === 13) {
      printable++
      continue
    }
    // ASCII printable
    if (code >= 32 && code <= 126) {
      printable++
      continue
    }
    // Latin-1 Supplement (umlauts, accented letters) + common symbols
    // 160-255 = Latin-1 Supplement, 0x20AC = Euro, 0x2013/2014 = en/em dash,
    // 0x201C-201F = smart quotes, 0x2026 = ellipsis, 0x00B0 = degree, 0x00A7 = section
    if (
      (code >= 160 && code <= 255) ||
      code === 0x20ac ||
      (code >= 0x2013 && code <= 0x2014) ||
      (code >= 0x2018 && code <= 0x201f) ||
      code === 0x2026
    ) {
      printable++
      continue
    }
    // Control chars (below 32, not whitespace)
    if (code < 32) {
      control++
    }
    // Everything else (extended unicode, CJK, etc.) counts as neutral (not printable, not control)
  }

  const printableRatio = printable / text.length
  const controlRatio = control / text.length

  if (controlRatio > 0.05) {
    return {
      printableRatio,
      controlRatio,
      ok: false,
      reason: `Zu viele Steuerzeichen (${Math.round(controlRatio * 100)}%) - Text ist wahrscheinlich binaer/beschaedigt`
    }
  }
  if (printableRatio < 0.8) {
    return {
      printableRatio,
      controlRatio,
      ok: false,
      reason: `Nur ${Math.round(printableRatio * 100)}% druckbare Zeichen - PDF ist moeglicherweise ein gescanntes Bild, beschaedigt oder in einem unbekannten Encoding`
    }
  }

  return { printableRatio, controlRatio, ok: true }
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
  }
  return map[ext.toLowerCase()] || 'application/octet-stream'
}

async function extractTextByType(
  destPath: string,
  ext: string
): Promise<{ text: string; pageCount: number | null }> {
  if (ext === '.pdf') {
    const result = await extractPdf(destPath)
    return { text: result.text, pageCount: result.pageCount }
  }
  if (ext === '.docx' || ext === '.doc') {
    const result = await extractDocx(destPath)
    return { text: result.text, pageCount: null }
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const result = extractXlsx(destPath)
    return { text: result.text, pageCount: result.sheetCount }
  }
  if (['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'].includes(ext)) {
    const result = await recognizeImage(destPath)
    return { text: result.text, pageCount: 1 }
  }
  throw new Error(`Nicht unterstuetzter Dateityp: ${ext}`)
}

export async function importDocument(filePath: string): Promise<DoziiDocument> {
  const ext = extname(filePath).toLowerCase()
  const filename = basename(filePath)

  // Validate extension against allow-list
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Dateityp "${ext}" wird nicht unterstuetzt. Erlaubt: ${[...SUPPORTED_EXTENSIONS].join(', ')}`
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

  const id = uuid()
  const mimeType = getMimeType(ext)
  const destPath = join(docsDir, `${id}${ext}`)

  // Copy file to managed storage
  await copyFile(filePath, destPath)
  logger.debug('document-store', 'File copied to managed storage', { id, destPath })

  // Extract text - if this fails, we must clean up the copied file
  let extractedText = ''
  let pageCount: number | null = null

  try {
    const extracted = await extractTextByType(destPath, ext)
    extractedText = extracted.text.trim()
    pageCount = extracted.pageCount
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
      `Text konnte nicht aus "${filename}" extrahiert werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    )
  }

  // Reject empty extractions - user needs to know the doc is unusable
  if (extractedText.length === 0) {
    await unlink(destPath).catch(() => {
      /* best effort */
    })
    throw new Error(
      `Keine Textinhalte in "${filename}" gefunden. Moegliche Ursachen:\n` +
        '• PDF ist passwortgeschuetzt\n' +
        '• PDF ist ein Scan ohne OCR - bitte als Bild importieren\n' +
        '• Dokument ist beschaedigt\n' +
        '• Datei enthaelt nur Bilder'
    )
  }

  // Reject garbled/binary extractions - would make the model hallucinate
  const printCheck = checkPrintability(extractedText)
  if (!printCheck.ok) {
    await unlink(destPath).catch(() => {
      /* best effort */
    })
    logger.warn('document-store', 'Rejected document due to low printability', {
      filename,
      printableRatio: printCheck.printableRatio,
      controlRatio: printCheck.controlRatio,
      reason: printCheck.reason,
      sample: extractedText.slice(0, 200)
    })
    throw new Error(
      `Text-Extraktion fehlgeschlagen in "${filename}":\n${printCheck.reason}\n\n` +
        'Moegliche Loesungen:\n' +
        '• PDF ist ein gescannter Scan - als JPG/PNG exportieren und importieren (OCR)\n' +
        '• PDF ist beschaedigt - bitte neu erstellen\n' +
        '• Dokument verwendet ein unbekanntes Encoding'
    )
  }

  logger.info('document-store', 'Extraction quality OK', {
    filename,
    printableRatio: Math.round(printCheck.printableRatio * 100) / 100,
    sample: extractedText.slice(0, 200)
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
  return doc as DoziiDocument
}

export function getAllDocuments(): DoziiDocument[] {
  const db = getDb()
  return db
    .select()
    .from(schema.documents)
    .orderBy(desc(schema.documents.createdAt))
    .all() as DoziiDocument[]
}

export function getDocumentById(id: string): DoziiDocument | undefined {
  const db = getDb()
  return db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .get() as DoziiDocument | undefined
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
  let extractedText = ''
  let pageCount: number | null = null
  try {
    const extracted = await extractTextByType(doc.originalPath, ext)
    extractedText = extracted.text.trim()
    pageCount = extracted.pageCount
  } catch (err) {
    logger.error('document-store', 'Re-import extraction failed', {
      id,
      filename: doc.filename,
      error: err instanceof Error ? err.message : String(err)
    })
    throw new Error(
      `Text konnte nicht erneut aus "${doc.filename}" extrahiert werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    )
  }

  if (extractedText.length === 0) {
    throw new Error(
      `Keine Textinhalte in "${doc.filename}" gefunden.\n` +
        'Das PDF ist vermutlich ein Scan oder beschaedigt.'
    )
  }

  // Printability validation
  const printCheck = checkPrintability(extractedText)
  if (!printCheck.ok) {
    logger.warn('document-store', 'Re-import produced low-quality text', {
      id,
      printableRatio: printCheck.printableRatio,
      sample: extractedText.slice(0, 200)
    })
    throw new Error(
      `Neu-Extraktion fehlgeschlagen: ${printCheck.reason}\n` +
        'Das PDF laesst sich mit unpdf nicht sauber lesen.'
    )
  }

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length
  const detectedLanguage = extractedText.length > 50 ? detectLanguage(extractedText) : null
  const now = new Date().toISOString()

  db.update(schema.documents)
    .set({
      extractedText,
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
