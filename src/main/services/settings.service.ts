import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'
import { logger } from './logger.service'

// electron-store v10 is ESM-only; we need the default export
type StoreSchema = { settings: AppSettings }

let store: Store<StoreSchema> | null = null

function getStore(): Store<StoreSchema> {
  if (!store) {
    store = new Store<StoreSchema>({
      name: 'dozii-settings',
      defaults: { settings: DEFAULT_SETTINGS }
    })
    logger.info('settings.service', 'Settings store initialized', { path: store.path })
  }
  return store
}

export function getSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...getStore().get('settings') }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next: AppSettings = { ...current, ...partial }
  getStore().set('settings', next)
  logger.info('settings.service', 'Settings updated', { keys: Object.keys(partial) })
  return next
}

export function resetSettings(): AppSettings {
  getStore().set('settings', DEFAULT_SETTINGS)
  logger.info('settings.service', 'Settings reset to defaults')
  return DEFAULT_SETTINGS
}
