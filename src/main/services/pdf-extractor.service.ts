import { readFile } from 'fs/promises'

export interface PdfResult {
  text: string
  pageCount: number
  /**
   * Text je Seite. Noetig, um gemischte Dokumente zu erkennen: 18 saubere
   * Textseiten und 2 eingescannte Seiten ergeben im Durchschnitt einen
   * unauffaelligen Wert - die zwei Scanseiten wuerden stillschweigend leer
   * bleiben.
   */
  pages: string[]
}

export async function extractPdf(filePath: string): Promise<PdfResult> {
  const data = await readFile(filePath)
  // unpdf requires a real Uint8Array, not a Node Buffer.
  // Buffer extends Uint8Array but unpdf does a strict constructor check.
  const uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  // Lazy-Import: unpdf/pdf.js (~1,9MB) wird erst beim ersten PDF geladen,
  // nicht beim App-Start (die meisten Sessions oeffnen kein PDF).
  const { extractText } = await import('unpdf')
  try {
    const { text, totalPages } = await extractText(uint8, { mergePages: false })
    const pages = Array.isArray(text) ? text.map((t) => String(t)) : [String(text)]
    return {
      text: pages.join('\n').trim(),
      pageCount: totalPages,
      pages
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
