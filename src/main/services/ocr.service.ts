import type { Worker } from 'tesseract.js'
import { join } from 'path'
import { app } from 'electron'
import { preprocessImage } from './image-preprocessor.service'
import { logger } from './logger.service'

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

// Worker-Wiederverwendung: Worker-Start + Laden der traineddata kostet je
// ~300-500ms. Frueher pro Bild neu erzeugt+terminiert -> bei Batch/Mehrseiten-OCR
// summierte sich das massiv. Jetzt ein Worker pro Sprachkombination, gecacht,
// terminiert beim App-Quit (shutdownOcr).
const workers = new Map<string, Promise<Worker>>()

async function getWorker(langStr: string): Promise<Worker> {
  let workerPromise = workers.get(langStr)
  if (!workerPromise) {
    // Lazy-Import: tesseract.js wird erst beim ersten Bild geladen, nicht beim App-Start.
    workerPromise = import('tesseract.js').then(({ createWorker, OEM }) =>
      createWorker(langStr, OEM.LSTM_ONLY, {
        langPath: getLangPath(),
        cacheMethod: 'none' // Don't try to fetch from CDN
      })
    )
    workers.set(langStr, workerPromise)
    // Bei Init-Fehler nicht den kaputten Promise cachen
    workerPromise.catch(() => workers.delete(langStr))
  }
  return workerPromise
}

export async function recognizeImage(
  filePath: string,
  languages: string[] = ['deu', 'eng']
): Promise<OcrResult> {
  const langStr = languages.join('+')
  const imageBuffer = await preprocessImage(filePath)
  const worker = await getWorker(langStr)

  const {
    data: { text, confidence }
  } = await worker.recognize(imageBuffer)

  return {
    text: text.trim(),
    confidence
  }
}

/** Beim App-Quit alle OCR-Worker sauber beenden. */
export async function shutdownOcr(): Promise<void> {
  const pending = [...workers.values()]
  workers.clear()
  await Promise.all(
    pending.map((p) =>
      p
        .then((w) => w.terminate())
        .catch((err) =>
          logger.warn('ocr.service', 'Worker-Terminate fehlgeschlagen', {
            error: err instanceof Error ? err.message : String(err)
          })
        )
    )
  )
}
