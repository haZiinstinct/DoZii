import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('../db', () => ({ getDb: vi.fn(), schema: {} }))
vi.mock('./document-store.service', () => ({ getDocumentById: vi.fn() }))
vi.mock('./ollama-client.service', () => ({ streamConversation: vi.fn(), warmupModel: vi.fn() }))
vi.mock('./settings.service', () => ({ getSettings: vi.fn() }))
vi.mock('./logger.service', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { buildSystemPrompt } from './chat.service'

describe('buildSystemPrompt', () => {
  it('antwortet bei deutscher UI auf Deutsch', () => {
    expect(buildSystemPrompt('Text', 'de')).toContain('auf Deutsch')
  })

  it('antwortet in der UI-Sprache, auch jenseits von de/en', () => {
    expect(buildSystemPrompt('Text', 'ru')).toContain('in Russian')
    expect(buildSystemPrompt('Text', 'en')).toContain('in English')
  })

  it('enthaelt das Dokument', () => {
    expect(buildSystemPrompt('Bescheid vom 12.03.2026', 'fr')).toContain('Bescheid vom 12.03.2026')
  })
})
