import { ipcMain } from 'electron'
import { getSettings, updateSettings, resetSettings } from '../services/settings.service'
import { setSelectedModel } from './analysis.ipc'
import type { AppSettings } from '@shared/types'

export function registerSettingsIpc(): void {
  // Sync current settings into the in-memory selectedModel on startup
  try {
    const initial = getSettings()
    if (initial.selectedModel) {
      setSelectedModel(initial.selectedModel)
    }
  } catch {
    // settings may not be readable yet
  }

  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => {
    const next = updateSettings(partial)
    // Mirror selectedModel into the analysis module so next analyse call uses it
    if (partial.selectedModel !== undefined) {
      setSelectedModel(next.selectedModel)
    }
    return next
  })

  ipcMain.handle('settings:reset', () => {
    return resetSettings()
  })
}
