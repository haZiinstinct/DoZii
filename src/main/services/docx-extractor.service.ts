import mammoth from 'mammoth'

export interface DocxResult {
  text: string
}

export async function extractDocx(filePath: string): Promise<DocxResult> {
  const result = await mammoth.extractRawText({ path: filePath })
  return {
    text: result.value.trim()
  }
}
