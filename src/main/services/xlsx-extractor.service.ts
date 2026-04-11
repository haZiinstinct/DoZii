import XLSX from 'xlsx'

export interface XlsxResult {
  text: string
  sheetCount: number
}

export function extractXlsx(filePath: string): XlsxResult {
  const workbook = XLSX.readFile(filePath)
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
