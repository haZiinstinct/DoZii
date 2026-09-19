import { app } from 'electron'
import { join } from 'path'
import { readFile, mkdtemp, writeFile, rm } from 'fs/promises'
import { recognizeImage } from './ocr.service'
import type { OcrQuality } from './image-preprocessor.service'
import { logger } from './logger.service'
import { OCR_MAX_PAGES, OCR_MIN_IMAGE_PIXELS } from '../config/constants'

const SOURCE = 'pdf-ocr.service'

/** Zeilenumbruch zwischen mehreren Bildstreifen derselben Seite. */
const LINE_BREAK = String.fromCharCode(10)

/** Massstab fuer das Render-Fallback: 1.0 waere ~72 dpi und fuer OCR zu grob. */
const RENDER_SCALE = 2.0

export interface PdfOcrResult {
  text: string
  pagesProcessed: number
  method: 'embedded-image' | 'rendered' | 'none'
  warning?: string
  /** Erkannter Text je bearbeiteter Seite (1-basiert). Fuer gemischte Dokumente. */
  textByPage: Map<number, string>
}

/** Strukturelle Kopie von unpdfs ExtractedImageObject (der Typ wird nicht exportiert). */
interface PdfPageImage {
  data: Uint8ClampedArray
  width: number
  height: number
  channels: 1 | 3 | 4
}

/**
 * Alles unterhalb von OCR_MIN_IMAGE_PIXELS sind Logos, Unterschriften oder
 * Stempel und werden verworfen. Der Rest wird KOMPLETT erkannt, nicht nur das
 * groesste Bild: manche Scanner zerlegen eine Seite in mehrere Streifen, und
 * nur den groessten zu lesen hiesse, den Rest der Seite stillschweigend
 * wegzuwerfen. Die Reihenfolge ist die des PDF-Inhalts, was bei Streifen-Scans
 * der Leserichtung entspricht.
 */
function pickPageImages(images: PdfPageImage[]): PdfPageImage[] {
  return images.filter((img) => img.width * img.height >= OCR_MIN_IMAGE_PIXELS)
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
  onProgress?: (page: number, total: number) => void,
  /**
   * Nur diese (1-basierten) Seiten erkennen. Ohne Angabe alle. Gemischte
   * Dokumente sparen damit die Seiten, die schon eine Textebene haben - das
   * ist der Unterschied zwischen zwei Minuten und zwanzig.
   */
  onlyPages?: readonly number[]
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
  const requested =
    onlyPages && onlyPages.length > 0
      ? [...new Set(onlyPages)].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
      : Array.from({ length: totalPages }, (_, i) => i + 1)
  const targetPages = requested.slice(0, OCR_MAX_PAGES)
  const pagesToDo = targetPages.length
  const truncated = requested.length > OCR_MAX_PAGES

  logger.info(SOURCE, 'OCR-Fallback gestartet', {
    totalPages,
    pagesToDo,
    teilweise: requested.length < totalPages,
    languages: languages.join('+')
  })

  // Eigenes Temp-Verzeichnis: am Ende ein rm -r statt einzelner unlinks, und
  // kein Kollisionsrisiko mit parallelen Importen.
  const tmpDir = await mkdtemp(join(app.getPath('temp'), 'dozii-ocr-'))

  const pageTexts: string[] = []
  const textByPage = new Map<number, string>()
  const skippedPages: number[] = []
  let pagesProcessed = 0
  let usedEmbedded = false
  let usedRendered = false

  try {
    for (let i = 0; i < targetPages.length; i++) {
      const page = targetPages[i]
      onProgress?.(i + 1, pagesToDo)

      let pngs: Buffer[] = []
      let method: 'embedded-image' | 'rendered' = 'embedded-image'

      // 1. Eingebettete Seitenbilder - der Normalfall bei Scans.
      try {
        const candidates = pickPageImages(await extractImages(pdf, page))
        pngs = []
        for (const img of candidates) {
          pngs.push(await rawToPng(img))
        }
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
      if (pngs.length === 0) {
        try {
          const buf = await renderPageAsImage(pdf, page, { scale: RENDER_SCALE })
          pngs = [Buffer.from(buf)]
          method = 'rendered'
        } catch (err) {
          logger.debug(SOURCE, 'Seiten-Rendering nicht verfügbar', {
            page,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      if (pngs.length === 0) {
        skippedPages.push(page)
        continue
      }

      try {
        const parts: string[] = []
        for (let i = 0; i < pngs.length; i++) {
          const tmpPath = join(tmpDir, `page-${page}-${i}.png`)
          await writeFile(tmpPath, pngs[i])
          const { text } = await recognizeImage(tmpPath, languages, quality)
          if (text.length > 0) parts.push(text)
          // Temp-Datei sofort wieder weg: bei 40 Seiten in hoher Aufloesung
          // summieren sich die PNGs sonst auf hunderte Megabyte.
          await rm(tmpPath, { force: true }).catch(() => {
            /* wird spaetestens mit dem Verzeichnis entfernt */
          })
        }
        if (parts.length > 0) {
          const pageText = parts.join(LINE_BREAK)
          pageTexts.push(pageText)
          textByPage.set(page, pageText)
        }
        pagesProcessed++
        if (method === 'embedded-image') usedEmbedded = true
        else usedRendered = true
      } catch (err) {
        skippedPages.push(page)
        logger.warn(SOURCE, 'Texterkennung für Seite fehlgeschlagen', {
          page,
          error: err instanceof Error ? err.message : String(err)
        })
      } finally {
        // Puffer der Seite freigeben, bevor die naechste geladen wird.
        pngs = []
      }
    }
  } finally {
    // pdf.js haelt dekodierte Seiten im Speicher, bis das Dokument zerstoert
    // wird. Bei 40 Seiten Scan ist das der Unterschied zwischen ein paar
    // hundert Megabyte und dem Ende des Arbeitsspeichers.
    await pdf.destroy().catch((err: unknown) => {
      logger.debug(SOURCE, 'PDF-Proxy konnte nicht zerstoert werden', {
        error: err instanceof Error ? err.message : String(err)
      })
    })
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
      `${skippedPages.length} von ${pagesToDo} Seiten konnten nicht per Texterkennung gelesen werden (Seite ${skippedPages.slice(0, 5).join(', ')}${skippedPages.length > 5 ? ' u.a.' : ''}).`
    )
  }
  if (truncated) {
    warnings.push(
      `Nur ${OCR_MAX_PAGES} von ${requested.length} zu erkennenden Seiten wurden gelesen - der Rest fehlt.`
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
    text: pageTexts.join(LINE_BREAK + LINE_BREAK).trim(),
    pagesProcessed,
    method,
    textByPage,
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
