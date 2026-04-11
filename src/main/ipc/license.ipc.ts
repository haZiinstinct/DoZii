import { ipcMain } from 'electron'
import { getLicense, activateLicense, deactivateLicense } from '../services/license.service'
import { logger } from '../services/logger.service'

export function registerLicenseIpc(): void {
  ipcMain.handle('license:get', () => {
    return getLicense()
  })

  ipcMain.handle('license:activate', (_event, key: unknown, email?: unknown) => {
    if (typeof key !== 'string' || key.length === 0) {
      return { ok: false, error: 'Kein Lizenz-Key angegeben', info: getLicense() }
    }
    const emailStr = typeof email === 'string' && email.length > 0 ? email : null
    const result = activateLicense(key, emailStr)
    logger.info('license.ipc', 'Activation attempt', {
      ok: result.ok,
      tier: result.info.tier
    })
    return result
  })

  ipcMain.handle('license:deactivate', () => {
    return deactivateLicense()
  })
}
