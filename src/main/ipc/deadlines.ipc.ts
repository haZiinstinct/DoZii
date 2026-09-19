import { ipcMain, BrowserWindow } from 'electron'
import {
  getDeadlinesForDocument,
  getUpcomingDeadlines,
  scanDeadlines
} from '../services/deadline.service'
import { exportDeadlinesAsIcs } from '../services/export.service'
import { resolveActiveModel } from '../services/model-resolver.service'
import { logger } from '../services/logger.service'
import { isValidId } from './_validators'

export function registerDeadlinesIpc(): void {
  ipcMain.handle('deadlines:forDocument', (_event, documentId: string) => {
    if (!isValidId(documentId)) return []
    return getDeadlinesForDocument(documentId)
  })

  ipcMain.handle('deadlines:upcoming', () => {
    return getUpcomingDeadlines()
  })

  ipcMain.handle('deadlines:scan', async (_event, documentId: string) => {
    if (!isValidId(documentId)) {
      return { ok: false, deadlines: [], error: 'Ungueltige Dokument-ID' }
    }
    const resolution = await resolveActiveModel()
    if (resolution.kind !== 'ok') {
      logger.warn('deadlines.ipc', 'Fristensuche ohne Modell nicht moeglich', {
        reason: resolution.kind
      })
      // Kein leeres Ergebnis vortaeuschen - sonst behauptet die Oberflaeche,
      // im Dokument stehe keine Frist, obwohl nur kein Modell lief.
      return {
        ok: false,
        deadlines: getDeadlinesForDocument(documentId),
        error: resolution.message
      }
    }
    return scanDeadlines(documentId, resolution.model)
  })

  ipcMain.handle('deadlines:exportIcs', async (event, documentId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'Kein Fenster gefunden' }
    const id = typeof documentId === 'string' && isValidId(documentId) ? documentId : undefined
    return exportDeadlinesAsIcs(id, win)
  })
}
