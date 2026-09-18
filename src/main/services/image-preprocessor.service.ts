import sharp from 'sharp'
import type { AppSettings } from '@shared/types'

export type OcrQuality = AppSettings['ocrQuality']

/**
 * Profile hinter der Einstellung "OCR-Qualität". Die Einstellung war bislang
 * gespeichert, aber wirkungslos - hier bekommt sie Bedeutung.
 *
 * - fast: kleinere Kantenlänge, kein Schärfen. Für viel Text auf sauberen Scans.
 * - balanced: bisheriges Verhalten (4000px, schärfen).
 * - best: höhere Auflösung und Hochskalieren kleiner Handy-Fotos. Tesseract
 *   braucht ~300 dpi; ein 1000px-Foto einer A4-Seite liegt deutlich darunter.
 */
const QUALITY_PROFILES: Record<
  OcrQuality,
  { maxDimension: number; minDimension: number; sharpen: boolean }
> = {
  fast: { maxDimension: 2200, minDimension: 0, sharpen: false },
  balanced: { maxDimension: 4000, minDimension: 0, sharpen: true },
  best: { maxDimension: 6000, minDimension: 2200, sharpen: true }
}

/**
 * Preprocess an image for better OCR results:
 * - Downscale oversized images (OOM-Schutz), bei 'best' kleine Bilder hochskalieren
 * - Convert to grayscale
 * - Increase contrast / Normalize
 * Returns a buffer ready for Tesseract
 */
export async function preprocessImage(
  filePath: string | Buffer,
  quality: OcrQuality = 'balanced'
): Promise<Buffer> {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.balanced
  try {
    const input = sharp(filePath, { limitInputPixels: 100_000_000 })

    // Nur bei 'best': zu kleine Vorlagen (Handy-Foto) vor dem OCR hochziehen.
    let targetWidth = profile.maxDimension
    let withoutEnlargement = true
    if (profile.minDimension > 0) {
      const meta = await input.metadata()
      const longestEdge = Math.max(meta.width ?? 0, meta.height ?? 0)
      if (longestEdge > 0 && longestEdge < profile.minDimension) {
        targetWidth = profile.minDimension
        withoutEnlargement = false
      }
    }

    let pipeline = input
      .resize({
        width: targetWidth,
        height: targetWidth,
        fit: 'inside',
        withoutEnlargement
      })
      .grayscale()
      .normalize()
    if (profile.sharpen) pipeline = pipeline.sharpen()

    return await pipeline.toBuffer()
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/pixel limit|limitInputPixels/i.test(raw)) {
      throw new Error(
        'Das Bild ist zu gross für die Verarbeitung (max. 100 Megapixel). Bitte verkleinert exportieren.',
        { cause: err }
      )
    }
    if (/unsupported image format|input file contains|corrupt/i.test(raw)) {
      throw new Error(
        'Das Bild konnte nicht gelesen werden - Format nicht unterstützt oder Datei beschädigt.',
        { cause: err }
      )
    }
    throw err
  }
}
