import { extractText } from 'unpdf'
import { readFile } from 'fs/promises'

export interface PdfResult {
  text: string
  pageCount: number
}

export async function extractPdf(filePath: string): Promise<PdfResult> {
  const data = await readFile(filePath)
  // unpdf requires a real Uint8Array, not a Node Buffer.
  // Buffer extends Uint8Array but unpdf does a strict constructor check.
  const uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  try {
    const { text, totalPages } = await extractText(uint8)
    return {
      text: Array.isArray(text) ? text.join('\n').trim() : String(text).trim(),
      pageCount: totalPages
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    // pdf.js wirft PasswordException("No password given") bzw. -Meldungen mit
    // "password" für verschlüsselte PDFs - dem Nutzer konkret sagen, was los ist.
    if (/password|encrypted/i.test(raw)) {
      throw new Error(
        'Das PDF ist passwortgeschützt. Bitte den Schutz entfernen (z.B. "Drucken als PDF") und erneut importieren.',
        { cause: err }
      )
    }
    if (/invalid pdf|corrupt|malformed|missing pdf header|FormatError/i.test(raw)) {
      throw new Error(
        'Das PDF ist beschädigt oder kein gültiges PDF. Bitte die Datei neu erstellen oder als Bild importieren.',
        { cause: err }
      )
    }
    throw err
  }
}
