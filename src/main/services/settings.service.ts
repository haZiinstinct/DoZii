import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings, type FontScale, type ThemeMode } from '@shared/types'
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
const FONT_SCALES: FontScale[] = ['normal', 'large', 'xlarge']

/** Gebundelte Tesseract-Sprachdaten (resources/tesseract). Mehr gibt es offline nicht. */
export const AVAILABLE_OCR_LANGUAGES = ['deu', 'eng'] as const

/**
 * Hosts, die als "der eigene Rechner" gelten. Alles andere ist ein fremder
 * Server - und dorthin gehen die Dokumente nicht.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'])

/**
 * Akzeptiert nur http(s)-URLs auf den eigenen Rechner.
 *
 * Das Kernversprechen der App ist, dass Dokumente den Rechner nicht verlassen.
 * Eine frei setzbare Adresse haette genau das ausgehebelt: wer (versehentlich
 * oder durch eine manipulierte Einstellungsdatei) einen fremden Host eintraegt,
 * schickt jeden Bescheid und jedes Arbeitszeugnis dorthin - ohne dass die
 * Oberflaeche es sagt. Ollama auf einem anderen Rechner im Heimnetz ist ein
 * nachvollziehbarer Wunsch, aber er gehoert bewusst entschieden und nicht in
 * ein Textfeld, das auch ein Tippfehler treffen kann.
 */
export function isValidOllamaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

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
    ollamaUrl: pick('ollamaUrl', isValidOllamaUrl(r.ollamaUrl), r.ollamaUrl as string),
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
      Array.isArray(r.ocrLanguages) &&
        r.ocrLanguages.length > 0 &&
        r.ocrLanguages.every(
          (l) => typeof l === 'string' && (AVAILABLE_OCR_LANGUAGES as readonly string[]).includes(l)
        ),
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
    ),
    autoAnalyze: pick('autoAnalyze', typeof r.autoAnalyze === 'boolean', r.autoAnalyze as boolean),
    fontScale: pick(
      'fontScale',
      FONT_SCALES.includes(r.fontScale as FontScale),
      r.fontScale as FontScale
    ),
    highContrast: pick(
      'highContrast',
      typeof r.highContrast === 'boolean',
      r.highContrast as boolean
    ),
    redactOnExport: pick(
      'redactOnExport',
      typeof r.redactOnExport === 'boolean',
      r.redactOnExport as boolean
    ),
    autoContextWindow: pick(
      'autoContextWindow',
      typeof r.autoContextWindow === 'boolean',
      r.autoContextWindow as boolean
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
