import { describe, it, expect, vi, beforeEach } from 'vitest'

// Electron-abhaengige Module mocken, damit der Resolver isoliert testbar ist
vi.mock('./logger.service', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
const mockGetSettings = vi.fn()
vi.mock('./settings.service', () => ({
  getSettings: () => mockGetSettings()
}))
const mockCheckStatus = vi.fn()
const mockListModels = vi.fn()
vi.mock('./ollama-client.service', () => ({
  checkOllamaStatus: () => mockCheckStatus(),
  listModels: () => mockListModels()
}))

import { resolveActiveModel, setSelectedModel } from './model-resolver.service'

beforeEach(() => {
  setSelectedModel('')
  mockGetSettings.mockReset()
  mockCheckStatus.mockReset()
  mockListModels.mockReset()
})

describe('resolveActiveModel', () => {
  it('1. Prioritaet: explizit gewaehltes Modell (Cache)', async () => {
    setSelectedModel('qwen2.5:7b')
    const result = await resolveActiveModel()
    expect(result).toEqual({ kind: 'ok', model: 'qwen2.5:7b' })
    expect(mockCheckStatus).not.toHaveBeenCalled()
  })

  it('2. Prioritaet: persistierte Settings', async () => {
    mockGetSettings.mockReturnValue({ selectedModel: 'llama3.1:8b' })
    const result = await resolveActiveModel()
    expect(result).toEqual({ kind: 'ok', model: 'llama3.1:8b' })
  })

  it('no-ollama wenn Ollama nicht erreichbar', async () => {
    mockGetSettings.mockReturnValue({ selectedModel: '' })
    mockCheckStatus.mockResolvedValue({ connected: false })
    const result = await resolveActiveModel()
    expect(result.kind).toBe('no-ollama')
  })

  it('no-models-installed wenn Ollama leer ist', async () => {
    mockGetSettings.mockReturnValue({ selectedModel: '' })
    mockCheckStatus.mockResolvedValue({ connected: true })
    mockListModels.mockResolvedValue([])
    const result = await resolveActiveModel()
    expect(result.kind).toBe('no-models-installed')
  })

  it('3. Prioritaet: erstes installiertes Modell als Fallback', async () => {
    mockGetSettings.mockReturnValue({ selectedModel: '' })
    mockCheckStatus.mockResolvedValue({ connected: true })
    mockListModels.mockResolvedValue([{ name: 'gemma3:1b' }, { name: 'qwen2.5:3b' }])
    const result = await resolveActiveModel()
    expect(result).toEqual({ kind: 'ok', model: 'gemma3:1b' })
  })

  it('Settings-Fehler ist nicht fatal - faellt auf Ollama-Liste zurueck', async () => {
    mockGetSettings.mockImplementation(() => {
      throw new Error('store kaputt')
    })
    mockCheckStatus.mockResolvedValue({ connected: true })
    mockListModels.mockResolvedValue([{ name: 'qwen2.5:7b' }])
    const result = await resolveActiveModel()
    expect(result).toEqual({ kind: 'ok', model: 'qwen2.5:7b' })
  })
})
