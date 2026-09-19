import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { getDeadlinesForDocument, getUpcomingDeadlines } from './deadline.service'
import { exportAnalysisAsPdf } from './pdf-exporter.service'
import { getSettings } from './settings.service'
import { logger } from './logger.service'
import { markdownToRtf } from '@shared/rtf'
import { buildIcsCalendar, type IcsEvent } from '@shared/ics'
import { redactText } from '@shared/redaction'
import type { Deadline, ExportFormat, ExportRequest, ExportResult } from '@shared/types'

const SOURCE = 'export.service'

const MODE_LABELS: Record<string, string> = {
  plain: 'Einfach erklaert',
  grammar: 'Rechtschreibung',
  formulation: 'Formulierungen',
  arbeitszeugnis: 'Zeugnis-Decoder',
  contract: 'Vertrags-Check',
  summary: 'Zusammenfassung',
  freeform: 'Analyse',
  letter: 'Briefentwurf'
}

const FORMAT_META: Record<Exclude<ExportFormat, 'pdf'>, { ext: string; name: string }> = {
  markdown: { ext: 'md', name: 'Markdown' },
  rtf: { ext: 'rtf', name: 'Word-kompatibel (RTF)' },
  txt: { ext: 'txt', name: 'Textdatei' }
}

function safeBaseName(docName: string, mode: string): string {
  const safe = docName.replace(/\.[^.]+$/, '').replace(/[^\wäöüÄÖÜß .-]+/g, '_')
  const timestamp = new Date().toISOString().slice(0, 10)
  return `${safe} - ${MODE_LABELS[mode] ?? 'Analyse'} - ${timestamp}`
}

/**
 * Markdown grob in Klartext wandeln: Auszeichnungszeichen entfernen, Struktur
 * ueber Einrueckung und Leerzeilen erhalten. Bewusst simpel - eine .txt soll
 * lesbar sein, nicht huebsch.
 */
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s*(.+)$/gm, (_m, title: string) => `${title.toUpperCase()}\n`)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '  ')
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, '  [ ] ')
    .replace(/^\s*[-*]\s+/gm, '  - ')
    .replace(/^---+$/gm, '------------------------------')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Exportiert ein Analyseergebnis. PDF laeuft weiter ueber den bestehenden
 * Renderer; Markdown, RTF und TXT werden hier direkt geschrieben.
 *
 * `redact` maskiert vorher IBAN, Aktenzeichen, Telefonnummern und aehnliches -
 * gedacht fuer den Fall, dass jemand die Analyse an eine Beratungsstelle gibt.
 */
export async function exportAnalysis(
  request: ExportRequest,
  parent: BrowserWindow
): Promise<ExportResult> {
  const db = getDb()
  const analysis = db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.id, request.analysisId))
    .get()
  if (!analysis) return { ok: false, error: 'Analyse nicht gefunden' }

  if (request.format === 'pdf') {
    return exportAnalysisAsPdf(request.analysisId, parent, request.redact)
  }

  const meta = FORMAT_META[request.format]
  if (!meta) return { ok: false, error: `Unbekanntes Format: ${request.format}` }

  const doc = getDocumentById(analysis.documentId)
  const docName = doc?.filename ?? 'Unbekanntes Dokument'

  let body = analysis.result
  let redactedCount = 0
  if (request.redact) {
    const redacted = redactText(body)
    body = redacted.text
    redactedCount = redacted.spans.length
  }

  const header =
    `# ${MODE_LABELS[analysis.mode] ?? 'Analyse'}\n\n` +
    `**Dokument:** ${docName}  \n` +
    `**Modell:** ${analysis.modelUsed}  \n` +
    `**Erstellt:** ${new Date(analysis.createdAt).toLocaleString('de-DE')}\n\n` +
    (request.redact ? `*Persönliche Daten wurden für diesen Export geschwärzt.*\n\n` : '') +
    '---\n\n'
  const markdown = header + body

  const saveResult = await dialog.showSaveDialog(parent, {
    title: 'Analyse exportieren',
    defaultPath: `${safeBaseName(docName, analysis.mode)}.${meta.ext}`,
    filters: [{ name: meta.name, extensions: [meta.ext] }]
  })
  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, error: 'Abgebrochen' }
  }

  try {
    const content =
      request.format === 'rtf'
        ? markdownToRtf(markdown, { title: `${MODE_LABELS[analysis.mode]} - ${docName}` })
        : request.format === 'txt'
          ? markdownToPlainText(markdown)
          : markdown
    await writeFile(saveResult.filePath, content, 'utf-8')
    logger.info(SOURCE, 'Analyse exportiert', {
      format: request.format,
      redactedCount
    })
    return { ok: true, path: saveResult.filePath, redactedCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(SOURCE, 'Export fehlgeschlagen', { format: request.format, error: message })
    return { ok: false, error: `Datei konnte nicht geschrieben werden: ${message}` }
  }
}

function deadlineToEvent(deadline: Deadline, documentName: string): IcsEvent {
  const description = [
    `Dokument: ${documentName}`,
    deadline.quote ? `Im Dokument steht: "${deadline.quote}"` : null,
    deadline.note,
    'Erstellt mit DoZii. Ohne Gewähr - bitte am Originaldokument prüfen.'
  ]
    .filter(Boolean)
    .join('\n')

  return {
    // UID aus Dokument, Fristart und Datum statt aus der Zeilen-ID: die wird
    // bei jedem erneuten Scan neu vergeben, und der Kalender haette dann zwei
    // Eintraege fuer dieselbe Frist angelegt.
    uid: `dozii-${deadline.documentId}-${deadline.kind}-${deadline.dueDateIso}`,
    summary: `Frist: ${deadline.label}`,
    description,
    dateIso: deadline.dueDateIso,
    // Zwei Erinnerungen: eine Woche vorher zum Vorbereiten, einen Tag vorher
    // als letzte Warnung.
    alarmDaysBefore: [7, 1]
  }
}

/**
 * Speichert Fristen als Kalenderdatei. Ohne `documentId` werden alle
 * gespeicherten Fristen exportiert.
 */
export async function exportDeadlinesAsIcs(
  documentId: string | undefined,
  parent: BrowserWindow
): Promise<ExportResult> {
  const events: IcsEvent[] = []
  let defaultName = 'DoZii-Fristen.ics'

  if (documentId) {
    const doc = getDocumentById(documentId)
    if (!doc) return { ok: false, error: 'Dokument nicht gefunden' }
    for (const deadline of getDeadlinesForDocument(documentId)) {
      events.push(deadlineToEvent(deadline, doc.filename))
    }
    defaultName = `${doc.filename.replace(/\.[^.]+$/, '')} - Fristen.ics`
  } else {
    for (const deadline of getUpcomingDeadlines()) {
      events.push(deadlineToEvent(deadline, deadline.filename))
    }
  }

  if (events.length === 0) {
    return { ok: false, error: 'Keine Fristen zum Exportieren vorhanden.' }
  }

  const saveResult = await dialog.showSaveDialog(parent, {
    title: 'Fristen als Kalenderdatei speichern',
    defaultPath: defaultName.replace(/[^\wäöüÄÖÜß .-]+/g, '_'),
    filters: [{ name: 'Kalender', extensions: ['ics'] }]
  })
  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, error: 'Abgebrochen' }
  }

  try {
    const ics = buildIcsCalendar(events, { prodId: '-//haZii//DoZii//DE' })
    await writeFile(saveResult.filePath, ics, 'utf-8')
    logger.info(SOURCE, 'Fristen exportiert', { events: events.length })
    return { ok: true, path: saveResult.filePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(SOURCE, 'ICS-Export fehlgeschlagen', { error: message })
    return { ok: false, error: `Kalenderdatei konnte nicht geschrieben werden: ${message}` }
  }
}

/** Nur fuer die UI-Vorschau: wie viele Stellen wuerden geschwaerzt? */
export function previewRedaction(analysisId: string): { count: number; kinds: string[] } {
  const db = getDb()
  const analysis = db.select().from(schema.analyses).where(eq(schema.analyses.id, analysisId)).get()
  if (!analysis) return { count: 0, kinds: [] }
  const result = redactText(analysis.result)
  return { count: result.spans.length, kinds: Object.keys(result.countByKind) }
}

/** Standardwert fuer die Schwaerzen-Checkbox im Export-Dialog. */
export function redactByDefault(): boolean {
  return getSettings().redactOnExport
}
