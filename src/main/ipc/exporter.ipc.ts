import { ipcMain, BrowserWindow } from 'electron'
import { exportAnalysisAsPdf } from '../services/pdf-exporter.service'

export function registerExporterIpc(): void {
  ipcMain.handle('exporter:analysisAsPdf', async (event, analysisId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'Kein Fenster gefunden' }
    return exportAnalysisAsPdf(analysisId, win)
  })
}
