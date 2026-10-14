import { describe, it, expect } from 'vitest'
import { isValidModelName } from './_validators'

describe('isValidModelName', () => {
  it('akzeptiert uebliche Ollama-Namen', () => {
    for (const name of ['qwen3:4b', 'granite4.1:3b', 'library/llama3.1:8b-instruct-q4_K_M']) {
      expect(isValidModelName(name)).toBe(true)
    }
  })

  it('weist Nicht-Strings, Leeres und Steuerzeichen zurueck', () => {
    for (const name of [undefined, null, 42, {}, '', ' qwen3', 'qwen3\n', 'a'.repeat(201)]) {
      expect(isValidModelName(name)).toBe(false)
    }
  })
})
