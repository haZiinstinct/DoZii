import { app } from 'electron'
import { join } from 'path'
import { readFile, mkdtemp, writeFile, rm } from 'fs/promises'
import { recognizeImage } from './ocr.service'
import type { OcrQuality } from './image-preprocessor.service'
import { logger } from './logger.service'
import { OCR_MAX_PAGES, OCR_MIN_IMAGE_PIXELS } from '../config/constants'

const SOURCE = 'pdf-ocr.service'

/** Massstab fuer das Render-Fallback: 1.0 waere ~72 dpi und fuer OCR zu grob. */
const RENDER_SCALE = 2.0

export interface PdfOcrResult {
  text: string
  pagesProcessed: number
  method: 'embedded-image' | 'rendered' | 'none'
  warning?: string
}

/** Strukturelle Kopie von unpdfs ExtractedImageObject (der Typ wird nicht exportiert). */
interface PdfPageImage {
  data: Uint8ClampedArray
  width: number
  height: number
  channels: 1 | 3 | 4
}

/**
 * Ein Scan besteht aus genau einem grossen Seitenbild; alles Kleinere sind
 * Logos, Unterschriften oder Stempel. Bei mehreren grossen Bildern gewinnt
 * das flaechenmaessig groesste.
 */
function pickPageImage(images: PdfPageImage[]): PdfPageImage | null {
  let best: PdfPageImage | null = null
  let bestArea = 0
  for (const img of images) {
    const area = img.width * img.height
    if (area < OCR_MIN_IMAGE_PIXELS || area <= bestArea) continue
    best = img
    bestArea = area
  }
  return best
}

/** Rohpixel aus dem PDF in einen PNG-Buffer, den Tesseract lesen kann. */
async function rawToPng(img: PdfPageImage): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  return sharp(img.data, {
    raw: { width: img.width, height: img.height, channels: img.channels }
  })
    .png()
    .toBuffer()
}

/**
 * Zieht den Text eines gescannten PDFs per OCR nach. Wird nur gerufen, wenn
 * detectScannedPdf() die Textebene als unbrauchbar eingestuft hat.
 *
 * Der Umweg ueber temporaere PNG-Dateien ist Absicht: recognizeImage() nimmt
 * einen Dateipfad und bringt damit Worker-Caching und Preprocessing mit -
 * beides muessten wir hier sonst nachbauen.
 *
 * Wirft nur, wenn das PDF gar nicht lesbar ist. Einzelne Problem-Seiten werden
 * uebersprungen und in `warning` gemeldet.
 */
export async function ocrPdf(
  filePath: string,
  languages: string[],
  quality: OcrQuality = 'balanced',
  onProgress?: (page: number, total: number) => void
): Promise<PdfOcrResult> {
  const data = await readFile(filePath)
  // unpdf verlangt ein echtes Uint8Array, kein Node-Buffer (strikter Konstruktor-Check).
  const uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  // Lazy-Import wie in pdf-extractor.service: unpdf/pdf.js (~1,9MB) laedt erst
  // beim ersten Scan, nicht beim App-Start.
  const { getDocumentProxy, extractImages, renderPageAsImage } = await import('unpdf')

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(uint8)
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/password|encrypted/i.test(raw)) {
      throw new Error(
        'Das PDF ist passwortgeschützt und kann nicht per Texterkennung gelesen werden. Bitte den Schutz entfernen (z.B. "Drucken als PDF") und erneut importieren.',
        { cause: err }
      )
    }
    if (/invalid pdf|corrupt|malformed|missing pdf header|FormatError/i.test(raw)) {
      throw new Error(
        'Das PDF ist beschädigt oder kein gültiges PDF - die Texterkennung kann es nicht öffnen.',
        { cause: err }
      )
    }
    throw err
  }

  const totalPages = pdf.numPages
  const pagesToDo = Math.min(totalPages, OCR_MAX_PAGES)
  const truncated = totalPages > OCR_MAX_PAGES

  logger.info(SOURCE, 'OCR-Fallback gestartet', {
    totalPages,
    pagesToDo,
    languages: languages.join('+')
  })

  // Eigenes Temp-Verzeichnis: am Ende ein rm -r statt einzelner unlinks, und
  // kein Kollisionsrisiko mit parallelen Importen.
  const tmpDir = await mkdtemp(join(app.getPath('temp'), 'dozii-ocr-'))

  const pageTexts: string[] = []
  const skippedPages: number[] = []
  let pagesProcessed = 0
  let usedEmbedded = false
  let usedRendered = false

  try {
    for (let page = 1; page <= pagesToDo; page++) {
      onProgress?.(page, pagesToDo)

      let png: Buffer | null = null
      let method: 'embedded-image' | 'rendered' = 'embedded-image'

      // 1. Eingebettetes Seitenbild - der Normalfall bei Scans.
      try {
        const best = pickPageImage(await extractImages(pdf, page))
        if (best) png = await rawToPng(best)
      } catch (err) {
        logger.warn(SOURCE, 'Bildextraktion fehlgeschlagen', {
          page,
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // 2. Fallback: Seite rendern. Braucht das optionale Peer-Paket
      //    '@napi-rs/canvas', das NICHT installiert ist - schlaegt also
      //    erwartbar fehl. Bleibt drin, damit es sofort greift, sobald das
      //    Paket verfuegbar ist, und darf niemals die ganze OCR reissen.
      if (!png) {
        try {
          const buf = await renderPageAsImage(pdf, page, { scale: RENDER_SCALE })
          png = Buffer.from(buf)
          method = 'rendered'
        } catch (err) {
          logger.debug(SOURCE, 'Seiten-Rendering nicht verfügbar', {
            page,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      if (!png) {
        skippedPages.push(page)
        continue
      }

      try {
        const tmpPath = join(tmpDir, `page-${page}.png`)
        await writeFile(tmpPath, png)
        const { text } = await recognizeImage(tmpPath, languages, quality)
        if (text.length > 0) pageTexts.push(text)
        pagesProcessed++
        if (method === 'embedded-image') usedEmbedded = true
        else usedRendered = true
      } catch (err) {
        skippedPages.push(page)
        logger.warn(SOURCE, 'Texterkennung für Seite fehlgeschlagen', {
          page,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch((err) => {
      logger.warn(SOURCE, 'Temp-Verzeichnis konnte nicht aufgeräumt werden', {
        tmpDir,
        error: err instanceof Error ? err.message : String(err)
      })
    })
  }

  const warnings: string[] = []
  if (skippedPages.length > 0) {
    warnings.push(
      `${skippedPages.length} von ${pagesToDo} Seiten konnten nicht erkannt werden (Seite ${skippedPages.slice(0, 5).join(', ')}${skippedPages.length > 5 ? ' u.a.' : ''}).`
    )
  }
  if (truncated) {
    warnings.push(
      `Nur die ersten ${OCR_MAX_PAGES} von ${totalPages} Seiten wurden per Texterkennung gelesen.`
    )
  }

  // Bei gemischten Seiten gewinnt der eingebettete Weg - er ist der Normalfall
  // und beschreibt die Qualitaet des Ergebnisses besser.
  const method: PdfOcrResult['method'] = usedEmbedded
    ? 'embedded-image'
    : usedRendered
      ? 'rendered'
      : 'none'

  const result: PdfOcrResult = {
    text: pageTexts.join('\n\n').trim(),
    pagesProcessed,
    method,
    ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {})
  }

  // Privacy: niemals Dokumentinhalt loggen, nur Metriken.
  logger.info(SOURCE, 'OCR-Fallback beendet', {
    pagesProcessed,
    skipped: skippedPages.length,
    method,
    textLength: result.text.length
  })

  return result
}
