import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'

export interface XlsxResult {
  text: string
  sheetCount: number
}

/**
 * SheetJS kommt seit 1.4.x aus dem offiziellen CDN (0.20.3): die Fassung im
 * npm-Register endet bei 0.18.5 und hat zwei offene Luecken (Prototype
 * Pollution, ReDoS), die erst ab 0.19.3/0.20.2 behoben sind.
 */
export function extractXlsx(filePath: string): XlsxResult {
  let workbook: XLSX.WorkBook
  try {
    // Datei selbst lesen: XLSX.readFile braucht im ESM-Build set_fs, read()
    // mit Puffer funktioniert in CommonJS und ESM gleich.
    const data = readFileSync(filePath)
    // .xlsx ist ein ZIP-Archiv, eine verschluesselte .xlsx ein OLE-Container
    // (dann meldet SheetJS den Passwortschutz). Ohne diese Pruefung liest
    // SheetJS beliebigen Text als CSV ein - eine umbenannte Datei kaeme als
    // "Tabelle" an.
    const isZip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b
    const isOle =
      data.length >= 8 &&
      data[0] === 0xd0 &&
      data[1] === 0xcf &&
      data[2] === 0x11 &&
      data[3] === 0xe0
    if (!isZip && !isOle) {
      throw new Error('unsupported: weder ZIP- noch OLE-Container')
    }
    workbook = XLSX.read(data, { type: 'buffer' })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/password|encrypted|agile encryption|ecma-376/i.test(raw)) {
      throw new Error(
        'Die Excel-Datei ist passwortgeschützt. Bitte den Schutz entfernen und erneut importieren.',
        { cause: err }
      )
    }
    if (/unsupported|corrupt|cannot find|end of data/i.test(raw)) {
      throw new Error(
        'Die Excel-Datei konnte nicht gelesen werden - beschädigt oder unbekanntes Format. Bitte als .xlsx neu speichern.',
        { cause: err }
      )
    }
    throw err
  }
  const sheets: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      sheets.push(`--- ${sheetName} ---\n${csv}`)
    }
  }

  return {
    text: sheets.join('\n\n').trim(),
    sheetCount: workbook.SheetNames.length
  }
}
