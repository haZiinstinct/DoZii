import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('../db', () => ({ getDb: vi.fn(), schema: {} }))
vi.mock('./document-store.service', () => ({ getDocumentById: vi.fn() }))
vi.mock('./ollama-client.service', () => ({ streamConversation: vi.fn(), warmupModel: vi.fn() }))
vi.mock('./settings.service', () => ({ getSettings: vi.fn() }))
vi.mock('./logger.service', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { buildSystemPrompt, trimHistory } from './chat.service'

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

describe('trimHistory', () => {
  const sys = { role: 'system', content: 's' }
  const msg = (role: 'user' | 'assistant', len: number) => ({ role, content: 'x'.repeat(len) })

  it('entfernt Frage und Antwort gemeinsam', () => {
    const messages = [
      sys,
      msg('user', 50),
      msg('assistant', 50),
      msg('user', 5),
      msg('assistant', 5),
      msg('user', 5)
    ]
    trimHistory(messages, 30)
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
  })

  it('behaelt immer System-Prompt und neue Frage', () => {
    const messages = [sys, msg('user', 500), msg('assistant', 500), msg('user', 500)]
    trimHistory(messages, 10)
    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(messages[1].content).toHaveLength(500)
  })
})
