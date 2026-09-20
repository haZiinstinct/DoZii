import { ipcMain, shell, dialog, BrowserWindow, clipboard } from 'electron'
import { writeFile } from 'fs/promises'
import { createDiagnosticReport } from '../services/diagnostics.service'
import { logger } from '../services/logger.service'
import { githubIssueUrl } from '@shared/diagnostic-report'

const SOURCE = 'diagnostics.ipc'

/** Das Repo, in dem Berichte landen. Geoeffnet wird es nur auf Klick. */
const REPO_URL = 'https://github.com/haZiinstinct/DoZii'

export function registerDiagnosticsIpc(): void {
  ipcMain.handle('diagnostics:create', async () => {
    try {
      return await createDiagnosticReport()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(SOURCE, 'Diagnosebericht fehlgeschlagen', { error: message })
      // Auch ein gescheiterter Bericht ist ein Bericht - der Fehler selbst
      // ist die interessanteste Information darin.
      return `DoZii - Diagnosebericht konnte nicht vollstaendig erstellt werden.\n\nFehler: ${message}`
    }
  })

  ipcMain.handle('diagnostics:copy', async (_event, report: unknown) => {
    if (typeof report !== 'string' || report.length === 0) return false
    clipboard.writeText(report)
    return true
  })

  ipcMain.handle('diagnostics:save', async (event, report: unknown) => {
    if (typeof report !== 'string' || report.length === 0) return null
    const win = BrowserWindow.fromWebContents(event.sender)
    const stamp = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win ?? BrowserWindow.getAllWindows()[0], {
      defaultPath: `dozii-diagnose-${stamp}.txt`,
      filters: [{ name: 'Textdatei', extensions: ['txt'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, report, 'utf8')
    logger.info(SOURCE, 'Diagnosebericht gespeichert')
    return result.filePath
  })

  ipcMain.handle('diagnostics:report', async (_event, report: unknown) => {
    if (typeof report !== 'string' || report.length === 0) return false
    // Erst hier verlaesst etwas den Rechner - und nur, weil der Nutzer
    // geklickt hat, nachdem er den Bericht gelesen hat.
    await shell.openExternal(githubIssueUrl(REPO_URL, report))
    return true
  })
}
