import mammoth from 'mammoth'

export interface DocxResult {
  text: string
}

export async function extractDocx(filePath: string): Promise<DocxResult> {
  try {
    const result = await mammoth.extractRawText({ path: filePath })
    return {
      text: result.value.trim()
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    // mammoth meldet bei Nicht-ZIP-Dateien (z.B. altem .doc-Binärformat oder
    // beschädigten Dateien) einen ZIP-/Signatur-Fehler.
    if (/zip|signature|end of central directory|corrupt/i.test(raw)) {
      throw new Error(
        'Die Datei ist kein gültiges .docx (beschädigt oder altes Word-Format). Bitte in Word als .docx neu speichern.',
        { cause: err }
      )
    }
    throw err
  }
}
