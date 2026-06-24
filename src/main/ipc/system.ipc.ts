import { ipcMain } from 'electron'
import { getSystemMetrics } from '../services/system-metrics.service'
import { logger } from '../services/logger.service'
import type { SystemMetrics } from '@shared/types'

const EMPTY_METRICS: SystemMetrics = {
  cpuLoadPercent: 0,
  ramUsedGb: 0,
  ramTotalGb: 0,
  ramUsedPercent: 0,
  loadedModels: [],
  activeStreamCount: 0
}

export function registerSystemIpc(): void {
  ipcMain.handle('system:getMetrics', async () => {
    // Metrics werden gepollt - ein transienter Fehler darf den Poll nicht
    // als Rejection im Renderer landen lassen, sonst bricht die Sidebar.
    try {
      return await getSystemMetrics()
    } catch (err) {
      logger.warn('system.ipc', 'getMetrics fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err)
      })
      return EMPTY_METRICS
    }
  })
}
