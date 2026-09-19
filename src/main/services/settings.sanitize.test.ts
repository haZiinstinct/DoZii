import { describe, it, expect } from 'vitest'

// logger isolieren (zieht electron/app)
import { vi } from 'vitest'
vi.mock('./logger.service', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('electron-store', () => ({ default: class {} }))

import { isValidOllamaUrl, sanitizeSettings } from './settings.service'
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

describe('isValidOllamaUrl', () => {
  it('erlaubt den eigenen Rechner', () => {
    expect(isValidOllamaUrl('http://localhost:11434')).toBe(true)
    expect(isValidOllamaUrl('http://127.0.0.1:11434')).toBe(true)
    expect(isValidOllamaUrl('https://localhost:8443')).toBe(true)
  })

  it('lehnt fremde Hosts ab - Dokumente duerfen den Rechner nicht verlassen', () => {
    expect(isValidOllamaUrl('http://192.168.1.50:11434')).toBe(false)
    expect(isValidOllamaUrl('https://ollama.example.com')).toBe(false)
    expect(isValidOllamaUrl('http://evil.test/api')).toBe(false)
  })

  it('lehnt andere Protokolle und Muell ab', () => {
    expect(isValidOllamaUrl('file:///etc/passwd')).toBe(false)
    expect(isValidOllamaUrl('ftp://localhost')).toBe(false)
    expect(isValidOllamaUrl('localhost:11434')).toBe(false)
    expect(isValidOllamaUrl('')).toBe(false)
    expect(isValidOllamaUrl(null)).toBe(false)
  })

  it('eine fremde Adresse in der Settings-Datei faellt auf den Default zurueck', () => {
    const result = sanitizeSettings({ ollamaUrl: 'https://irgendwo.example.com' })
    expect(result.ollamaUrl).toBe(DEFAULT_SETTINGS.ollamaUrl)
  })
})
