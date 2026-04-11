import { createWorker, OEM } from 'tesseract.js'
import { join } from 'path'
import { app } from 'electron'
import { preprocessImage } from './image-preprocessor.service'

// Determine path to bundled traineddata files
function getLangPath(): string {
  // In production, resources are in the app's resources directory
  // In dev, they're in the project's resources directory
  const isDev = !app.isPackaged
  if (isDev) {
    return join(process.cwd(), 'resources', 'tesseract')
  }
  return join(process.resourcesPath, 'resources', 'tesseract')
}

export interface OcrResult {
  text: string
  confidence: number
}

export async function recognizeImage(
  filePath: string,
  languages: string[] = ['deu', 'eng']
): Promise<OcrResult> {
  const langPath = getLangPath()
  const langStr = languages.join('+')

  const imageBuffer = await preprocessImage(filePath)

  const worker = await createWorker(langStr, OEM.LSTM_ONLY, {
    langPath,
    cacheMethod: 'none' // Don't try to fetch from CDN
  })

  const {
    data: { text, confidence }
  } = await worker.recognize(imageBuffer)

  await worker.terminate()

  return {
    text: text.trim(),
    confidence
  }
}
