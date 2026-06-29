import { describe, it, expect } from 'vitest'

// logger isolieren (zieht electron/app)
import { vi } from 'vitest'
vi.mock('./logger.service', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('electron-store', () => ({ default: class {} }))

import { sanitizeSettings } from './settings.service'
import { DEFAULT_SETTINGS } from '@shared/types'

describe('sanitizeSettings', () => {
  it('uebernimmt gueltige Werte', () => {
    const input = { ...DEFAULT_SETTINGS, language: 'en', theme: 'light', autoUpdateCheck: false }
    expect(sanitizeSettings(input)).toEqual(input)
  })

  it('faellt bei ungueltigem theme/language auf Default zurueck', () => {
    const result = sanitizeSettings({ ...DEFAULT_SETTINGS, theme: 'neon', language: 'klingon' })
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(result.language).toBe(DEFAULT_SETTINGS.language)
  })

  it('akzeptiert die neuen Sprachen (z.B. fr, ar, zh)', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, language: 'fr' }).language).toBe('fr')
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, language: 'ar' }).language).toBe('ar')
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, language: 'zh' }).language).toBe('zh')
  })

  it('repariert falsche Typen feldweise', () => {
    const result = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      autoUpdateCheck: 'yes',
      ocrLanguages: 'deu',
      selectedModel: 42
    })
    expect(result.autoUpdateCheck).toBe(DEFAULT_SETTINGS.autoUpdateCheck)
    expect(result.ocrLanguages).toEqual(DEFAULT_SETTINGS.ocrLanguages)
    expect(result.selectedModel).toBe(DEFAULT_SETTINGS.selectedModel)
  })

  it('liefert Defaults bei voellig kaputtem Input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('kaputt')).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })
})
