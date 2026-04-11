import { ipcMain } from 'electron'
import { getSystemMetrics } from '../services/system-metrics.service'

export function registerSystemIpc(): void {
  ipcMain.handle('system:getMetrics', async () => {
    return getSystemMetrics()
  })
}
