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
  const { text, totalPages } = await extractText(uint8)
  return {
    text: Array.isArray(text) ? text.join('\n').trim() : String(text).trim(),
    pageCount: totalPages
  }
}
