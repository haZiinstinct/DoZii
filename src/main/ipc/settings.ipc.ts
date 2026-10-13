import { ipcMain } from 'electron'
import { getSettings, updateSettings, resetSettings } from '../services/settings.service'
import { setSelectedModel } from './analysis.ipc'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'

/** Nur bekannte Schluessel aus dem Renderer durchlassen; der Rest wird ignoriert. */
function pickKnownSettings(raw: unknown): Partial<AppSettings> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const partial: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      partial[key] = (raw as Record<string, unknown>)[key]
    }
  }
  return partial as Partial<AppSettings>
}

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

  ipcMain.handle('settings:update', (_event, raw: unknown) => {
    const partial = pickKnownSettings(raw)
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
