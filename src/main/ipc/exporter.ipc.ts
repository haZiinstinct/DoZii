import { ipcMain, BrowserWindow } from 'electron'
import { exportAnalysis } from '../services/export.service'
import { isValidId } from './_validators'
import type { ExportFormat, ExportRequest } from '@shared/types'

const FORMATS: ReadonlySet<ExportFormat> = new Set<ExportFormat>(['pdf', 'markdown', 'rtf', 'txt'])

export function registerExporterIpc(): void {
  ipcMain.handle('exporter:analysis', async (event, request: ExportRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'Kein Fenster gefunden' }
    if (!request || typeof request !== 'object') {
      return { ok: false, error: 'Ungueltige Export-Anfrage' }
    }
    if (!isValidId(request.analysisId) || !FORMATS.has(request.format)) {
      return { ok: false, error: 'Ungueltige Export-Anfrage' }
    }
    return exportAnalysis({ ...request, redact: request.redact === true }, win)
  })
}
