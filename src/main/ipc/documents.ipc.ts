import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join, extname, resolve } from 'path'
import {
  importDocument,
  importTextDocument,
  listDocumentSummaries,
  searchDocuments,
  getDocumentById,
  deleteDocument,
  reImportDocument
} from '../services/document-store.service'
import { generateFirstImpression, getFirstImpression } from '../services/first-impression.service'
import { getSelectedModel } from './analysis.ipc'
import { logger } from '../services/logger.service'
import { SUPPORTED_EXTENSION_SET, DIALOG_EXTENSIONS } from '@shared/file-types'
import { MAX_TEXT_IMPORT_CHARS } from '../config/constants'
import { isValidId } from './_validators'
import type { TextImportPayload } from '@shared/types'

export function registerDocumentsIpc(): void {
  ipcMain.handle('documents:openDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Dokumente', extensions: [...DIALOG_EXTENSIONS] }]
    })
    return result.canceled ? [] : result.filePaths
  })

  // Bulk import: shallow scan, non-recursive.
  ipcMain.handle('documents:openDirectoryDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return []

    const dir = result.filePaths[0]
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => join(dir, e.name))
        .filter((p) => SUPPORTED_EXTENSION_SET.has(extname(p).toLowerCase()))
      logger.info('documents.ipc', 'Directory scan for bulk import', {
        dir,
        totalEntries: entries.length,
        matchedFiles: files.length
      })
      return files
    } catch (err) {
      logger.error('documents.ipc', 'Directory scan failed', {
        dir,
        error: err instanceof Error ? err.message : String(err)
      })
      return []
    }
  })

  ipcMain.handle('documents:import', async (event, filePath: string) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Ungültiger Dateipfad')
    }
    // Defensiv normalisieren und sicherstellen, dass es eine echte Datei ist -
    // der Pfad kommt aus dem Renderer (Dialog oder Drag&Drop).
    const normalizedPath = resolve(filePath)
    const fileInfo = await stat(normalizedPath).catch(() => null)
    if (!fileInfo || !fileInfo.isFile()) {
      throw new Error('Datei nicht gefunden oder kein regulärer Dateityp')
    }

    logger.info('documents.ipc', 'Importing document', { filePath: normalizedPath })
    // Bei gescannten PDFs laeuft OCR ueber viele Seiten - der Renderer bekommt
    // Zwischenstaende, damit der Import nicht wie ein Haenger aussieht.
    const win = BrowserWindow.fromWebContents(event.sender)
    const onProgress = (page: number, total: number): void => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('documents:importProgress', { page, total })
      }
    }
    try {
      const doc = await importDocument(normalizedPath, onProgress)

      logger.info('documents.ipc', 'Document imported', {
        id: doc.id,
        filename: doc.filename,
        wordCount: doc.wordCount,
        pageCount: doc.pageCount
      })
      return doc
    } catch (err) {
      logger.error('documents.ipc', 'Document import failed', {
        filePath,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err
      })
      throw err
    }
  })

  // Direkt eingefuegter Text - fuer alles, was aus einem Portal oder einer
  // Mail kopiert wurde und gar nicht erst als Datei existiert.
  ipcMain.handle('documents:importText', async (_event, payload: TextImportPayload) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Ungueltige Eingabe: kein Text uebergeben.')
    }
    const text = typeof payload.text === 'string' ? payload.text : ''
    if (text.trim().length === 0) {
      throw new Error('Der eingefuegte Text ist leer.')
    }
    if (text.length > MAX_TEXT_IMPORT_CHARS) {
      throw new Error(
        `Der Text ist zu lang (${text.length} Zeichen, erlaubt sind ${MAX_TEXT_IMPORT_CHARS}). ` +
          'Bitte kuerzen oder als Datei importieren.'
      )
    }
    const title = typeof payload.title === 'string' ? payload.title.slice(0, 200) : undefined
    return importTextDocument({ text, title })
  })

  ipcMain.handle('documents:getAll', () => {
    return listDocumentSummaries()
  })

  ipcMain.handle('documents:search', (_event, query: string) => {
    if (typeof query !== 'string') return listDocumentSummaries()
    return searchDocuments(query.slice(0, 200))
  })

  ipcMain.handle('documents:getById', (_event, id: string) => {
    if (!isValidId(id)) return undefined
    return getDocumentById(id)
  })

  ipcMain.handle('documents:delete', async (_event, id: string) => {
    if (!isValidId(id)) throw new Error('Ungültige Dokument-ID')
    logger.info('documents.ipc', 'Deleting document', { id })
    await deleteDocument(id)
  })

  ipcMain.handle('documents:getFirstImpression', (_event, id: string) => {
    if (!isValidId(id)) return null
    return getFirstImpression(id)
  })

  ipcMain.handle('documents:generateFirstImpression', async (_event, id: string) => {
    if (!isValidId(id)) return null
    const model = getSelectedModel()
    if (!model) {
      logger.warn('documents.ipc', 'First impression requested but no model selected', { id })
      return null
    }
    return generateFirstImpression(id, model)
  })

  ipcMain.handle('documents:reImport', async (_event, id: string) => {
    if (!isValidId(id)) return { ok: false, error: 'Ungültige Dokument-ID' }
    logger.info('documents.ipc', 'Re-importing document', { id })
    try {
      const doc = await reImportDocument(id)
      return { ok: true, doc }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Re-Import fehlgeschlagen'
      logger.error('documents.ipc', 'Re-import failed', {
        id,
        error: message,
        stack: err instanceof Error ? err.stack : undefined
      })
      return { ok: false, error: message }
    }
  })
}
