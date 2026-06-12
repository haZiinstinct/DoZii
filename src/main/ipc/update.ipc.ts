import { app, ipcMain } from 'electron'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  installUpdate
} from '../services/updater.service'
import { logger } from '../services/logger.service'
import { friendlyError } from './_error-mapping'

export function registerUpdateIpc(): void {
  ipcMain.handle('update:getState', () => {
    return { appVersion: app.getVersion(), status: getUpdateStatus() }
  })

  ipcMain.handle('update:check', async () => {
    logger.info('update.ipc', 'Manueller Update-Check')
    return checkForUpdates()
  })

  ipcMain.handle('update:download', async () => {
    try {
      await downloadUpdate()
      return { ok: true }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      logger.error('update.ipc', 'Update-Download fehlgeschlagen', { error: raw })
      return { ok: false, error: friendlyError(raw) }
    }
  })

  ipcMain.handle('update:install', () => {
    logger.info('update.ipc', 'Update wird installiert (Neustart)')
    installUpdate()
  })
}
