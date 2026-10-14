import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { extractXlsx } from './xlsx-extractor.service'

const dir = mkdtempSync(join(tmpdir(), 'dozii-xlsx-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function writeWorkbook(name: string, sheets: Record<string, unknown[][]>): string {
  const wb = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName)
  }
  const path = join(dir, name)
  writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  return path
}

describe('extractXlsx', () => {
  it('liefert je Blatt eine Ueberschrift und CSV', () => {
    const path = writeWorkbook('a.xlsx', {
      Kosten: [
        ['Posten', 'Betrag'],
        ['Miete', 850]
      ],
      Leer: [[]]
    })
    const result = extractXlsx(path)
    expect(result.sheetCount).toBe(2)
    expect(result.text).toBe('--- Kosten ---\nPosten,Betrag\nMiete,850')
  })

  it('verschmutzt keine Prototypen ueber Zellinhalte oder Blattnamen', () => {
    const path = writeWorkbook('b.xlsx', {
      __proto__: [['polluted', 'yes']],
      constructor: [['prototype', 'x']]
    })
    extractXlsx(path)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).prototype).toBeUndefined()
  })

  it('meldet eine kaputte Datei verstaendlich', () => {
    const path = join(dir, 'kaputt.xlsx')
    writeFileSync(path, 'kein Excel')
    expect(() => extractXlsx(path)).toThrow(/konnte nicht gelesen werden/)
  })
})
