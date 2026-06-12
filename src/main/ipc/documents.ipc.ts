import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join, extname, resolve } from 'path'
import {
  importDocument,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  reImportDocument
} from '../services/document-store.service'
import { generateFirstImpression, getFirstImpression } from '../services/first-impression.service'
import { getSelectedModel } from './analysis.ipc'
import { logger } from '../services/logger.service'

// .doc/.xls (Legacy-Formate) fehlen bewusst: mammoth/xlsx können sie nicht
// lesen - Import würde crashen. Nutzer bekommen einen Konvertier-Hinweis.
const SUPPORTED_EXTS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.bmp',
  '.webp'
])

export function registerDocumentsIpc(): void {
  ipcMain.handle('documents:openDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Dokumente',
          extensions: ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp']
        }
      ]
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
        .filter((p) => SUPPORTED_EXTS.has(extname(p).toLowerCase()))
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

  ipcMain.handle('documents:import', async (_event, filePath: string) => {
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
    try {
      const doc = await importDocument(normalizedPath)

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

  ipcMain.handle('documents:getAll', () => {
    return getAllDocuments()
  })

  ipcMain.handle('documents:getById', (_event, id: string) => {
    return getDocumentById(id)
  })

  ipcMain.handle('documents:delete', async (_event, id: string) => {
    logger.info('documents.ipc', 'Deleting document', { id })
    await deleteDocument(id)
  })

  ipcMain.handle('documents:getFirstImpression', (_event, id: string) => {
    return getFirstImpression(id)
  })

  ipcMain.handle('documents:generateFirstImpression', async (_event, id: string) => {
    const model = getSelectedModel()
    if (!model) {
      logger.warn('documents.ipc', 'First impression requested but no model selected', { id })
      return null
    }
    return generateFirstImpression(id, model)
  })

  ipcMain.handle('documents:reImport', async (_event, id: string) => {
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
