import sharp from 'sharp'

/**
 * Preprocess an image for better OCR results:
 * - Convert to grayscale
 * - Increase contrast
 * - Normalize
 * Returns a buffer ready for Tesseract
 */
export async function preprocessImage(filePath: string): Promise<Buffer> {
  const processed = await sharp(filePath).grayscale().normalize().sharpen().toBuffer()

  return processed
}
