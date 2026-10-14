import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { isInsideDir } from './path-inside'

describe('isInsideDir', () => {
  const dir = join('C:', 'Daten', 'documents')

  it('erkennt Dateien im Ordner und in Unterordnern', () => {
    expect(isInsideDir(dir, join(dir, 'a.pdf'))).toBe(true)
    expect(isInsideDir(dir, join(dir, 'sub', 'b.pdf'))).toBe(true)
  })

  it('faellt nicht auf gleich beginnende Nachbarordner herein', () => {
    expect(isInsideDir(dir, join('C:', 'Daten', 'documents-alt', 'x.pdf'))).toBe(false)
  })

  it('weist ".." und den Ordner selbst zurueck', () => {
    expect(isInsideDir(dir, join(dir, '..', 'geheim.txt'))).toBe(false)
    expect(isInsideDir(dir, dir)).toBe(false)
  })
})
