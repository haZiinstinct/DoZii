import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings, type ThemeMode } from '@shared/types'
import { LANGUAGE_CODES } from '@shared/languages'
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

const THEMES: ThemeMode[] = ['dark', 'light', 'system']
const LANGUAGES: AppSettings['language'][] = LANGUAGE_CODES
const OCR_QUALITIES: AppSettings['ocrQuality'][] = ['fast', 'balanced', 'best']

/**
 * Validiert geladene Settings feldweise gegen erwartete Typen/Enums. Korrupte
 * oder veraltete Werte (z.B. theme:'invalid' aus einer manuell editierten oder
 * beschaedigten dozii-settings.json) fallen auf den Default zurueck, statt
 * ungueltige Werte in die UI zu reichen.
 */
export function sanitizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const r = raw as Record<string, unknown>
  let repaired = false

  const pick = <K extends keyof AppSettings>(key: K, valid: boolean, value: AppSettings[K]) => {
    if (valid) return value
    repaired = true
    return DEFAULT_SETTINGS[key]
  }

  const result: AppSettings = {
    ollamaUrl: pick('ollamaUrl', typeof r.ollamaUrl === 'string', r.ollamaUrl as string),
    selectedModel: pick(
      'selectedModel',
      typeof r.selectedModel === 'string',
      r.selectedModel as string
    ),
    language: pick(
      'language',
      LANGUAGES.includes(r.language as AppSettings['language']),
      r.language as AppSettings['language']
    ),
    theme: pick('theme', THEMES.includes(r.theme as ThemeMode), r.theme as ThemeMode),
    ocrLanguages: pick(
      'ocrLanguages',
      Array.isArray(r.ocrLanguages) && r.ocrLanguages.every((l) => typeof l === 'string'),
      r.ocrLanguages as string[]
    ),
    ocrQuality: pick(
      'ocrQuality',
      OCR_QUALITIES.includes(r.ocrQuality as AppSettings['ocrQuality']),
      r.ocrQuality as AppSettings['ocrQuality']
    ),
    firstLaunchDone: pick(
      'firstLaunchDone',
      typeof r.firstLaunchDone === 'boolean',
      r.firstLaunchDone as boolean
    ),
    autoUpdateCheck: pick(
      'autoUpdateCheck',
      typeof r.autoUpdateCheck === 'boolean',
      r.autoUpdateCheck as boolean
    )
  }

  if (repaired) {
    logger.warn('settings.service', 'Korrupte Settings-Felder auf Default zurueckgesetzt')
  }
  return result
}

export function getSettings(): AppSettings {
  return sanitizeSettings(getStore().get('settings'))
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
