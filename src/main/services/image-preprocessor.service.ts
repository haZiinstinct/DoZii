import sharp from 'sharp'

// Schutz vor OOM bei Riesen-Scans: Bilder oberhalb dieser Kantenlaenge werden
// vor dem OCR proportional verkleinert. 4000px reicht fuer 300-dpi-A4-Scans.
const MAX_DIMENSION_PX = 4000

/**
 * Preprocess an image for better OCR results:
 * - Downscale oversized images (OOM-Schutz)
 * - Convert to grayscale
 * - Increase contrast
 * - Normalize
 * Returns a buffer ready for Tesseract
 */
export async function preprocessImage(filePath: string): Promise<Buffer> {
  try {
    const processed = await sharp(filePath, { limitInputPixels: 100_000_000 })
      .resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: 'inside',
        withoutEnlargement: true
      })
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer()

    return processed
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/pixel limit|limitInputPixels/i.test(raw)) {
      throw new Error(
        'Das Bild ist zu gross fuer die Verarbeitung (max. 100 Megapixel). Bitte verkleinert exportieren.',
        { cause: err }
      )
    }
    if (/unsupported image format|input file contains|corrupt/i.test(raw)) {
      throw new Error(
        'Das Bild konnte nicht gelesen werden - Format nicht unterstuetzt oder Datei beschaedigt.',
        { cause: err }
      )
    }
    throw err
  }
}
