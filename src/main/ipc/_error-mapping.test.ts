import { describe, it, expect } from 'vitest'
import { friendlyError } from './_error-mapping'

describe('friendlyError', () => {
  it('reicht unbekannte Fehlermeldungen durch', () => {
    const result = friendlyError('voellig unbekannter fehler')
    expect(result).toBe('voellig unbekannter fehler')
  })

  it('erkennt fehlendes Modell', () => {
    const result = friendlyError('model "qwen2.5:7b" not found')
    expect(result).toContain('nicht installiert')
  })

  it('erkennt Model-Runner-Absturz', () => {
    const result = friendlyError('Error: llama runner process has exited unexpectedly')
    expect(result).toContain('abgestuerzt')
  })

  it('erkennt transiente Netzwerkfehler', () => {
    expect(friendlyError('fetch failed')).toContain('Verbindung zu Ollama abgebrochen')
    expect(friendlyError('socket hang up')).toContain('Verbindung zu Ollama abgebrochen')
  })

  it('erkennt nicht erreichbares Ollama (ECONNREFUSED)', () => {
    const result = friendlyError('connect ECONNREFUSED 127.0.0.1:11434')
    expect(result).toContain('Ollama ist nicht erreichbar')
  })

  it('erkennt Timeouts', () => {
    expect(friendlyError('Request timed out after 60000ms')).toContain('Zeitueberschreitung')
    expect(friendlyError('ETIMEDOUT')).toContain('Zeitueberschreitung')
  })

  it('erkennt beschaedigte Modelle', () => {
    expect(friendlyError('error loading model: tensor dtype mismatch')).toContain('beschaedigt')
    expect(friendlyError('unable to load model: invalid quantization')).toContain('beschaedigt')
  })

  it('erkennt volle Festplatte', () => {
    expect(friendlyError('write failed: ENOSPC no space left on device')).toContain('Speicherplatz')
  })

  it('erkennt Out-of-Memory', () => {
    expect(friendlyError('CUDA error: out of memory')).toContain('Nicht genug Speicher')
  })

  it('erkennt Kontextfenster-Ueberlauf', () => {
    expect(friendlyError('prompt context too long, exceeds limit')).toContain('zu lang')
  })
})
