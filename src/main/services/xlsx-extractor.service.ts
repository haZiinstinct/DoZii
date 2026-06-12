import XLSX from 'xlsx'

export interface XlsxResult {
  text: string
  sheetCount: number
}

export function extractXlsx(filePath: string): XlsxResult {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(filePath)
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
